// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// rattachements.js — écran « Rattachements à corriger » : stagiaires (et inscriptions)
// sans entreprise. Les corrections se font surtout PAR SESSION : renseigner le client
// d'une session le propage à ses stagiaires. Règles : on ne remplit que les valeurs
// vides, jamais on ne remplace un client existant ; aperçu avant validation ; journal et
// annulation de chaque lot (voir patch_2026-10-05d_rattachements_clients.sql).

// ----------------------------------------------------------------------------
// Analyse (fonction pure, sans accès base : facile à tester)
// ----------------------------------------------------------------------------
// stagiaires : stagiaires sans client ; participants : leurs inscriptions ;
// sessions : sessions concernées (avec session_clients) ; clients : tous les clients.
function rtAnalyser({ stagiaires, participants, sessions, clients, participantsSessionsSansClient }) {
  const sessMap = new Map((sessions || []).map(s => [s.id, s]));
  const cliNom = new Map((clients || []).map(c => [c.id, c.raison_sociale]));
  const clientsDeSession = s => {
    const ids = new Set((s.session_clients || []).map(x => x.client_id));
    if (!ids.size && s.client_id) ids.add(s.client_id);
    return [...ids];
  };
  const partsParStag = new Map();
  (participants || []).forEach(p => { (partsParStag.get(p.stagiaire_id) || partsParStag.set(p.stagiaire_id, []).get(p.stagiaire_id)).push(p); });

  const res = { evident: [], conflit: [], choisir: [], sessionsSansClient: new Map(), orphelins: [], cliNom };
  const ajouterSessionSansClient = (s, st, p) => {
    const g = res.sessionsSansClient.get(s.id) || { session: s, stagiaires: new Map() };
    if (st) g.stagiaires.set(st.id, { st, participant: p });
    res.sessionsSansClient.set(s.id, g);
  };

  for (const st of stagiaires || []) {
    const ps = partsParStag.get(st.id) || [];
    if (!ps.length) { res.orphelins.push(st); continue; }
    const lignes = ps.map(p => {
      const s = sessMap.get(p.session_id);
      const cs = s ? clientsDeSession(s) : [];
      return { p, s, cs, client: p.client_id || (cs.length === 1 ? cs[0] : null) };
    });
    lignes.forEach(l => { if (l.s && l.cs.length === 0) ajouterSessionSansClient(l.s, st, l.p); });

    const R = new Set(lignes.filter(l => l.client).map(l => l.client));
    const parDate = [...lignes].filter(l => l.client).sort((a, b) => String(b.s?.date_debut || '').localeCompare(String(a.s?.date_debut || '')));
    if (R.size === 1) {
      const client = [...R][0];
      const actions = [{ type: 'stagiaire', stagiaire_id: st.id, client_id: client }];
      lignes.forEach(l => { if (!l.p.client_id && (l.client === client || l.cs.includes(client))) actions.push({ type: 'participant', participant_id: l.p.id, client_id: client }); });
      res.evident.push({ st, client, actions, lignes });
    } else if (R.size > 1) {
      const actions = [];
      lignes.forEach(l => { if (!l.p.client_id && l.client) actions.push({ type: 'participant', participant_id: l.p.id, client_id: l.client }); });
      res.conflit.push({ st, clients: [...R], suggestion: parDate[0]?.client || null, actions, lignes });
    } else if (!lignes.some(l => l.s && l.cs.length === 0)) {
      res.choisir.push({ st, lignes });
    }
  }

  // Suggestion de client pour chaque session sans client (d'après ses stagiaires déjà rattachés)
  res.sessionsSansClient.forEach((g, sid) => {
    const vus = new Map();
    (participantsSessionsSansClient || []).filter(x => x.session_id === sid).forEach(x => {
      const c = x.client_id || x.stagiaires?.client_id;
      if (c) vus.set(c, (vus.get(c) || 0) + 1);
    });
    g.clientsConnus = [...vus.keys()];
    g.suggestion = vus.size === 1 ? [...vus.keys()][0] : null;
    g.total = (participantsSessionsSansClient || []).filter(x => x.session_id === sid).length || g.stagiaires.size;
  });
  return res;
}

// ----------------------------------------------------------------------------
// Chargement
// ----------------------------------------------------------------------------
async function rtParLots(table, colonne, ids, selection, taille) {
  const out = [];
  for (let i = 0; i < ids.length; i += (taille || 60)) {
    const { data, error } = await supa.from(table).select(selection).in(colonne, ids.slice(i, i + (taille || 60)));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

async function rtCharger() {
  const { data: stagiaires, error: e1 } = await supa.from('stagiaires').select('id, nom, prenom, email').is('client_id', null).order('nom').limit(3000);
  if (e1) throw e1;
  const ids = (stagiaires || []).map(s => s.id);
  const participants = await rtParLots('session_participants', 'stagiaire_id', ids, 'id, session_id, stagiaire_id, client_id');
  const sessIds = [...new Set(participants.map(p => p.session_id))];
  const sessions = await rtParLots('sessions_formation', 'id', sessIds, 'id, numero_session, date_debut, client_id, formations_catalogue(denomination), session_clients(client_id)');
  const { data: clients, error: e2 } = await supa.from('clients').select('id, raison_sociale').order('raison_sociale').limit(3000);
  if (e2) throw e2;
  const sansClient = sessions.filter(s => !(s.session_clients || []).length && !s.client_id).map(s => s.id);
  const participantsSessionsSansClient = sansClient.length
    ? await rtParLots('session_participants', 'session_id', sansClient, 'id, session_id, stagiaire_id, client_id, stagiaires(client_id)') : [];
  return { stagiaires: stagiaires || [], participants, sessions, clients: clients || [], participantsSessionsSansClient };
}

// ----------------------------------------------------------------------------
// Affichage
// ----------------------------------------------------------------------------
async function compterStagiairesSansClient() {
  const { count, error } = await supa.from('stagiaires').select('id', { count: 'exact', head: true }).is('client_id', null);
  return error ? 0 : (count || 0);
}

function bandeauRattachements(n) {
  if (!n) return '';
  return `<div class="carte" style="background:#fff9e8;border-color:#e6c76a;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
    <span><strong>${n}</strong> stagiaire(s) ne sont rattachés à aucune entreprise (ils n'apparaîtront pas dans l'espace client ni sur les conventions).</span>
    <button class="bouton" onclick="ouvrirRattachements()">Corriger les rattachements</button></div>
    <div id="rattachements-zone"></div>`;
}

function rtOptionsClients(clients, selectionne) {
  return '<option value="">— choisir une entreprise —</option>' +
    clients.map(c => `<option value="${esc(c.id)}" ${c.id === selectionne ? 'selected' : ''}>${esc(c.raison_sociale)}</option>`).join('');
}
const rtSessionLibelle = s => `${esc(s?.numero_session || '')} ${s?.date_debut ? formatDateFr(s.date_debut) : ''} — ${esc(s?.formations_catalogue?.denomination || '')}`.trim();

async function ouvrirRattachements() {
  let zone = $('#rattachements-zone');
  if (!zone) { zone = document.createElement('div'); zone.id = 'rattachements-zone'; ($('#vue') || document.body).prepend(zone); }
  zone.innerHTML = '<div class="carte">Analyse des rattachements…</div>';
  zone.scrollIntoView({ behavior: 'smooth' });
  let donnees;
  try { donnees = await rtCharger(); } catch (e) { DEBUG.erreur('rtCharger', e); zone.innerHTML = `<div class="carte"><p class="erreur">Erreur : ${esc(e.message || e)}</p></div>`; return; }
  const r = rtAnalyser(donnees);
  window.__rt = { r, clients: donnees.clients, donnees };

  const nbSess = r.sessionsSansClient.size;
  const total = donnees.stagiaires.length;
  const { data: lots } = await supa.from('rattachements_lots').select('*').order('created_at', { ascending: false }).limit(8);

  const ligneEvident = (x, i) => `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:5px 8px;"><input type="checkbox" class="rt-ev" data-i="${i}" checked style="width:auto;"></td>
      <td style="padding:5px 8px;">${esc(x.st.prenom)} ${esc(x.st.nom)}</td>
      <td style="padding:5px 8px;font-size:12px;color:#55636c;">${x.lignes.map(l => rtSessionLibelle(l.s)).join('<br>')}</td>
      <td style="padding:5px 8px;"><strong>${esc(r.cliNom.get(x.client) || '?')}</strong></td></tr>`;

  zone.innerHTML = `
    <div class="carte">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <h3 style="margin:0;">Rattachements à corriger — ${total} stagiaire(s) sans entreprise</h3>
        <button class="bouton" style="background:#eee;color:#333;" onclick="$('#rattachements-zone').innerHTML=''">Fermer</button>
      </div>
      <p style="font-size:13px;color:#55636c;">L'appli ne remplit que les cases vides : une entreprise déjà renseignée n'est jamais remplacée. Chaque lot appliqué est enregistré et peut être annulé.</p>
      <ul style="font-size:13px;margin:6px 0 0;padding-left:18px;">
        <li><strong>${r.evident.length}</strong> cas évident(s) : toutes ses sessions pointent vers la même entreprise</li>
        <li><strong>${nbSess}</strong> session(s) sans entreprise (à renseigner une fois pour tous leurs stagiaires)</li>
        <li><strong>${r.choisir.length}</strong> stagiaire(s) dans une session à plusieurs entreprises (à choisir)</li>
        <li><strong>${r.conflit.length}</strong> stagiaire(s) venus pour plusieurs entreprises différentes</li>
        <li><strong>${r.orphelins.length}</strong> stagiaire(s) sans aucune session</li>
      </ul>
    </div>

    ${r.evident.length ? `<div class="carte"><h3 style="margin-top:0;">1. Propositions évidentes (${r.evident.length})</h3>
      <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${r.evident.map(ligneEvident).join('')}</tbody></table></div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="bouton" style="background:#eee;color:#333;font-size:13px;" onclick="document.querySelectorAll('.rt-ev').forEach(c=>c.checked=true)">Tout cocher</button>
        <button class="bouton" style="background:#eee;color:#333;font-size:13px;" onclick="document.querySelectorAll('.rt-ev').forEach(c=>c.checked=false)">Tout décocher</button>
        <button class="bouton" onclick="rtAppliquerEvidents()">Aperçu et application</button></div></div>` : ''}

    ${nbSess ? `<div class="carte"><h3 style="margin-top:0;">2. Sessions sans entreprise (${nbSess})</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Choisis l'entreprise de la session : elle sera ajoutée à la session, puis rattachée à toutes ses inscriptions et à ses stagiaires sans entreprise.</p>
      ${[...r.sessionsSansClient.values()].map((g, i) => `
        <div style="padding:8px 0;border-top:1px solid #eee;">
          <strong>${rtSessionLibelle(g.session)}</strong> <span style="font-size:12px;color:#55636c;">· ${g.stagiaires.size} stagiaire(s) sans entreprise : ${[...g.stagiaires.values()].slice(0, 6).map(x => esc(x.st.prenom + ' ' + x.st.nom)).join(', ')}${g.stagiaires.size > 6 ? '…' : ''}</span>
          ${g.clientsConnus.length > 1 ? `<div style="font-size:12px;color:#8a5a00;">Attention : les stagiaires déjà rattachés de cette session viennent de ${g.clientsConnus.length} entreprises différentes (${g.clientsConnus.map(c => esc(r.cliNom.get(c) || '?')).join(', ')}).</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
            <select class="rt-sess" data-sid="${esc(g.session.id)}" style="flex:1;min-width:220px;">${rtOptionsClients(donnees.clients, g.suggestion)}</select>
          </div></div>`).join('')}
      <div style="margin-top:10px;"><button class="bouton" onclick="rtAppliquerSessions()">Aperçu et application</button></div></div>` : ''}

    ${r.choisir.length ? `<div class="carte"><h3 style="margin-top:0;">3. Session à plusieurs entreprises — à choisir (${r.choisir.length})</h3>
      ${r.choisir.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-top:1px solid #eee;font-size:13px;">
        <span style="flex:1;min-width:180px;"><strong>${esc(x.st.prenom)} ${esc(x.st.nom)}</strong><br><span style="font-size:12px;color:#55636c;">${x.lignes.map(l => rtSessionLibelle(l.s)).join('<br>')}</span></span>
        <select class="rt-choisir" data-i="${i}" style="flex:1;min-width:220px;">${rtOptionsClients(donnees.clients, null)}</select></div>`).join('')}
      <div style="margin-top:10px;"><button class="bouton" onclick="rtAppliquerChoisir()">Aperçu et application</button></div></div>` : ''}

    ${r.conflit.length ? `<div class="carte"><h3 style="margin-top:0;">4. Plusieurs entreprises différentes (${r.conflit.length})</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Ces stagiaires ont suivi des sessions pour des entreprises différentes (intérimaire, mutation…). Leurs inscriptions seront rattachées à l'entreprise de chaque session ; choisis en plus l'entreprise « principale » de la fiche (la plus récente est proposée).</p>
      ${r.conflit.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-top:1px solid #eee;font-size:13px;">
        <span style="flex:1;min-width:180px;"><strong>${esc(x.st.prenom)} ${esc(x.st.nom)}</strong><br><span style="font-size:12px;color:#55636c;">${x.clients.map(c => esc(r.cliNom.get(c) || '?')).join(' · ')}</span></span>
        <select class="rt-conflit" data-i="${i}" style="flex:1;min-width:220px;">${rtOptionsClients(donnees.clients.filter(c => x.clients.includes(c.id)), x.suggestion)}</select></div>`).join('')}
      <div style="margin-top:10px;"><button class="bouton" onclick="rtAppliquerConflits()">Aperçu et application</button></div></div>` : ''}

    ${r.orphelins.length ? `<div class="carte"><h3 style="margin-top:0;">5. Stagiaires sans aucune session (${r.orphelins.length})</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Souvent des doublons ou des fiches de test : vérifie avec l'outil de détection des doublons de l'écran Stagiaires, ou rattache-les à la main.</p>
      ${r.orphelins.map((st, i) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-top:1px solid #eee;font-size:13px;">
        <span style="flex:1;min-width:180px;"><strong>${esc(st.prenom)} ${esc(st.nom)}</strong> <span style="color:#55636c;">${esc(st.email || '')}</span></span>
        <select class="rt-orph" data-i="${i}" style="flex:1;min-width:220px;">${rtOptionsClients(donnees.clients, null)}</select></div>`).join('')}
      <div style="margin-top:10px;"><button class="bouton" onclick="rtAppliquerOrphelins()">Aperçu et application</button></div></div>` : ''}

    ${total === 0 ? '<div class="carte"><p class="ok" style="color:#1a7f3c;margin:0;">Tous les stagiaires sont rattachés à une entreprise.</p></div>' : ''}

    <div class="carte"><h3 style="margin-top:0;">Historique des corrections</h3>
      ${(lots || []).length ? (lots || []).map(l => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-top:1px solid #eee;font-size:13px;${l.annule ? 'opacity:.55;' : ''}">
        <span>${new Date(l.created_at).toLocaleString('fr-FR')} — ${l.nb_stagiaires} stagiaire(s), ${l.nb_inscriptions} inscription(s), ${l.nb_sessions} session(s)${l.annule ? ' <em>(annulé)</em>' : ''}</span>
        ${l.annule ? '' : `<button class="bouton" style="padding:3px 10px;font-size:12px;background:#fdeeee;color:#b3261e;" onclick="rtAnnulerLot('${l.id}')">Annuler ce lot</button>`}</div>`).join('') : '<p style="font-size:13px;color:#55636c;margin:0;">Aucune correction effectuée pour le moment.</p>'}
    </div>`;
}

// ----------------------------------------------------------------------------
// Application
// ----------------------------------------------------------------------------
async function rtAppliquer(actions, intitule) {
  const vus = new Set();
  actions = actions.filter(a => { const k = JSON.stringify(a); if (vus.has(k)) return false; vus.add(k); return true; });
  if (!actions.length) { toast('Rien à appliquer.', 'erreur'); return; }
  const n = t => actions.filter(a => a.type === t).length;
  const apercu = `${intitule}\n\n• ${n('stagiaire')} fiche(s) stagiaire à rattacher\n• ${n('participant')} inscription(s) à rattacher\n• ${n('session_client')} session(s) recevront une entreprise\n\nSeules les cases vides sont remplies. Confirmer ?`;
  if (!confirm(apercu)) return;
  const { data, error } = await supa.rpc('appliquer_rattachements', { p_actions: actions });
  if (error) { DEBUG.erreur('appliquer_rattachements', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast(`Appliqué : ${data.stagiaires} stagiaire(s), ${data.inscriptions} inscription(s), ${data.sessions} session(s)` + (data.ignores ? ` (${data.ignores} ignoré(s))` : ''));
  await ouvrirRattachements();
  if (typeof ecranStagiaires === 'function' && $('#stagiaires-liste')) { /* la liste se rafraîchit à la prochaine ouverture */ }
}

function rtAppliquerEvidents() {
  const { r } = window.__rt;
  const actions = [];
  document.querySelectorAll('.rt-ev:checked').forEach(c => actions.push(...r.evident[Number(c.dataset.i)].actions));
  rtAppliquer(actions, 'Rattachements évidents');
}

function rtAppliquerSessions() {
  const { r } = window.__rt;
  const actions = [];
  document.querySelectorAll('.rt-sess').forEach(sel => {
    if (!sel.value) return;
    const g = r.sessionsSansClient.get(sel.dataset.sid);
    actions.push({ type: 'session_client', session_id: g.session.id, client_id: sel.value });
    g.stagiaires.forEach(({ st, participant }) => {
      actions.push({ type: 'participant', participant_id: participant.id, client_id: sel.value });
      actions.push({ type: 'stagiaire', stagiaire_id: st.id, client_id: sel.value });
    });
    // les autres inscriptions de la session encore sans entreprise
    // (uniquement si leur fiche n'a pas déjà une autre entreprise)
    (window.__rt.donnees.participantsSessionsSansClient || [])
      .filter(x => x.session_id === g.session.id && !x.client_id && (!x.stagiaires?.client_id || x.stagiaires.client_id === sel.value))
      .forEach(x => actions.push({ type: 'participant', participant_id: x.id, client_id: sel.value }));
  });
  rtAppliquer(actions, 'Entreprise des sessions');
}

function rtAppliquerChoisir() {
  const { r } = window.__rt;
  const actions = [];
  document.querySelectorAll('.rt-choisir').forEach(sel => {
    if (!sel.value) return;
    const x = r.choisir[Number(sel.dataset.i)];
    actions.push({ type: 'stagiaire', stagiaire_id: x.st.id, client_id: sel.value });
    x.lignes.forEach(l => { if (!l.p.client_id) actions.push({ type: 'participant', participant_id: l.p.id, client_id: sel.value }); });
  });
  rtAppliquer(actions, 'Choix de l\'entreprise');
}

function rtAppliquerConflits() {
  const { r } = window.__rt;
  const actions = [];
  document.querySelectorAll('.rt-conflit').forEach(sel => {
    const x = r.conflit[Number(sel.dataset.i)];
    actions.push(...x.actions);
    if (sel.value) actions.push({ type: 'stagiaire', stagiaire_id: x.st.id, client_id: sel.value });
  });
  rtAppliquer(actions, 'Stagiaires multi-entreprises');
}

function rtAppliquerOrphelins() {
  const { r } = window.__rt;
  const actions = [];
  document.querySelectorAll('.rt-orph').forEach(sel => {
    if (sel.value) actions.push({ type: 'stagiaire', stagiaire_id: r.orphelins[Number(sel.dataset.i)].id, client_id: sel.value });
  });
  rtAppliquer(actions, 'Stagiaires sans session');
}

async function rtAnnulerLot(id) {
  if (!confirm('Annuler ce lot de corrections ? Les valeurs qui ont été modifiées depuis ne seront pas touchées.')) return;
  const { data, error } = await supa.rpc('annuler_lot_rattachements', { p_lot: id });
  if (error) { DEBUG.erreur('annuler_lot_rattachements', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast(`Lot annulé : ${data.annulees} correction(s) défaite(s)` + (data.conservees ? `, ${data.conservees} conservée(s) car modifiée(s) depuis` : ''));
  ouvrirRattachements();
}
