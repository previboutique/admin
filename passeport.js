// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// passeport.js — EXPORT PASSEPORT DE PRÉVENTION : fichier CSV d'« attestations de formation » (ADF)
// conforme au guide d'import en masse OF/ADF du 27/02/2026 (séparateur « | », UTF-8, 20 colonnes,
// NIR 13 caractères, NOM_TITULAIRE = nom de naissance).
//  • Les codes (NSF, Formacode, ROME, RS) viennent de la FAMILLE de la formation (onglet « Familles & codes »).
//  • Écran de contrôle avant export : rien n'est généré tant qu'une ligne retenue a une erreur.
//  • MÉMOIRE des exports : chaque stagiaire exporté est marqué (date + export) et exclu des exports suivants ;
//    l'historique permet d'annuler un export (fichier refusé / jamais déposé). Patch 2026-10-05j.
//  • Le NIR n'est lu qu'au moment de générer le fichier (fonction nir_lire_lot : une trace « export » par stagiaire).

const PP_COLONNES = ['ID_DECLARATION', 'REFERENCE_DECLARATION', 'ID_UNIQUE_PARTENAIRE', 'NOM_FORMATION', 'DATE_DEBUT_FORMATION', 'DATE_FIN_FORMATION',
  'MODALITE_DISPENSE', 'COMPETENCE_TRANSFERABLE', 'QUALIFICATION_FORMATEUR', 'FORMATION_CERTIFIANTE', 'CERTIFICATION_VISEE', 'DOMAINE_FORMATION',
  'SPECIALITE_FORMATION', 'NIR', 'NOM_TITULAIRE', 'PRESENCE_EMPLOYEUR', 'SIRET_EMPLOYEUR', 'REFERENCE_EMPLOYEUR', 'DATE_DEBUT_VALIDITE', 'DATE_FIN_VALIDITE'];

const PP_QUALIFICATIONS = {
  ENSEIGNANT: 'Enseignant (lycée, université)',
  FORMATEUR_D_ADULTES_FORMATION_SPECIALISEE: "Formateur d'adultes ayant suivi une formation spécialisée au domaine concerné",
  INGENIEUR: 'Ingénieur',
  PREVENTEUR: 'Préventeur',
  PSYCHOLOGUE: 'Psychologue',
  RESPONSABLE_QHSE: 'Responsable qualité-hygiène-sécurité-environnement',
  ANCIEN_PROFESSIONNEL: 'Ancien professionnel du secteur concerné',
};
const PP_MODALITES = { presentiel: 'PRESENTIEL', distanciel: 'A_DISTANCE', mixte: 'MIXTE' };

// ---------------------------------------------------------------------------
// Fonctions pures (testables hors navigateur)
// ---------------------------------------------------------------------------
const ppDateFr = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const ppSlug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const ppNettoyer = v => String(v == null ? '' : v).replace(/[|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

// Fin de validité = date de fin + n mois - 1 jour (ex. 25/07/2025 + 24 mois -> 24/07/2027).
function ppAjouterMois(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m || !n) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCMonth(d.getUTCMonth() + Number(n));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Construit, pour une session, les lignes du fichier (sans le NIR) et les problèmes à corriger.
// ctx : { session, participants, famille, formateur, nirSet (Set d'ids stagiaires avec NIR), aujourdhui (AAAA-MM-JJ), ref (référentiels) }
function ppConstruireSession(ctx) {
  const { session, participants, famille, formateur, nirSet } = ctx;
  const f = session.formations_catalogue || {};
  const aujourdhui = ctx.aujourdhui || new Date().toISOString().slice(0, 10);
  const pbSession = [];   // { niveau: 'erreur'|'alerte', texte }

  if (!famille) pbSession.push({ niveau: 'erreur', texte: "Cette formation n'a pas de famille de codes : rattache-la à une famille (onglet « Familles & codes »)." });
  else {
    const pb = typeof PP !== 'undefined' && PP.controlerFamille ? PP.controlerFamille(famille, ctx.ref) : [];
    pb.forEach(p => pbSession.push({ niveau: p.niveau, texte: 'Famille « ' + famille.nom + ' » : ' + p.texte }));
    if (famille.fiabilite === 'hors_perimetre') pbSession.push({ niveau: 'erreur', texte: 'Formation hors périmètre : non déclarable au Passeport de prévention.' });
  }
  if (!session.date_debut || !session.date_fin) pbSession.push({ niveau: 'erreur', texte: 'Dates de la session incomplètes.' });
  else if (session.date_fin > aujourdhui) pbSession.push({ niveau: 'erreur', texte: `La session se termine le ${ppDateFr(session.date_fin)} : le Passeport refuse une formation non terminée.` });
  if (!formateur?.qualification_passeport) pbSession.push({ niveau: 'alerte', texte: "Qualification du formateur non renseignée (facultative, mais recommandée) : fiche du formateur." });

  const certifiante = !!famille?.certifiante;
  const nsf = (famille?.codes_nsf || []).join('/'), fc = (famille?.codes_formacode || []).join('/'), rome = (famille?.codes_rome || []).join('/');
  const idDecl = ppSlug(famille?.nom || f.code || 'Formation') + '_' + (session.date_fin || '').split('-').reverse().join('') + '_' + ppSlug(session.numero_session || session.id.slice(0, 8));
  const validDebut = session.date_fin || '';
  const validFin = ppAjouterMois(session.date_fin, f.cycle_mois);

  const lignes = (participants || []).map(p => {
    const st = p.stagiaires || {};
    const cl = p.clients || null;
    const pb = [];
    if (!nirSet || !nirSet.has(p.stagiaire_id)) pb.push({ niveau: 'erreur', texte: 'NIR non renseigné (fiche du stagiaire).' });
    const nomNaiss = ppNettoyer(st.nom_naissance);
    if (!nomNaiss) pb.push({ niveau: 'erreur', texte: 'Nom de naissance non renseigné (fiche du stagiaire).' });
    else if (nomNaiss.length > 30) pb.push({ niveau: 'erreur', texte: 'Nom de naissance : 30 caractères maximum.' });
    if (certifiante && !p.rs_code) pb.push({ niveau: 'erreur', texte: 'Formation certifiante : choisir le code RS (catégorie) de ce stagiaire.' });
    const siret = String(cl?.siret || '').replace(/\D/g, '');
    const employeur = siret.length === 14;
    if (cl && !employeur) pb.push({ niveau: 'alerte', texte: 'Client sans SIRET valide : déclaré sans employeur.' });
    const dejaDeclare = p.passeport_declare_le || null;
    const inclusParDefaut = ['present', 'certifie'].includes(p.statut) && !dejaDeclare;
    const valeurs = {
      ID_DECLARATION: idDecl,
      REFERENCE_DECLARATION: 'Session ' + (session.numero_session || ''),
      ID_UNIQUE_PARTENAIRE: p.id,
      NOM_FORMATION: ppNettoyer(f.denomination).slice(0, 250),
      DATE_DEBUT_FORMATION: ppDateFr(session.date_debut),
      DATE_FIN_FORMATION: ppDateFr(session.date_fin),
      MODALITE_DISPENSE: PP_MODALITES[session.modalite] || 'PRESENTIEL',
      COMPETENCE_TRANSFERABLE: rome,
      QUALIFICATION_FORMATEUR: formateur?.qualification_passeport || '',
      FORMATION_CERTIFIANTE: certifiante ? 'OUI' : 'NON',
      CERTIFICATION_VISEE: certifiante ? (p.rs_code || '') : '',
      DOMAINE_FORMATION: certifiante ? '' : fc,
      SPECIALITE_FORMATION: certifiante ? '' : nsf,
      NIR: '',                                   // lu au moment de générer le fichier
      NOM_TITULAIRE: nomNaiss,
      PRESENCE_EMPLOYEUR: employeur ? 'OUI' : 'NON',
      SIRET_EMPLOYEUR: employeur ? siret : '',
      REFERENCE_EMPLOYEUR: '',
      DATE_DEBUT_VALIDITE: ppDateFr(validDebut),
      DATE_FIN_VALIDITE: ppDateFr(validFin),
    };
    return { pid: p.id, stagiaireId: p.stagiaire_id, nom: `${st.nom || ''} ${st.prenom || ''}`.trim(), statut: p.statut, client: cl?.raison_sociale || '',
             rsCode: p.rs_code || '', dejaDeclare, inclusParDefaut, problemes: pb, valeurs };
  });
  if (lignes.filter(l => l.inclusParDefaut).length > 500) pbSession.push({ niveau: 'erreur', texte: 'Plus de 500 stagiaires pour une même déclaration : le Passeport refuse.' });
  return { session, famille, formateur, idDecl, certifiante, problemesSession: pbSession, lignes };
}

// Texte CSV : en-tête de la trame + une ligne par stagiaire, séparateur « | », fin de ligne CRLF, UTF-8 sans BOM.
function ppCsv(lignes) {
  const out = [PP_COLONNES.join('|')];
  lignes.forEach(v => out.push(PP_COLONNES.map(c => ppNettoyer(v[c])).join('|')));
  return out.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Chargement des données
// ---------------------------------------------------------------------------
async function ppChargerSessions(ids) {
  const [rs, rp, rf, rpr, rn] = await Promise.all([
    supa.from('sessions_formation').select('*, formations_catalogue(*)').in('id', ids),
    supa.from('session_participants').select('*, stagiaires(id, nom, prenom, nom_naissance), clients(raison_sociale, siret)').in('session_id', ids).limit(5000),
    supa.from('familles_formation').select('*').limit(1000),
    supa.from('profils').select('id, nom, prenom, qualification_passeport').limit(1000),
    supa.rpc('nir_renseignes'),
    PP.chargerReferentiels(),
  ]);
  const err = [['sessions', rs.error], ['participants', rp.error], ['familles', rf.error], ['formateurs', rpr.error], ['NIR', rn.error]].find(x => x[1]);
  if (err) { DEBUG.erreur('ppChargerSessions ' + err[0], err[1]); throw new Error(err[0] + ' : ' + err[1].message); }
  const familles = new Map((rf.data || []).map(f => [f.id, f]));
  const formateurs = new Map((rpr.data || []).map(p => [p.id, p]));
  const nirSet = new Set(rn.data || []);
  return (rs.data || []).sort((a, b) => String(a.date_debut).localeCompare(String(b.date_debut))).map(s => ppConstruireSession({
    session: s,
    participants: (rp.data || []).filter(p => p.session_id === s.id).sort((a, b) => `${a.stagiaires?.nom}`.localeCompare(`${b.stagiaires?.nom}`)),
    famille: familles.get(s.formations_catalogue?.famille_id) || null,
    formateur: formateurs.get(s.formateur_id) || null,
    nirSet, ref: PP.REF,
  }));
}

// ---------------------------------------------------------------------------
// Écran de contrôle (dans une zone : fiche de session ou écran global)
// ---------------------------------------------------------------------------
async function ppAfficherControle(zoneId, ids) {
  const zone = $('#' + zoneId);
  zone.innerHTML = '<p style="color:#55636c;">Contrôle des données en cours…</p>';
  let sessions;
  try { sessions = await ppChargerSessions(ids); }
  catch (e) { zone.innerHTML = `<p class="erreur">Erreur de chargement : ${esc(e.message)}. Le patch 2026-10-05j est-il exécuté dans Supabase ?</p>`; return; }
  window.__ppEtat = { zoneId, ids, sessions };
  ppRendreControle();
}

function ppRendreControle() {
  const { zoneId, sessions } = window.__ppEtat;
  const zone = $('#' + zoneId);
  const pastille = (n, c, f) => `<span style="font-size:11px;background:${f};color:${c};border-radius:10px;padding:1px 8px;margin-left:4px;">${n}</span>`;
  zone.innerHTML = `
    ${sessions.map((S_, si) => {
      const errSession = S_.problemesSession.filter(p => p.niveau === 'erreur');
      return `<div style="border:1px solid #e0e0e0;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <strong>${esc(S_.session.formations_catalogue?.denomination || '')} — n° ${esc(S_.session.numero_session || '—')} <span style="font-weight:normal;color:#55636c;">(${esc(ppDateFr(S_.session.date_debut))}${S_.session.date_fin !== S_.session.date_debut ? ' → ' + esc(ppDateFr(S_.session.date_fin)) : ''})</span></strong>
          <span style="font-size:12px;color:#55636c;">Famille : ${esc(S_.famille?.nom || '—')} — ${S_.certifiante ? 'certifiante' : 'non certifiante'} — déclaration ${esc(S_.idDecl)}</span>
        </div>
        ${S_.problemesSession.map(p => `<div style="font-size:12.5px;margin-top:4px;color:${p.niveau === 'erreur' ? '#b3261e' : '#8a5a00'};">${p.niveau === 'erreur' ? '⛔' : '⚠'} ${esc(p.texte)}</div>`).join('')}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
          <thead><tr style="text-align:left;color:#55636c;font-size:12px;"><th style="width:28px;"></th><th>Stagiaire</th><th>Statut</th><th>Client</th>${S_.certifiante ? '<th>Code RS (catégorie)</th>' : ''}<th>Contrôle</th></tr></thead>
          <tbody>
          ${S_.lignes.map((l, li) => {
            const erreurs = l.problemes.filter(p => p.niveau === 'erreur'), alertes = l.problemes.filter(p => p.niveau === 'alerte');
            return `<tr style="border-top:1px solid #eee;${l.dejaDeclare ? 'background:#f6f7f8;' : ''}">
              <td><input type="checkbox" class="pp-inc" data-si="${si}" data-li="${li}" style="width:auto;" ${l.inclusParDefaut ? 'checked' : ''} onchange="ppMajBilan()"></td>
              <td>${esc(l.nom)}</td>
              <td>${esc(l.statut)}${l.dejaDeclare ? pastille('déjà déclaré le ' + esc(new Date(l.dejaDeclare).toLocaleDateString('fr-FR')), '#8a5a00', '#fff4d6') : ''}</td>
              <td>${esc(l.client || '—')}</td>
              ${S_.certifiante ? `<td><select onchange="ppChoisirRs(${si}, ${li}, this.value)" style="max-width:260px;margin:0;padding:3px 6px;">
                  <option value="">— choisir —</option>
                  ${(S_.famille.codes_rs || []).map(c => `<option value="${esc(c)}" ${l.rsCode === c ? 'selected' : ''}>${esc(c)}${PP.REF?.rs?.get(c) ? ' — ' + esc(String(PP.REF.rs.get(c)).slice(0, 70)) : ''}</option>`).join('')}
                </select></td>` : ''}
              <td style="font-size:12.5px;">${erreurs.length ? erreurs.map(p => '<div style="color:#b3261e;">⛔ ' + esc(p.texte) + '</div>').join('') : ''}${alertes.map(p => '<div style="color:#8a5a00;">⚠ ' + esc(p.texte) + '</div>').join('')}${!erreurs.length && !alertes.length ? '<span style="color:#1a7f3c;">✔ prêt</span>' : ''}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="6" style="color:#55636c;padding:8px;">Aucun stagiaire inscrit.</td></tr>'}
          </tbody>
        </table>
      </div>`;
    }).join('')}
    <label style="display:flex;align-items:center;gap:6px;font-weight:normal;font-size:13px;margin:6px 0;">
      <input type="checkbox" id="pp-redeclarer" style="width:auto;" onchange="ppMajBilan()"> Autoriser aussi les stagiaires déjà déclarés (à n'utiliser que si le Passeport a refusé le premier fichier : sinon doublon)
    </label>
    <div id="pp-bilan" style="font-size:13.5px;margin:8px 0;"></div>
    <button class="bouton" id="pp-telecharger" onclick="ppTelecharger()">Télécharger le fichier CSV</button>
    <p style="font-size:12px;color:#55636c;margin:6px 0 0;">Au téléchargement, les stagiaires du fichier sont marqués « déclarés » et ne seront plus proposés par défaut. Un export peut être annulé dans l'historique. Dépose ensuite le fichier sur le portail du Passeport de prévention.</p>`;
  ppMajBilan();
}

function ppLignesRetenues() {
  const { sessions } = window.__ppEtat;
  const redecl = !!$('#pp-redeclarer')?.checked;
  const res = [];
  $$('.pp-inc').forEach(cb => {
    const si = Number(cb.dataset.si), li = Number(cb.dataset.li);
    const l = sessions[si].lignes[li];
    cb.disabled = !!l.dejaDeclare && !redecl;
    if (cb.disabled) cb.checked = false;
    if (cb.checked) res.push({ si, li, l, S_: sessions[si] });
  });
  return res;
}

function ppMajBilan() {
  const retenues = ppLignesRetenues();
  const nbErr = retenues.filter(r => r.l.problemes.some(p => p.niveau === 'erreur') || r.S_.problemesSession.some(p => p.niveau === 'erreur')).length;
  $('#pp-bilan').innerHTML = `<strong>${retenues.length}</strong> stagiaire(s) retenu(s)` + (nbErr ? ` — <span style="color:#b3261e;">${nbErr} avec une erreur à corriger (ou à décocher)</span>` : retenues.length ? ' — <span style="color:#1a7f3c;">tout est prêt</span>' : '');
  const b = $('#pp-telecharger'); if (b) b.disabled = !retenues.length || nbErr > 0;
}

async function ppChoisirRs(si, li, code) {
  const l = window.__ppEtat.sessions[si].lignes[li];
  const { error } = await supa.from('session_participants').update({ rs_code: code || null }).eq('id', l.pid);
  if (error) { DEBUG.erreur('ppChoisirRs', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Code RS enregistré.');
  // recalcul de l'écran avec les cases actuellement cochées conservées
  const coches = new Set($$('.pp-inc').filter(c => c.checked).map(c => c.dataset.si + ':' + c.dataset.li));
  await ppAfficherControle(window.__ppEtat.zoneId, window.__ppEtat.ids);
  $$('.pp-inc').forEach(c => { c.checked = coches.has(c.dataset.si + ':' + c.dataset.li); });
  ppMajBilan();
}

async function ppTelecharger() {
  const retenues = ppLignesRetenues();
  if (!retenues.length) return;
  if (retenues.some(r => r.l.problemes.some(p => p.niveau === 'erreur') || r.S_.problemesSession.some(p => p.niveau === 'erreur'))) { toast('Corrige les erreurs (ou décoche les lignes concernées).', 'erreur'); return; }
  const redecl = retenues.filter(r => r.l.dejaDeclare).length;
  if (redecl && !confirm(`${redecl} stagiaire(s) ont déjà été déclarés. Les déclarer de nouveau risque un doublon au Passeport. Continuer ?`)) return;
  const bouton = $('#pp-telecharger'); bouton.disabled = true;
  try {
    // 1. NIR (journalisé : une trace « export » par stagiaire)
    const ids = [...new Set(retenues.map(r => r.l.stagiaireId))];
    const { data: nirs, error: eNir } = await supa.rpc('nir_lire_lot', { p_ids: ids });
    if (eNir) throw new Error('lecture des NIR : ' + eNir.message);
    const nirMap = new Map((nirs || []).map(n => [n.stagiaire_id, String(n.nir || '').replace(/\s+/g, '')]));
    const lignes = [];
    for (const r of retenues) {
      const nir = (nirMap.get(r.l.stagiaireId) || '').slice(0, 13);
      if (!/^[0-9][0-9AB]{12}$/i.test(nir)) throw new Error(`NIR invalide pour ${r.l.nom} (13 caractères attendus).`);
      lignes.push({ ...r.l.valeurs, NIR: nir.toUpperCase() });
    }
    // 2. Mémoire de l'export AVANT le téléchargement (si l'enregistrement échoue, rien n'est téléchargé)
    const sessionsMeta = [...new Map(retenues.map(r => [r.S_.session.id, { id: r.S_.session.id, numero: r.S_.session.numero_session, formation: r.S_.session.formations_catalogue?.denomination }])).values()];
    const jour = new Date().toISOString().slice(0, 10);
    const nomFichier = ('Passeport_' + jour + '_' + sessionsMeta.map(s => ppSlug(s.numero || s.id.slice(0, 6))).join('_')).slice(0, 190) + '.csv';
    const { error: eEnr } = await supa.rpc('passeport_enregistrer_export', { p_nom: nomFichier, p_sessions: sessionsMeta, p_participants: retenues.map(r => r.l.pid) });
    if (eEnr) throw new Error("enregistrement de l'export : " + eEnr.message);
    // 3. Téléchargement
    const blob = new Blob([ppCsv(lignes)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nomFichier; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(`${lignes.length} ligne(s) exportée(s) — fichier ${nomFichier}`);
    await ppAfficherControle(window.__ppEtat.zoneId, window.__ppEtat.ids);
    if (typeof ppRendreHistorique === 'function' && $('#pp-historique')) ppRendreHistorique();
  } catch (e) {
    DEBUG.erreur('ppTelecharger', e);
    toast('Export impossible : ' + e.message, 'erreur');
    bouton.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Dans la fiche de session
// ---------------------------------------------------------------------------
function ouvrirExportPasseport(sessionId) {
  const zone = $('#passeport-session');
  if (!zone) return;
  if (zone.dataset.ouvert === '1') { zone.dataset.ouvert = '0'; zone.style.display = 'none'; zone.innerHTML = ''; return; }
  zone.dataset.ouvert = '1'; zone.style.display = 'block';
  zone.innerHTML = '<h3 style="margin-top:0;">Export Passeport de prévention</h3><div id="pp-zone-session"></div>';
  ppAfficherControle('pp-zone-session', [sessionId]);
}

// ---------------------------------------------------------------------------
// Écran global : onglet « Export Passeport »
// ---------------------------------------------------------------------------
async function ecranPasseport(vue) {
  if (!PEUT_GERER_SESSIONS()) { vue.innerHTML = '<div class="carte">Accès réservé aux administrateurs et gestionnaires.</div>'; return; }
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const debutDefaut = new Date(Date.now() - 62 * 86400000).toISOString().slice(0, 10);
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin-top:0;">Export Passeport de prévention</h2>
      <p style="font-size:13px;color:#55636c;margin:0 0 10px;">Choisis les sessions terminées à déclarer : le fichier CSV (attestations de formation) est généré après contrôle. Les stagiaires déjà exportés sont exclus par défaut.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div><label for="pg-du">Sessions terminées entre le</label><input id="pg-du" type="date" value="${debutDefaut}"></div>
        <div><label for="pg-au">et le</label><input id="pg-au" type="date" value="${aujourdhui}"></div>
        <label style="display:flex;align-items:center;gap:6px;font-weight:normal;margin-bottom:8px;"><input type="checkbox" id="pg-seulement" style="width:auto;" checked> Seulement avec des stagiaires à déclarer</label>
        <button class="bouton" onclick="ppListerSessions()" style="margin-bottom:6px;">Afficher</button>
      </div>
      <div id="pg-liste" style="margin-top:10px;"></div>
    </div>
    <div class="carte" id="pg-controle" style="display:none;"><h3 style="margin-top:0;">Contrôle avant export</h3><div id="pg-controle-zone"></div></div>
    <div class="carte" id="pp-historique"></div>`;
  await ppListerSessions();
  ppRendreHistorique();
}

async function ppListerSessions() {
  const zone = $('#pg-liste');
  zone.innerHTML = '<p style="color:#55636c;">Chargement…</p>';
  const du = $('#pg-du').value, au = $('#pg-au').value;
  let q = supa.from('sessions_formation').select('id, numero_session, date_debut, date_fin, statut, formations_catalogue(denomination, famille_id), session_participants(id, statut, passeport_declare_le)').neq('statut', 'annulee').lte('date_fin', au).order('date_fin', { ascending: false }).limit(300);
  if (du) q = q.gte('date_fin', du);
  const { data, error } = await q;
  if (error) { DEBUG.erreur('ppListerSessions', error); zone.innerHTML = `<p class="erreur">Erreur : ${esc(error.message)} (patch 2026-10-05j exécuté ?)</p>`; return; }
  const seul = $('#pg-seulement').checked;
  const liste = (data || []).map(s => {
    const inscrits = s.session_participants || [];
    const aDeclarer = inscrits.filter(p => ['present', 'certifie'].includes(p.statut) && !p.passeport_declare_le).length;
    const declares = inscrits.filter(p => p.passeport_declare_le).length;
    return { s, nb: inscrits.length, aDeclarer, declares };
  }).filter(x => !seul || x.aDeclarer > 0);
  zone.innerHTML = liste.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="text-align:left;color:#55636c;font-size:12px;"><th style="width:28px;"></th><th>Session</th><th>Formation</th><th>Fin</th><th>Inscrits</th><th>À déclarer</th><th>Déjà déclarés</th></tr></thead>
      <tbody>${liste.map(x => `<tr style="border-top:1px solid #eee;">
        <td><input type="checkbox" class="pg-sel" value="${x.s.id}" style="width:auto;" ${x.aDeclarer ? 'checked' : ''}></td>
        <td>${esc(x.s.numero_session || '—')}</td><td>${esc(x.s.formations_catalogue?.denomination || '')}${x.s.formations_catalogue?.famille_id ? '' : ' <span style="color:#b3261e;font-size:11px;">(sans famille de codes)</span>'}</td>
        <td>${esc(ppDateFr(x.s.date_fin))}</td><td>${x.nb}</td><td>${x.aDeclarer}</td><td>${x.declares || '—'}</td></tr>`).join('')}</tbody>
    </table>
    <button class="bouton" style="margin-top:10px;" onclick="ppPreparerSelection()">Préparer l'export des sessions cochées</button>`
    : '<p style="color:#55636c;">Aucune session à déclarer sur cette période.</p>';
}

function ppPreparerSelection() {
  const ids = $$('.pg-sel').filter(c => c.checked).map(c => c.value);
  if (!ids.length) { toast('Coche au moins une session.', 'erreur'); return; }
  $('#pg-controle').style.display = 'block';
  ppAfficherControle('pg-controle-zone', ids);
  $('#pg-controle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Historique des exports (mémoire) + annulation
// ---------------------------------------------------------------------------
async function ppRendreHistorique() {
  const zone = $('#pp-historique');
  if (!zone) return;
  const [{ data, error }, { data: profils }] = await Promise.all([
    supa.from('passeport_exports').select('*').order('created_at', { ascending: false }).limit(100),
    supa.from('profils').select('id, nom, prenom').limit(1000),
  ]);
  if (error) { zone.innerHTML = `<h3 style="margin-top:0;">Historique des exports</h3><p class="erreur">Erreur : ${esc(error.message)}</p>`; return; }
  const noms = new Map((profils || []).map(p => [p.id, `${p.prenom} ${p.nom}`]));
  zone.innerHTML = `<h3 style="margin-top:0;">Historique des exports (mémoire anti-doublon)</h3>` + ((data || []).length ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="text-align:left;color:#55636c;font-size:12px;"><th>Date</th><th>Par</th><th>Fichier</th><th>Lignes</th><th>Sessions</th><th></th></tr></thead>
      <tbody>${data.map(e => `<tr style="border-top:1px solid #eee;${e.annule_le ? 'color:#8a97a0;' : ''}">
        <td>${esc(new Date(e.created_at).toLocaleString('fr-FR'))}</td><td>${esc(noms.get(e.created_by) || '—')}</td><td>${esc(e.nom_fichier)}</td><td>${e.nb_lignes}</td>
        <td>${esc((e.sessions || []).map(s => s.numero || '').filter(Boolean).join(', '))}</td>
        <td>${e.annule_le ? 'annulé le ' + esc(new Date(e.annule_le).toLocaleDateString('fr-FR')) : `<button class="bouton" style="padding:3px 10px;font-size:12px;background:#fdeeee;color:#b3261e;" onclick="ppAnnulerExport('${e.id}')">Annuler cet export</button>`}</td></tr>`).join('')}</tbody>
    </table>
    <p style="font-size:12px;color:#55636c;margin:6px 0 0;">Annuler un export (fichier refusé ou jamais déposé) remet ses stagiaires dans la liste « à déclarer ». La trace de l'export est conservée.</p>`
    : '<p style="color:#55636c;">Aucun export pour l’instant.</p>');
}

async function ppAnnulerExport(id) {
  if (!confirm("Annuler cet export ? Ses stagiaires redeviendront « à déclarer ». À ne faire que si le fichier n'a pas été accepté par le Passeport.")) return;
  const { error } = await supa.rpc('passeport_annuler_export', { p_export: id });
  if (error) { DEBUG.erreur('ppAnnulerExport', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Export annulé.');
  ppRendreHistorique();
  if ($('#pg-liste')) ppListerSessions();
}
