// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// stagiaires.js — écran Stagiaires : liste, fiche (coordonnées, historique de
// sessions/recyclages, statistiques), et détection + fusion des fiches en
// doublon (même nom/prénom/client, souvent créées séparément lors d'imports
// ou de sessions différentes). La fusion se fait toujours après revue
// manuelle : jamais automatiquement.

function stgNormaliser(t) {
  return (t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function ecranStagiaires(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Stagiaires</h2>
      <div>
        <input id="stg-recherche" placeholder="Rechercher (nom, prénom, entreprise)…" style="width:260px;display:inline-block;">
        <button class="bouton" style="margin-left:6px;" onclick="ouvrirFicheStagiaire(null)">+ Nouveau stagiaire</button>
      </div>
    </div>
    <div id="rt-bandeau"></div>
    <div id="stg-doublons"></div>
    <div class="carte">
      <div id="stagiaires-liste">Chargement…</div>
    </div>
    <div id="stagiaire-fiche"></div>`;

  const { data, error } = await supa
    .from('stagiaires')
    .select('*, clients(raison_sociale), session_participants(count)')
    .order('nom');

  if (error) { DEBUG.erreur('ecranStagiaires', error); $('#stagiaires-liste').textContent = 'Erreur de chargement.'; return; }

  window.__stagiairesTous = (data || []).map(s => ({ ...s, __nbSessions: s.session_participants?.[0]?.count || 0 }));
  // NIR renseignés (sans jamais lire les NIR eux-mêmes) — réservé admin/gestionnaire.
  window.__nirRenseignes = new Set();
  if (PEUT_GERER_SESSIONS()) {
    const { data: ids, error: errNir } = await supa.rpc('nir_renseignes');
    if (errNir) DEBUG.erreur('nir_renseignes', errNir); else window.__nirRenseignes = new Set(ids || []);
  }
  rendreListeStagiaires(window.__stagiairesTous);
  if (PEUT_GERER_SESSIONS()) rendreDoublonsStagiaires();
  if (PEUT_GERER_SESSIONS() && typeof compterStagiairesSansClient === 'function') {
    compterStagiairesSansClient().then(n => { const z = $('#rt-bandeau'); if (z) z.innerHTML = bandeauRattachements(n); });
  }

  $('#stg-recherche').oninput = () => {
    const q = stgNormaliser($('#stg-recherche').value);
    const filtres = window.__stagiairesTous.filter(s =>
      !q || stgNormaliser(s.nom).includes(q) || stgNormaliser(s.prenom).includes(q) || stgNormaliser(s.clients?.raison_sociale).includes(q));
    rendreListeStagiaires(filtres);
  };
}

function rendreListeStagiaires(liste) {
  const zone = $('#stagiaires-liste');
  if (!liste.length) { zone.innerHTML = '<p style="color:#55636c;">Aucun stagiaire.</p>'; return; }
  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${liste.map(s => `
      <tr style="border-top:1px solid #eee;cursor:pointer;" onclick="ouvrirFicheStagiaire('${s.id}')">
        <td style="padding:6px 8px;">${esc(s.prenom)} ${esc(s.nom)}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(s.clients?.raison_sociale || '')}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(s.email || '')}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(s.telephone || '')}</td>
        ${PEUT_GERER_SESSIONS() ? `<td style="padding:6px 8px;font-size:12px;white-space:nowrap;" title="${(window.__nirRenseignes || new Set()).has(s.id) ? 'NIR renseigné' : 'NIR manquant (nécessaire pour l\'export Passeport de prévention)'}">${(window.__nirRenseignes || new Set()).has(s.id) ? '<span style="color:#1a7f3c;">NIR ✔</span>' : '<span style="color:#8a5a00;">NIR —</span>'}</td>` : ''}
        <td style="padding:6px 8px;color:#55636c;text-align:right;">${s.__nbSessions} session(s)</td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ============================================================================
// DÉTECTION + FUSION DES DOUBLONS — même nom + prénom + client (la date de
// naissance n'est pas toujours renseignée, donc pas utilisée comme critère).
// ============================================================================

function detecterDoublonsStagiaires(liste) {
  const groupes = {};
  liste.forEach(s => {
    const cle = `${stgNormaliser(s.nom)}|${stgNormaliser(s.prenom)}|${s.client_id || 'sans-client'}`;
    (groupes[cle] = groupes[cle] || []).push(s);
  });
  return Object.values(groupes).filter(g => g.length > 1);
}

function rendreDoublonsStagiaires() {
  const zone = $('#stg-doublons');
  const groupes = detecterDoublonsStagiaires(window.__stagiairesTous || []);
  window.__groupesDoublonsStagiaires = groupes;
  if (!groupes.length) { zone.innerHTML = ''; return; }

  zone.innerHTML = `
    <div class="carte" style="background:#fff8e8;border-color:#eda100;">
      <h3 style="margin-top:0;">Doublons détectés (${groupes.length} groupe(s))</h3>
      <p style="margin:0 0 12px;font-size:12px;color:#55636c;">
        Fiches ayant le même nom, prénom et la même entreprise — probablement la même personne, saisie plusieurs fois
        (import, session différente, recyclage…). Choisis la fiche à conserver, les autres seront supprimées après
        report de leurs sessions et complément des champs manquants sur la fiche conservée.
      </p>
      ${groupes.map((g, gi) => stgRendreGroupeDoublon(g, gi)).join('')}
    </div>`;
}

function stgRendreGroupeDoublon(groupe, gi) {
  // Survivant par défaut : le plus de sessions, puis le plus ancien.
  const tri = [...groupe].sort((a, b) => (b.__nbSessions - a.__nbSessions) || (new Date(a.created_at) - new Date(b.created_at)));
  const defautId = tri[0].id;
  return `
    <div class="carte" style="margin-bottom:10px;">
      <div style="font-weight:600;margin-bottom:6px;">${esc(groupe[0].prenom)} ${esc(groupe[0].nom)} — ${esc(groupe[0].clients?.raison_sociale || 'sans entreprise')}</div>
      ${groupe.map(s => `
        <label style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:13px;">
          <input type="radio" name="stg-doublon-${gi}" value="${s.id}" style="width:auto;margin-top:3px;" ${s.id === defautId ? 'checked' : ''}>
          <span>
            ${s.__nbSessions} session(s)${s.date_naissance ? ' · né(e) le ' + new Date(s.date_naissance).toLocaleDateString('fr-FR') : ''}${s.email ? ' · ' + esc(s.email) : ''}${s.telephone ? ' · ' + esc(s.telephone) : ''}
            <span style="color:#9aa5ab;"> — créée le ${new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
          </span>
        </label>`).join('')}
      <button class="bouton" style="margin-top:8px;" onclick="fusionnerGroupeDoublon(${gi})">Fusionner ce groupe</button>
    </div>`;
}

async function fusionnerGroupeDoublon(gi) {
  const groupe = (window.__groupesDoublonsStagiaires || [])[gi];
  if (!groupe) { toast('Groupe introuvable — recharge la page.', 'erreur'); return; }
  const survivant = document.querySelector(`input[name="stg-doublon-${gi}"]:checked`)?.value;
  if (!survivant) { toast('Choisis la fiche à conserver.', 'erreur'); return; }
  const doublons = groupe.map(s => s.id).filter(id => id !== survivant);
  if (!confirm(`Fusionner ${doublons.length} fiche(s) dans la fiche conservée ? Les sessions des fiches fusionnées seront reportées sur la fiche conservée, puis ces fiches seront supprimées. Cette action est irréversible.`)) return;

  const { error } = await supa.rpc('fusionner_stagiaires', { p_survivant: survivant, p_doublons: doublons });
  if (error) { DEBUG.erreur('fusionnerGroupeDoublon', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Fiches fusionnées.');
  ecranStagiaires($('#vue'));
}

// ============================================================================
// FICHE STAGIAIRE — coordonnées + (si existant) historique de sessions et
// statistiques (heures totales, formations suivies, suivi des recyclages).
// ============================================================================

async function ouvrirFicheStagiaire(id) {
  const zone = $('#stagiaire-fiche');
  zone.innerHTML = '<div class="carte">Chargement…</div>';
  zone.scrollIntoView({ behavior: 'smooth' });

  let stagiaire = null;
  if (id) {
    const { data } = await supa.from('stagiaires').select('*').eq('id', id).single();
    stagiaire = data;
  }

  const { data: clients } = await supa.from('clients').select('id, raison_sociale').order('raison_sociale');

  zone.innerHTML = `
    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">${stagiaire ? 'Modifier' : 'Nouveau'} stagiaire</h3>
      <div style="display:flex;gap:10px;">
        <div style="flex:0 0 110px;">
          <label for="stg-civilite">Civilité</label>
          <select id="stg-civilite">
            <option value="" ${!stagiaire?.civilite ? 'selected' : ''}>—</option>
            <option value="M." ${stagiaire?.civilite === 'M.' ? 'selected' : ''}>M.</option>
            <option value="Mme" ${stagiaire?.civilite === 'Mme' ? 'selected' : ''}>Mme</option>
          </select>
        </div>
        <div style="flex:1;"><label for="stg-prenom">Prénom</label><input id="stg-prenom" value="${stagiaire ? esc(stagiaire.prenom) : ''}"></div>
        <div style="flex:1;"><label for="stg-nom">Nom</label><input id="stg-nom" value="${stagiaire ? esc(stagiaire.nom) : ''}"></div>
      </div>
      <label for="stg-nom-naissance">Nom de naissance <span style="font-weight:normal;color:#55636c;">(si différent du nom ci-dessus — exigé par Passeport de prévention)</span></label>
      <input id="stg-nom-naissance" maxlength="30" value="${stagiaire ? esc(stagiaire.nom_naissance) : ''}">
      <label for="stg-client">Entreprise</label>
      <select id="stg-client">
        <option value="">—</option>
        ${(clients || []).map(c => `<option value="${c.id}" ${stagiaire?.client_id === c.id ? 'selected' : ''}>${esc(c.raison_sociale)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="stg-naissance">Date de naissance</label><input id="stg-naissance" type="date" value="${stagiaire?.date_naissance || ''}"></div>
        <div style="flex:1;"><label for="stg-lieu-naissance">Lieu de naissance</label><input id="stg-lieu-naissance" value="${stagiaire ? esc(stagiaire.lieu_naissance) : ''}"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="stg-email">Email</label><input id="stg-email" type="email" value="${stagiaire ? esc(stagiaire.email) : ''}"></div>
        <div style="flex:1;"><label for="stg-telephone">Téléphone</label><input id="stg-telephone" value="${stagiaire ? esc(stagiaire.telephone) : ''}"></div>
      </div>
      <label for="stg-notes">Notes</label>
      <textarea id="stg-notes" rows="2">${stagiaire ? esc(stagiaire.notes) : ''}</textarea>
      ${PEUT_GERER_SESSIONS() ? `
      <div id="stg-nir-bloc" style="margin-top:12px;padding:10px 12px;background:#f6f8f9;border:1px solid #dfe5e8;border-radius:8px;">
        <label for="stg-nir" style="margin-top:0;">N° de sécurité sociale (NIR) <span style="font-weight:normal;color:#55636c;">— stocké chiffré, jamais imprimé</span></label>
        <div id="stg-nir-etat" style="font-size:13px;margin-bottom:6px;"></div>
        <input id="stg-nir" autocomplete="off" placeholder="13 caractères (ou 15 avec la clé) — laisser vide pour ne rien changer" style="max-width:420px;">
        <div style="margin-top:6px;font-size:12px;">
          <a href="#" id="stg-nir-voir" style="display:none;">Afficher le NIR (consultation enregistrée)</a>
          <a href="#" id="stg-nir-effacer" style="display:none;margin-left:12px;color:#b3261e;">Effacer le NIR</a>
          ${['admin', 'super_admin'].includes(S.vision) && stagiaire ? '<a href="#" id="stg-nir-journal" style="margin-left:12px;">Journal d\'accès</a>' : ''}
        </div>
        <div id="stg-nir-journal-zone" style="font-size:12px;color:#55636c;margin-top:6px;"></div>
      </div>` : ''}
      <div style="margin-top:14px;">
        <button class="bouton" id="stg-valider">Enregistrer</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#stagiaire-fiche').innerHTML=''">Fermer</button>
      </div>
      <div class="erreur" id="stg-erreur"></div>
    </div>
    <div id="stg-stats"></div>`;

  if (stagiaire) chargerStatsStagiaire(stagiaire.id);
  if (PEUT_GERER_SESSIONS()) brancherNirStagiaire(stagiaire);

  $('#stg-valider').onclick = async () => {
    const payload = {
      civilite: $('#stg-civilite').value || null,
      prenom: $('#stg-prenom').value.trim(),
      nom: $('#stg-nom').value.trim(),
      client_id: $('#stg-client').value || null,
      date_naissance: $('#stg-naissance').value || null,
      lieu_naissance: $('#stg-lieu-naissance').value.trim() || null,
      nom_naissance: $('#stg-nom-naissance').value.trim() || null,
      email: $('#stg-email').value.trim() || null,
      telephone: $('#stg-telephone').value.trim() || null,
      notes: $('#stg-notes').value.trim() || null,
    };
    if (!payload.nom || !payload.prenom) { $('#stg-erreur').textContent = 'Nom et prénom obligatoires.'; return; }

    const bouton = $('#stg-valider');
    bouton.disabled = true;
    $('#stg-erreur').textContent = '';

    let idStagiaire = stagiaire?.id;
    if (idStagiaire) {
      const { error } = await supa.from('stagiaires').update(payload).eq('id', idStagiaire);
      if (error) { bouton.disabled = false; DEBUG.erreur('enregistrerStagiaire', error); $('#stg-erreur').textContent = 'Erreur : ' + error.message; return; }
    } else {
      const { data: cree, error } = await supa.from('stagiaires').insert({ ...payload, organisation_id: S.organisation.id }).select('id').single();
      if (error) { bouton.disabled = false; DEBUG.erreur('enregistrerStagiaire', error); $('#stg-erreur').textContent = 'Erreur : ' + error.message; return; }
      idStagiaire = cree.id;
      stagiaire = { id: idStagiaire };   // un nouveau clic sur Enregistrer met à jour au lieu de recréer
    }
    // NIR : enregistré à part (chiffré côté base), seulement s'il a été saisi.
    const saisieNir = $('#stg-nir')?.value.trim();
    if (saisieNir) {
      const { error: errNir } = await supa.rpc('nir_definir', { p_stagiaire: idStagiaire, p_nir: saisieNir });
      if (errNir) {
        bouton.disabled = false;
        DEBUG.erreur('nir_definir', errNir);
        $('#stg-erreur').textContent = 'Stagiaire enregistré, mais NIR refusé : ' + errNir.message;
        return;
      }
    }
    bouton.disabled = false;
    toast('Stagiaire enregistré.');
    if (payload.client_id && PEUT_GERER_SESSIONS() && typeof propagerDepuisStagiaire === 'function') await propagerDepuisStagiaire(idStagiaire, payload.client_id);
    ecranStagiaires($('#vue'));
  };
}

// Bloc NIR de la fiche : état (renseigné ou non), affichage à la demande
// (chaque consultation est enregistrée dans le journal), effacement, journal.
function brancherNirStagiaire(stagiaire) {
  const etat = $('#stg-nir-etat'), voir = $('#stg-nir-voir'), effacer = $('#stg-nir-effacer'), jr = $('#stg-nir-journal');
  const renseigne = !!stagiaire && window.__nirRenseignes?.has(stagiaire.id);
  etat.innerHTML = renseigne ? '<span style="color:#1a7f3c;">✔ NIR renseigné (masqué)</span>' : '<span style="color:#8a5a00;">NIR non renseigné</span>';
  if (renseigne) { voir.style.display = ''; effacer.style.display = ''; }
  if (voir) voir.onclick = async e => {
    e.preventDefault();
    const { data, error } = await supa.rpc('nir_lire', { p_stagiaire: stagiaire.id });
    if (error) { DEBUG.erreur('nir_lire', error); etat.textContent = 'Erreur : ' + error.message; return; }
    etat.innerHTML = '<strong style="letter-spacing:1px;">' + esc(data || '') + '</strong> <span style="color:#55636c;">(masqué dans 15 s)</span>';
    setTimeout(() => { if (etat.isConnected) etat.innerHTML = '<span style="color:#1a7f3c;">✔ NIR renseigné (masqué)</span>'; }, 15000);
  };
  if (effacer) effacer.onclick = async e => {
    e.preventDefault();
    if (!confirm('Effacer le NIR de ce stagiaire ?')) return;
    const { error } = await supa.rpc('nir_definir', { p_stagiaire: stagiaire.id, p_nir: '' });
    if (error) { DEBUG.erreur('nir_definir', error); etat.textContent = 'Erreur : ' + error.message; return; }
    window.__nirRenseignes.delete(stagiaire.id);
    toast('NIR effacé.');
    brancherNirStagiaire(stagiaire);
    voir.style.display = 'none'; effacer.style.display = 'none';
  };
  if (jr) jr.onclick = async e => {
    e.preventDefault();
    const zone = $('#stg-nir-journal-zone');
    zone.textContent = 'Chargement…';
    const { data, error } = await supa.rpc('nir_journal', { p_stagiaire: stagiaire.id, p_limite: 30 });
    if (error) { DEBUG.erreur('nir_journal', error); zone.textContent = 'Erreur : ' + error.message; return; }
    const lib = { lecture: 'consulté', ecriture: 'enregistré', suppression: 'effacé', export: 'exporté' };
    zone.innerHTML = (data || []).length
      ? (data || []).map(j => esc(new Date(j.created_at).toLocaleString('fr-FR') + ' — ' + (lib[j.action] || j.action) + ' par ' + j.utilisateur)).join('<br>')
      : 'Aucun accès enregistré.';
  };
}

async function chargerStatsStagiaire(stagiaireId) {
  const zone = $('#stg-stats');
  zone.innerHTML = '<div class="carte">Chargement des sessions…</div>';

  const { data, error } = await supa
    .from('session_participants')
    .select('id, statut, sessions_formation(id, numero_session, date_debut, lieu, statut, formations_catalogue(denomination, categorie, duree_heures, cycle_mois))')
    .eq('stagiaire_id', stagiaireId);

  if (error) { DEBUG.erreur('chargerStatsStagiaire', error); zone.innerHTML = '<div class="carte">Erreur de chargement des sessions.</div>'; return; }

  const inscriptions = (data || [])
    .filter(p => p.sessions_formation && p.sessions_formation.statut !== 'annulee')
    .map(p => ({
      sessionId: p.sessions_formation.id,
      date: p.sessions_formation.date_debut,
      lieu: p.sessions_formation.lieu,
      statutSession: p.sessions_formation.statut,
      denomination: p.sessions_formation.formations_catalogue?.denomination || 'Formation inconnue',
      categorie: p.sessions_formation.formations_catalogue?.categorie || 'Non catégorisé',
      heures: Number(p.sessions_formation.formations_catalogue?.duree_heures) || 0,
      cycleMois: p.sessions_formation.formations_catalogue?.cycle_mois || null,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!inscriptions.length) {
    zone.innerHTML = '<div class="carte"><h3 style="margin-top:0;">Sessions</h3><p style="color:#55636c;font-size:13px;">Aucune session pour ce stagiaire.</p></div>';
    return;
  }

  const totalSessions = inscriptions.length;
  const totalHeures = inscriptions.reduce((a, i) => a + i.heures, 0);
  const formationsDistinctes = new Set(inscriptions.map(i => i.denomination)).size;

  const parFormation = {};
  inscriptions.forEach(i => {
    if (!parFormation[i.denomination]) parFormation[i.denomination] = { label: i.denomination, sessions: 0, derniereDate: i.date, cycleMois: i.cycleMois };
    parFormation[i.denomination].sessions += 1;
    if (new Date(i.date) > new Date(parFormation[i.denomination].derniereDate)) parFormation[i.denomination].derniereDate = i.date;
  });
  const suiviFormations = Object.values(parFormation).sort((a, b) => new Date(b.derniereDate) - new Date(a.derniereDate));

  zone.innerHTML = `
    <div class="carte">
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        ${stgStatTuile('Sessions suivies', totalSessions)}
        ${stgStatTuile('Heures de formation', totalHeures)}
        ${stgStatTuile('Formations différentes', formationsDistinctes)}
      </div>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Suivi par formation</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${suiviFormations.map(f => {
          const echeance = f.cycleMois ? new Date(new Date(f.derniereDate).setMonth(new Date(f.derniereDate).getMonth() + f.cycleMois)) : null;
          return `
          <tr style="border-top:1px solid #eee;">
            <td style="padding:6px 8px;">${esc(f.label)}</td>
            <td style="padding:6px 8px;color:#55636c;text-align:right;">${f.sessions} session(s)</td>
            <td style="padding:6px 8px;color:#55636c;">dernière le ${new Date(f.derniereDate).toLocaleDateString('fr-FR')}</td>
            <td style="padding:6px 8px;color:#55636c;">${echeance ? 'recyclage attendu le ' + echeance.toLocaleDateString('fr-FR') : ''}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Sessions (${totalSessions})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${inscriptions.map(i => `
          <tr style="border-top:1px solid #eee;cursor:pointer;" onclick="ouvrirSession('${i.sessionId}')">
            <td style="padding:6px 8px;color:#55636c;white-space:nowrap;">${i.date ? new Date(i.date).toLocaleDateString('fr-FR') : ''}</td>
            <td style="padding:6px 8px;">${esc(i.denomination)}</td>
            <td style="padding:6px 8px;color:#55636c;">${esc(i.categorie)}</td>
            <td style="padding:6px 8px;color:#55636c;">${esc(i.lieu || '')}</td>
            <td style="padding:6px 8px;color:#55636c;text-align:right;">${i.heures ? i.heures + ' h' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function stgStatTuile(libelle, valeur) {
  return `<div>
    <div style="font-size:12px;color:#55636c;">${esc(libelle)}</div>
    <div style="font-size:28px;font-weight:600;color:#1c2b36;">${esc(String(valeur))}</div>
  </div>`;
}
