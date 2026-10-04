// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// espace_client_admin.js — côté équipe (admin / gestionnaire) de l'ESPACE CLIENT :
//   - gestion des accès clients dans la fiche client (création, mot de passe, désactivation) ;
//   - publication de documents dans l'espace client (PDF enregistrés dans le
//     bucket privé « documents », que le client retrouve dans son espace) ;
//   - suivi : pastilles « convention signée » / « informations Passeport » dans la
//     liste des sessions, le détail d'une session et le tableau de bord.
// La page utilisée par le client est espace-client.html (espace-client.js).

// ----------------------------------------------------------------------------
// Informations stagiaire nécessaires au Passeport de prévention
// ----------------------------------------------------------------------------
function infosPasseportManquantes(stagiaire, aNir) {
  const m = [];
  if (!aNir) m.push('NIR');
  if (!(stagiaire?.nom_naissance || '').trim()) m.push('nom de naissance');
  return m;
}

// Charge, pour les sessions des ~6 derniers mois et à venir, de quoi calculer les pastilles.
async function chargerSuiviEspaceClient() {
  const depuis = new Date(); depuis.setDate(depuis.getDate() - 180);
  const depuisIso = depuis.toISOString().slice(0, 10);
  const [{ data: parts, error: e1 }, { data: docs, error: e2 }, { data: sigs, error: e3 }, { data: nirIds, error: e4 }, { data: acces, error: e5 }] = await Promise.all([
    supa.from('session_participants')
      .select('session_id, client_id, stagiaire_id, stagiaires(nom, prenom, nom_naissance, client_id, clients(raison_sociale)), clients(raison_sociale), sessions_formation!inner(date_debut, statut, numero_session, formations_catalogue(denomination))')
      .gte('sessions_formation.date_debut', depuisIso)
      .neq('sessions_formation.statut', 'annulee'),
    supa.from('documents_generes').select('session_id, client_id, type').eq('publie_client', true).eq('type', 'convention'),
    supa.from('signatures_conventions').select('session_id, client_id, nom_signataire, signe_le'),
    supa.rpc('nir_renseignes'),
    supa.from('acces_clients').select('client_id, actif, derniere_connexion'),
  ]);
  const erreurs = [['participants', e1], ['documents publiés', e2], ['signatures', e3], ['NIR renseignés (fonction nir_renseignes)', e4], ['accès clients', e5]].filter(x => x[1]);
  if (erreurs.length) {
    DEBUG.erreur('chargerSuiviEspaceClient', erreurs.map(x => x[0] + ' : ' + x[1].message));
    window.__erreurEC = erreurs.map(x => x[0] + ' → ' + (x[1].message || x[1].code || 'erreur')).join(' | ');
    return null;
  }
  window.__erreurEC = null;

  const nir = new Set(nirIds || []);
  const publiees = new Set((docs || []).map(d => `${d.session_id}|${d.client_id}`));
  const signees = new Map((sigs || []).map(s => [`${s.session_id}|${s.client_id}`, s]));
  const accesParClient = new Map();
  (acces || []).forEach(a => {
    const e = accesParClient.get(a.client_id) || { nb: 0, actifs: 0, derniere: null };
    e.nb++; if (a.actif) e.actifs++;
    if (a.derniere_connexion && (!e.derniere || a.derniere_connexion > e.derniere)) e.derniere = a.derniere_connexion;
    accesParClient.set(a.client_id, e);
  });

  const sessions = new Map();   // session_id -> { clients: Map(client_id -> {...}) }
  (parts || []).forEach(p => {
    const s = sessions.get(p.session_id) || { session_id: p.session_id, date_debut: p.sessions_formation.date_debut,
      numero: p.sessions_formation.numero_session, formation: p.sessions_formation.formations_catalogue?.denomination, clients: new Map() };
    // entreprise de l'inscription, sinon celle de la fiche du stagiaire
    const clientEff = p.client_id || p.stagiaires?.client_id || null;
    const nomEff = p.clients?.raison_sociale || p.stagiaires?.clients?.raison_sociale || null;
    const cid = clientEff || '_sans_client';
    const c = s.clients.get(cid) || { client_id: clientEff, nom: nomEff || '(aucune entreprise — à corriger)',
      total: 0, incomplets: [], conv: 'non_publiee', signee: null };
    c.total++;
    const manque = infosPasseportManquantes(p.stagiaires, nir.has(p.stagiaire_id));
    if (manque.length) c.incomplets.push({ stagiaire_id: p.stagiaire_id, nom: `${p.stagiaires?.prenom || ''} ${p.stagiaires?.nom || ''}`.trim(), manque });
    const cle = `${p.session_id}|${clientEff}`;
    if (signees.has(cle)) { c.conv = 'signee'; c.signee = signees.get(cle); }
    else if (publiees.has(cle)) c.conv = 'a_signer';
    s.clients.set(cid, c);
    sessions.set(p.session_id, s);
  });

  // Résumé par session
  sessions.forEach(s => {
    const cl = [...s.clients.values()];
    s.total = cl.reduce((n, c) => n + c.total, 0);
    s.nbIncomplets = cl.reduce((n, c) => n + c.incomplets.length, 0);
    s.conv = cl.every(c => c.conv === 'signee') ? 'signee' : (cl.some(c => c.conv === 'non_publiee') ? 'non_publiee' : 'a_signer');
  });
  return { sessions, accesParClient };
}

// ----------------------------------------------------------------------------
// Pastilles
// ----------------------------------------------------------------------------
function pastilleConvention(statut, titre) {
  const def = {
    signee: ['#e6f4ea', '#1a7f3c', 'Convention signée'],
    a_signer: ['#fff4d6', '#8a5a00', 'Convention publiée, à signer'],
    non_publiee: ['#eceff1', '#55636c', 'Convention non publiée au client'],
  }[statut] || ['#eceff1', '#55636c', '—'];
  const libelle = { signee: 'Signée', a_signer: 'À signer', non_publiee: 'Non publiée' }[statut] || '—';
  return `<span title="${esc(titre || def[2])}" style="font-size:11px;background:${def[0]};color:${def[1]};border-radius:10px;padding:1px 8px;white-space:nowrap;">Conv. ${libelle}</span>`;
}

function pastilleInfosPasseport(total, incomplets, titre) {
  if (!total) return '';
  const ok = incomplets === 0;
  return `<span title="${esc(titre || (ok ? 'Informations Passeport complètes' : incomplets + ' stagiaire(s) à compléter (NIR, nom de naissance)'))}" style="font-size:11px;background:${ok ? '#e6f4ea' : '#fdeeee'};color:${ok ? '#1a7f3c' : '#b3261e'};border-radius:10px;padding:1px 8px;white-space:nowrap;">Passeport ${total - incomplets}/${total}</span>`;
}

// Cellule de la liste des sessions
function celluleEspaceClientSession(sessionId) {
  const suivi = window.__suiviEC;
  if (!suivi) return '<span style="color:#aab4ba;font-size:11px;">…</span>';
  const s = suivi.sessions.get(sessionId);
  if (!s) return '';
  return pastilleConvention(s.conv) + ' ' + pastilleInfosPasseport(s.total, s.nbIncomplets);
}

// ----------------------------------------------------------------------------
// Détail d'une session : carte « Espace client »
// ----------------------------------------------------------------------------
async function rendreSuiviEspaceClientSession(session) {
  const zone = $('#espace-client-session');
  if (!zone || !PEUT_GERER_SESSIONS()) return;
  zone.innerHTML = '<h3 style="margin-top:0;">Espace client</h3><p style="color:#55636c;font-size:13px;">Chargement…</p>';
  const suivi = await chargerSuiviEspaceClient();
  if (!suivi) { zone.innerHTML = '<h3 style="margin-top:0;">Espace client</h3><p class="erreur">Erreur de chargement : ' + esc(window.__erreurEC || 'inconnue') + '<br><span style="font-size:12px;">(le patch « espace client » du 05/10/2026 est-il appliqué ?)</span></p>'; return; }
  const s = suivi.sessions.get(session.id);
  if (!s) { zone.innerHTML = '<h3 style="margin-top:0;">Espace client</h3><p style="color:#55636c;font-size:13px;">Aucun stagiaire inscrit : rien à suivre pour le moment.</p>'; return; }

  const lignes = [...s.clients.values()].map(c => {
    const acces = c.client_id ? suivi.accesParClient.get(c.client_id) : null;
    const compte = !c.client_id ? '' : (!acces || !acces.actifs)
      ? '<span style="color:#8a5a00;">Aucun accès à l\'espace client — <a href="#" onclick="ouvrirFicheClientDepuisSession(\'' + c.client_id + '\');return false;">en créer un</a></span>'
      : (acces.derniere ? 'Dernière connexion : ' + new Date(acces.derniere).toLocaleDateString('fr-FR') : '<span style="color:#8a5a00;">Accès créé, jamais connecté</span>');
    const conv = c.conv === 'signee'
      ? `${pastilleConvention('signee')} <span style="font-size:12px;color:#55636c;">par ${esc(c.signee.nom_signataire)} le ${new Date(c.signee.signe_le).toLocaleString('fr-FR')}</span>`
      : pastilleConvention(c.conv);
    return `<div style="padding:8px 0;border-top:1px solid #eee;">
      <strong>${esc(c.nom)}</strong> ${conv} ${pastilleInfosPasseport(c.total, c.incomplets.length)}
      <div style="font-size:12px;color:#55636c;margin-top:4px;">${compte}</div>
      ${c.incomplets.length ? `<div style="font-size:12px;margin-top:4px;color:#b3261e;">À compléter : ${c.incomplets.map(i => esc(i.nom) + ' (' + i.manque.join(', ') + ')').join(' · ')}</div>` : ''}
    </div>`;
  }).join('');
  zone.innerHTML = `<h3 style="margin-top:0;">Espace client</h3>
    <p style="font-size:12px;color:#55636c;margin:0 0 6px;">Suivi de ce que chaque client a reçu et complété. Les documents se publient depuis « Téléchargement groupé et envoi au client » ci-dessous.</p>${lignes}`;
}

function ouvrirFicheClientDepuisSession(clientId) {
  allerA('clients');
  setTimeout(() => ouvrirFicheClient(clientId), 400);
}

// ----------------------------------------------------------------------------
// Tableau de bord : clients à relancer
// ----------------------------------------------------------------------------
async function chargerSuiviEspaceClientAccueil() {
  const zone = $('#db-espace-client');
  if (!zone) return;
  const suivi = await chargerSuiviEspaceClient();
  if (!suivi) { zone.innerHTML = '<p class="erreur">Erreur de chargement : ' + esc(window.__erreurEC || 'inconnue') + '<br><span style="font-size:12px;">(patch « espace client » appliqué ?)</span></p>'; return; }

  // Regroupe par client : stagiaires à compléter + conventions non signées.
  const parClient = new Map();
  suivi.sessions.forEach(s => s.clients.forEach(c => {
    const cle = c.client_id || '_';
    const e = parClient.get(cle) || { client_id: c.client_id, nom: c.nom, incomplets: 0, total: 0, sessions: [], convA: 0, convNon: 0 };
    e.incomplets += c.incomplets.length; e.total += c.total;
    if (c.conv === 'a_signer') e.convA++;
    if (c.conv === 'non_publiee') e.convNon++;
    if (c.incomplets.length || c.conv !== 'signee') e.sessions.push(s);
    parClient.set(cle, e);
  }));
  const lignes = [...parClient.values()].filter(e => e.incomplets > 0 || e.convA > 0).sort((a, b) => b.incomplets - a.incomplets);

  if (!lignes.length) { zone.innerHTML = '<p style="color:#1a7f3c;">Rien à relancer : informations Passeport complètes et conventions publiées signées.</p>'; return; }
  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
      <th style="padding:6px 8px;">Client</th><th style="padding:6px 8px;">Passeport à compléter</th>
      <th style="padding:6px 8px;">Conventions à signer</th><th style="padding:6px 8px;">Espace client</th>
    </tr></thead><tbody>${lignes.map(e => {
      const acces = e.client_id ? suivi.accesParClient.get(e.client_id) : null;
      const compte = !e.client_id ? '—' : (!acces || !acces.actifs) ? '<span style="color:#b3261e;">Pas d\'accès créé</span>'
        : (acces.derniere ? 'Connecté le ' + new Date(acces.derniere).toLocaleDateString('fr-FR') : '<span style="color:#8a5a00;">Jamais connecté</span>');
      const premiere = e.sessions[0];
      return `<tr style="border-top:1px solid #eee;cursor:pointer;" onclick="ouvrirSession('${premiere.session_id}')" title="Ouvrir la session ${esc(premiere.numero || '')}">
        <td style="padding:6px 8px;"><strong>${esc(e.nom)}</strong><div style="font-size:11px;color:#55636c;">${new Set(e.sessions.map(s => s.session_id)).size} session(s)</div></td>
        <td style="padding:6px 8px;">${e.incomplets ? `<span style="color:#b3261e;font-weight:600;">${e.incomplets}</span> / ${e.total} stagiaire(s)` : '<span style="color:#1a7f3c;">Complet</span>'}</td>
        <td style="padding:6px 8px;">${e.convA ? `<span style="color:#8a5a00;font-weight:600;">${e.convA}</span>` : '—'}</td>
        <td style="padding:6px 8px;font-size:13px;">${compte}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// ----------------------------------------------------------------------------
// Fiche client : gestion des accès à l'espace client
// ----------------------------------------------------------------------------
function urlEspaceClient() {
  return new URL('espace-client.html', window.location.href.split('#')[0]).href;
}

async function rendreAccesClient(client, contacts) {
  const zone = $('#acces-client-zone');
  if (!zone) return;
  const { data, error } = await supa.from('acces_clients').select('*').eq('client_id', client.id).order('created_at');
  if (error) { DEBUG.erreur('rendreAccesClient', error); zone.innerHTML = '<p class="erreur">Erreur de chargement : ' + esc(error.message) + '</p>'; return; }
  const liste = (data || []).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid #eee;font-size:13px;${a.actif ? '' : 'opacity:.55;'}">
      <span><strong>${esc(a.prenom || '')} ${esc(a.nom || '')}</strong>${a.fonction ? ' — ' + esc(a.fonction) : ''}<br>
        <span style="color:#55636c;">${esc(a.email || '')} · ${a.derniere_connexion ? 'dernière connexion ' + new Date(a.derniere_connexion).toLocaleDateString('fr-FR') : 'jamais connecté'}</span></span>
      <span>
        <button class="bouton" style="padding:3px 8px;font-size:11px;" onclick="reinitialiserAccesClient('${a.user_id}','${client.id}')">Nouveau mot de passe</button>
        <button class="bouton" style="padding:3px 8px;font-size:11px;background:#eee;color:#333;" onclick="basculerAccesClient('${a.user_id}',${!a.actif},'${client.id}')">${a.actif ? 'Désactiver' : 'Réactiver'}</button>
      </span>
    </div>`).join('') || '<p style="color:#55636c;font-size:13px;margin:0;">Aucun accès pour ce client.</p>';
  window.__clientAccesContacts = contacts || [];
  zone.innerHTML = `
    <p style="font-size:12px;color:#55636c;margin:0 0 6px;">Le client se connecte avec son email et un mot de passe sur la page « ${esc(urlEspaceClient())} » : il y retrouve les documents que tu publies, signe sa convention et complète les informations de ses stagiaires.</p>
    ${liste}
    <details style="margin-top:10px;"><summary style="cursor:pointer;font-size:13px;color:#0a5c8a;">+ Créer un accès</summary>
      <div style="margin-top:8px;">
        <label for="ac-email">Email du client</label>
        <input id="ac-email" type="email" list="ac-contacts">
        <datalist id="ac-contacts">${(contacts || []).filter(c => c.email).map(c => `<option value="${esc(c.email)}">${esc(c.prenom || '')} ${esc(c.nom || '')}</option>`).join('')}</datalist>
        <div style="display:flex;gap:10px;">
          <div style="flex:1;"><label for="ac-prenom">Prénom</label><input id="ac-prenom"></div>
          <div style="flex:1;"><label for="ac-nom">Nom</label><input id="ac-nom"></div>
          <div style="flex:1;"><label for="ac-fonction">Fonction</label><input id="ac-fonction"></div>
        </div>
        <button class="bouton" id="ac-creer" style="margin-top:10px;" onclick="creerAccesClient('${client.id}')">Créer l'accès</button>
        <div class="erreur" id="ac-erreur"></div>
      </div>
    </details>
    <div id="ac-resultat"></div>`;
  const champEmail = $('#ac-email');
  if (champEmail) champEmail.onchange = () => {
    const c = (window.__clientAccesContacts || []).find(x => (x.email || '').toLowerCase() === champEmail.value.trim().toLowerCase());
    if (c) { $('#ac-prenom').value = c.prenom || ''; $('#ac-nom').value = c.nom || ''; $('#ac-fonction').value = c.fonction || ''; }
  };
}

async function appelerFonctionAccesClient(corps) {
  const { data: { session } } = await supa.auth.getSession();
  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/creer-acces-client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json();
  if (!reponse.ok || resultat.error) throw new Error(resultat.error || 'Erreur inconnue.');
  return resultat;
}

function afficherMotDePasseClient(motDePasse, email) {
  $('#ac-resultat').innerHTML = `
    <div class="carte" style="background:#eef6fb;border-color:#0a5c8a;margin-top:10px;">
      <p style="margin:0;font-size:13px;">Identifiant : <strong>${esc(email || '')}</strong><br>Mot de passe provisoire : <strong>${esc(motDePasse)}</strong></p>
      <p style="margin:6px 0 0;font-size:12px;color:#55636c;">Page de connexion : ${esc(urlEspaceClient())}<br>Il ne s'affiche qu'une fois : transmets-le au client (il peut aussi cliquer sur « Mot de passe oublié » pour en choisir un).</p>
    </div>`;
}

async function creerAccesClient(clientId) {
  const email = $('#ac-email').value.trim();
  if (!email) { $('#ac-erreur').textContent = 'Email obligatoire.'; return; }
  const bouton = $('#ac-creer'); bouton.disabled = true; $('#ac-erreur').textContent = '';
  try {
    const r = await appelerFonctionAccesClient({ action: 'creer', client_id: clientId, email,
      prenom: $('#ac-prenom').value.trim(), nom: $('#ac-nom').value.trim(), fonction: $('#ac-fonction').value.trim() });
    toast('Accès client créé.');
    const { data: contacts } = await supa.from('contacts_client').select('*').eq('client_id', clientId);
    await rendreAccesClient({ id: clientId }, contacts);
    afficherMotDePasseClient(r.mot_de_passe_provisoire, email);
  } catch (e) {
    bouton.disabled = false; DEBUG.erreur('creerAccesClient', e);
    $('#ac-erreur').textContent = 'Erreur : ' + e.message;
  }
}

async function reinitialiserAccesClient(userId, clientId) {
  if (!confirm('Générer un nouveau mot de passe provisoire pour cet accès ? L\'ancien ne fonctionnera plus.')) return;
  try {
    const r = await appelerFonctionAccesClient({ action: 'reinitialiser', user_id: userId });
    afficherMotDePasseClient(r.mot_de_passe_provisoire, '(voir ci-dessus)');
  } catch (e) { DEBUG.erreur('reinitialiserAccesClient', e); toast('Erreur : ' + e.message, 'erreur'); }
}

async function basculerAccesClient(userId, actif, clientId) {
  const { error } = await supa.from('acces_clients').update({ actif }).eq('user_id', userId);
  if (error) { DEBUG.erreur('basculerAccesClient', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  const { data: contacts } = await supa.from('contacts_client').select('*').eq('client_id', clientId);
  rendreAccesClient({ id: clientId }, contacts);
}

// ----------------------------------------------------------------------------
// Publication de documents dans l'espace client
// ----------------------------------------------------------------------------
function nomFichierStockage(nom) {
  return String(nom || 'document.pdf').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
}

async function publierSelectionEspaceClient() {
  const selection = documentsSelectionnes();
  if (!selection.length) { toast('Sélectionne au moins un document à publier.', 'erreur'); return; }
  const session = window.__sessionCourante;
  const sansClient = selection.filter(d => !(d.client_id || session.client_id));
  if (sansClient.length) { toast('Certains documents n\'ont pas de client rattaché : ' + sansClient.map(d => d.libelle).join(', '), 'erreur'); return; }
  if (!confirm(`Publier ${selection.length} document(s) dans l'espace client ? Le client pourra les consulter et les télécharger.`)) return;

  const zone = $('#envoi-zone');
  zone.innerHTML = '<div class="carte" style="margin-bottom:0;">Publication en cours…</div>';
  try {
    // Feuilles d'émargement : version signée si des signatures existent.
    const { data: emarg } = await supa.from('emargements').select('*').eq('session_id', session.id);
    window.__emargementsSession = emarg || [];

    // Conventions déjà signées : on ne les remplace pas.
    const { data: dejaSignees } = await supa.from('signatures_conventions').select('client_id').eq('session_id', session.id);
    const clientsSignes = new Set((dejaSignees || []).map(s => s.client_id));

    let publies = 0; const ignores = [];
    for (const desc of selection) {
      const clientId = desc.client_id || session.client_id;
      if (desc.type === 'convention' && clientsSignes.has(clientId)) { ignores.push(desc.libelle + ' (déjà signée)'); continue; }

      const { doc, nomFichier } = desc.genere(true);
      const chemin = `${S.organisation.id}/${session.id}/publies/${Date.now()}_${nomFichierStockage(nomFichier)}`;
      const { error: upErr } = await supa.storage.from('documents').upload(chemin, doc.output('blob'), { contentType: 'application/pdf', upsert: true });
      if (upErr) throw new Error(`Dépôt de « ${nomFichier} » : ${upErr.message}`);

      // L'ancienne version publiée du même document est retirée de l'espace client.
      let ancien = supa.from('documents_generes').update({ publie_client: false })
        .eq('session_id', session.id).eq('client_id', clientId).eq('type', desc.type).eq('publie_client', true);
      ancien = desc.participant ? ancien.eq('stagiaire_id', desc.participant.stagiaire_id) : ancien.is('stagiaire_id', null);
      await ancien;

      const { error: insErr } = await supa.from('documents_generes').insert({
        organisation_id: S.organisation.id, session_id: session.id, client_id: clientId,
        stagiaire_id: desc.participant ? desc.participant.stagiaire_id : null,
        type: desc.type, storage_path: chemin, genere_par: S.profil.id,
        publie_client: true, publie_le: new Date().toISOString(),
      });
      if (insErr) throw new Error(`Enregistrement de « ${nomFichier} » : ${insErr.message}`);
      publies++;
    }
    zone.innerHTML = `<div class="carte" style="background:#e6f4ea;border-color:#1a7f3c;margin-bottom:0;">${publies} document(s) publié(s) dans l'espace client.${ignores.length ? '<br><span style="font-size:12px;">Non republié : ' + ignores.map(esc).join(', ') + '</span>' : ''}</div>`;
    toast(`${publies} document(s) publié(s).`);
    rendreSuiviEspaceClientSession(session);
  } catch (e) {
    DEBUG.erreur('publierSelectionEspaceClient', e);
    zone.innerHTML = `<div class="carte" style="margin-bottom:0;"><p class="erreur">Erreur : ${esc(e.message)}</p></div>`;
  }
}
