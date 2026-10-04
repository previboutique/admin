// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// espace-client.js — espace du client (commanditaire de formation).
// Connexion email + mot de passe ; le client n'a AUCUN accès direct aux tables :
// tout passe par les fonctions SQL client_* (voir patch_2026-10-05c_espace_client.sql),
// qui vérifient à chaque appel que les données appartiennent à SON entreprise.
// Console : message de copyright ci-dessous.
console.log('%c© 2026 Jérémy Bizeul / SARL Prévisecours — Tous droits réservés', 'color:#0a5c8a');

const SUPABASE_URL = 'https://kzahahrnauynnrfznkje.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VpOYj7KajWRHJKyjPyLh_g_mgabFpgZ';
// Session volontairement séparée de celle de l'application interne (même site, clé de stockage différente).
// Mode APERÇU (personnel de l'organisme) : espace-client.html?apercu=<id du client>.
// On réutilise alors la session de l'application interne (clé de stockage par défaut) et on envoie
// l'en-tête « x-apercu-client » : la base répond comme pour ce client, en LECTURE SEULE
// (voir patch_2026-10-05e_apercu_client.sql). Aucune écriture, aucune signature, aucune déconnexion.
const APERCU = (() => { const v = new URLSearchParams(location.search).get('apercu') || ''; return /^[0-9a-f-]{36}$/i.test(v) ? v.toLowerCase() : null; })();
const supa = APERCU
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { 'x-apercu-client': APERCU } } })
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey: 'sb-espace-client-auth', persistSession: true } });

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIBELLES_DOC = {
  convention: 'Convention de formation', convention_signee: 'Convention signée', convocation: 'Convocation',
  feuille_presence: "Feuille d'émargement", attestation_fin_formation: 'Attestation de fin de formation',
  certificat_realisation: 'Certificat de réalisation', certificat_competence: 'Certificat de compétence',
};
const dateFr = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR') : '';

let CTX = null;          // identité du compte client
let SESSIONS = [];
let SESSION_COURANTE = null;
let DOCS = [], STAGIAIRES = [];

function message(html) { $('#contenu').innerHTML = html; }

// ---------------------------------------------------------------------------
// Démarrage / connexion
// ---------------------------------------------------------------------------
async function demarrer() {
  if (APERCU) {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) { message('<div class="carte"><p><strong>Aperçu impossible.</strong> Connectez-vous d\'abord à l\'application Admin Formation (dans cet onglet du navigateur ou un autre, sur ce même site), puis relancez l\'aperçu depuis la fiche client.</p></div>'); return; }
    await chargerEspace();
    return;
  }
  supa.auth.onAuthStateChange((evenement) => { if (evenement === 'PASSWORD_RECOVERY') afficherNouveauMotDePasse(true); });
  const { data: { session } } = await supa.auth.getSession();
  if (session) await chargerEspace(); else afficherConnexion();
}

function afficherConnexion(infoErreur) {
  $('#entete').style.display = 'none';
  message(`
    <div class="carte" style="max-width:420px;margin:30px auto;">
      <h2>Espace client</h2>
      <p class="info">Connectez-vous pour consulter vos documents de formation, signer vos conventions et compléter les informations de vos stagiaires.</p>
      <label for="cx-email">Email</label><input id="cx-email" type="email" autocomplete="username">
      <label for="cx-mdp">Mot de passe</label><input id="cx-mdp" type="password" autocomplete="current-password">
      <div style="margin-top:14px;"><button class="principal" id="cx-valider" style="width:100%;">Se connecter</button></div>
      <p style="margin:12px 0 0;font-size:13px;"><a class="lien" id="cx-oublie">Mot de passe oublié ?</a></p>
      <div class="erreur" id="cx-erreur">${esc(infoErreur || '')}</div>
      <div class="info" id="cx-info"></div>
    </div>`);
  const valider = async () => {
    $('#cx-erreur').textContent = '';
    $('#cx-valider').disabled = true;
    const { error } = await supa.auth.signInWithPassword({ email: $('#cx-email').value.trim(), password: $('#cx-mdp').value });
    $('#cx-valider').disabled = false;
    if (error) { $('#cx-erreur').textContent = 'Email ou mot de passe incorrect.'; return; }
    chargerEspace();
  };
  $('#cx-valider').onclick = valider;
  $('#cx-mdp').onkeydown = e => { if (e.key === 'Enter') valider(); };
  $('#cx-oublie').onclick = async () => {
    const email = $('#cx-email').value.trim();
    if (!email) { $('#cx-erreur').textContent = 'Saisissez d\'abord votre email.'; return; }
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0].split('?')[0] });
    if (error) { $('#cx-erreur').textContent = 'Envoi impossible pour le moment.'; return; }
    $('#cx-info').textContent = 'Si cet email correspond à un accès, un lien de réinitialisation vient de vous être envoyé.';
  };
}

function afficherNouveauMotDePasse(depuisLien) {
  $('#voile').classList.add('actif');
  $('#feuille').innerHTML = `
    <h3 style="margin-top:0;">${depuisLien ? 'Choisissez un nouveau mot de passe' : 'Changer mon mot de passe'}</h3>
    <label for="mp1">Nouveau mot de passe (8 caractères minimum)</label><input id="mp1" type="password" autocomplete="new-password">
    <label for="mp2">Confirmation</label><input id="mp2" type="password" autocomplete="new-password">
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="secondaire" id="mp-annuler">Annuler</button><button class="principal" id="mp-valider" style="flex:1;">Enregistrer</button>
    </div>
    <div class="erreur" id="mp-erreur"></div>`;
  $('#mp-annuler').onclick = () => { $('#voile').classList.remove('actif'); if (depuisLien && !CTX) chargerEspace(); };
  $('#mp-valider').onclick = async () => {
    const a = $('#mp1').value, b = $('#mp2').value;
    if (a.length < 8) { $('#mp-erreur').textContent = '8 caractères minimum.'; return; }
    if (a !== b) { $('#mp-erreur').textContent = 'Les deux saisies sont différentes.'; return; }
    const { error } = await supa.auth.updateUser({ password: a });
    if (error) { $('#mp-erreur').textContent = error.message; return; }
    $('#voile').classList.remove('actif');
    if (!CTX) chargerEspace(); else alert('Mot de passe modifié.');
  };
}

async function chargerEspace() {
  const { data, error } = await supa.rpc('client_contexte');
  if (APERCU && (error || !data)) {
    message(`<div class="carte"><p class="erreur">Aperçu impossible : ${esc(error?.message || 'client introuvable ou accès refusé')}.</p><p class="info">Si votre connexion à l'application a expiré, reconnectez-vous dans l'application puis relancez l'aperçu. Le patch « aperçu espace client » (2026-10-05e) doit aussi avoir été appliqué dans Supabase.</p></div>`);
    return;
  }
  if (error || !data) {
    await supa.auth.signOut();
    afficherConnexion('Ce compte n\'est pas rattaché à un espace client (ou il a été désactivé).');
    return;
  }
  CTX = data;
  $('#entete').style.display = '';
  $('#titre').textContent = CTX.client;
  $('#sous-titre').textContent = CTX.organisme + ' — espace client';
  if (APERCU) {
    $('#btn-quitter').style.display = 'none'; $('#btn-mdp').style.display = 'none';
    $('#sous-titre').textContent = CTX.organisme + ' — APERÇU en lecture seule (ce que voit ce client)';
    $('#entete').style.background = '#8a5a00';
  } else {
    $('#btn-quitter').onclick = async () => { await supa.auth.signOut(); CTX = null; afficherConnexion(); };
    $('#btn-mdp').onclick = () => afficherNouveauMotDePasse(false);
  }
  await afficherSessions();
}

// ---------------------------------------------------------------------------
// Liste des sessions
// ---------------------------------------------------------------------------
async function afficherSessions() {
  SESSION_COURANTE = null;
  message('<p class="info">Chargement de vos formations…</p>');
  const { data, error } = await supa.rpc('client_sessions');
  if (error) { message(`<div class="carte"><p class="erreur">Erreur : ${esc(error.message)}</p></div>`); return; }
  SESSIONS = data || [];
  if (!SESSIONS.length) { message('<div class="carte"><p>Aucune formation pour le moment.</p></div>'); return; }

  const aSigner = SESSIONS.filter(s => s.convention_id && !s.convention_signee).length;
  const aCompleter = SESSIONS.reduce((n, s) => n + (s.nb_infos_manquantes || 0), 0);
  message(`
    ${(aSigner || aCompleter) ? `<div class="carte" style="background:#fff9e8;border-color:#e6c76a;">
      <strong>À faire :</strong>
      ${aSigner ? `<div>• ${aSigner} convention(s) à signer</div>` : ''}
      ${aCompleter ? `<div>• Informations à compléter pour ${aCompleter} stagiaire(s) (nécessaires à la déclaration Passeport de prévention)</div>` : ''}
    </div>` : ''}
    ${SESSIONS.map(s => `
      <div class="carte session" data-id="${esc(s.id)}">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <strong>${esc(s.formation)}</strong>
          <span class="info">${dateFr(s.date_debut)}${s.date_fin && s.date_fin !== s.date_debut ? ' → ' + dateFr(s.date_fin) : ''}</span>
        </div>
        <div class="info">${esc([s.lieu, s.ville].filter(Boolean).join(', '))}${s.numero_session ? ' · n° ' + esc(s.numero_session) : ''} · ${s.nb_stagiaires} stagiaire(s)</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          ${s.convention_signee ? '<span class="pastille p-vert">Convention signée</span>' : (s.convention_id ? '<span class="pastille p-orange">Convention à signer</span>' : '<span class="pastille p-gris">Convention pas encore disponible</span>')}
          ${s.nb_infos_manquantes ? `<span class="pastille p-rouge">${s.nb_infos_manquantes} stagiaire(s) à compléter</span>` : (s.nb_stagiaires ? '<span class="pastille p-vert">Informations stagiaires complètes</span>' : '')}
          <span class="pastille p-gris">${s.nb_documents} document(s)</span>
        </div>
      </div>`).join('')}`);
  document.querySelectorAll('.session').forEach(el => { el.onclick = () => ouvrirSessionClient(el.dataset.id); });
}

// ---------------------------------------------------------------------------
// Détail d'une session
// ---------------------------------------------------------------------------
async function ouvrirSessionClient(id) {
  SESSION_COURANTE = SESSIONS.find(s => s.id === id);
  message('<p class="info">Chargement…</p>');
  const [rd, rs] = await Promise.all([supa.rpc('client_documents', { p_session: id }), supa.rpc('client_stagiaires', { p_session: id })]);
  if (rd.error || rs.error) { message(`<div class="carte"><p class="erreur">Erreur : ${esc((rd.error || rs.error).message)}</p><button class="secondaire" onclick="afficherSessions()">Retour</button></div>`); return; }
  DOCS = rd.data || []; STAGIAIRES = rs.data || [];
  rendreSessionClient();
}

function rendreSessionClient() {
  const s = SESSION_COURANTE;
  const conventions = DOCS.filter(d => d.type === 'convention');
  const autres = DOCS.filter(d => d.type !== 'convention');
  const ligneDoc = d => `
    <div class="doc">
      <span>${esc(LIBELLES_DOC[d.type] || d.type)}${d.stagiaire ? ' — ' + esc(d.stagiaire) : ''}
        <span class="info"> · ${dateFr(d.publie_le)}</span>
        ${d.type === 'convention' ? (d.signee ? ` <span class="pastille p-vert">Signée par ${esc(d.signataire)} le ${new Date(d.signe_le).toLocaleDateString('fr-FR')}</span>` : ' <span class="pastille p-orange">À signer</span>') : ''}
      </span>
      <span style="display:flex;gap:6px;">
        <button class="secondaire petit" data-tel="${esc(d.id)}">Télécharger</button>
        ${d.type === 'convention' && !d.signee ? `<button class="principal petit" data-sign="${esc(d.id)}">Signer</button>` : ''}
      </span>
    </div>`;

  message(`
    <p><a class="lien" id="retour">← Mes formations</a></p>
    <div class="carte">
      <h2>${esc(s.formation)}</h2>
      <div class="info">${dateFr(s.date_debut)}${s.date_fin && s.date_fin !== s.date_debut ? ' → ' + dateFr(s.date_fin) : ''} · ${esc([s.lieu, s.ville].filter(Boolean).join(', '))}</div>
    </div>
    <div class="carte">
      <h3>Documents</h3>
      ${DOCS.length ? conventions.map(ligneDoc).join('') + autres.map(ligneDoc).join('') : '<p class="info">Aucun document disponible pour le moment. Ils apparaissent ici dès que l\'organisme de formation les publie.</p>'}
    </div>
    <div class="carte">
      <h3>Informations de vos stagiaires</h3>
      <p class="info">Ces informations sont nécessaires à la déclaration de la formation dans le Passeport de prévention. Le numéro de sécurité sociale (NIR) est enregistré de façon chiffrée : il ne sera plus affichable ensuite, ni par vous ni sur aucun document.</p>
      <div id="liste-stagiaires">${STAGIAIRES.length ? STAGIAIRES.map(formStagiaire).join('') : '<p class="info">Aucun stagiaire inscrit pour votre entreprise.</p>'}</div>
    </div>`);
  $('#retour').onclick = afficherSessions;
  document.querySelectorAll('[data-tel]').forEach(b => { b.onclick = () => telecharger(b.dataset.tel, b); });
  document.querySelectorAll('[data-sign]').forEach(b => { b.onclick = () => ouvrirSignature(b.dataset.sign); });
  document.querySelectorAll('[data-nomnaiss]').forEach(b => { b.onclick = () => { $('#nn-' + b.dataset.nomnaiss).value = STAGIAIRES.find(x => x.id === b.dataset.nomnaiss).nom; }; });
  document.querySelectorAll('[data-enreg]').forEach(b => { b.onclick = () => enregistrerStagiaire(b.dataset.enreg); });
  if (APERCU) {   // lecture seule : rien ne peut être saisi, enregistré ni signé
    document.querySelectorAll('#liste-stagiaires input, #liste-stagiaires button, [data-sign], [data-nomnaiss]').forEach(e => { e.disabled = true; e.style.pointerEvents = 'none'; e.title = 'Aperçu en lecture seule'; });
    document.querySelectorAll('[data-sign]').forEach(b => { b.style.opacity = '.5'; });
  }
}

function etatStagiaire(st) {
  return st.nir_renseigne && (st.nom_naissance || '').trim()
    ? '<span class="pastille p-vert">Complet</span>' : '<span class="pastille p-rouge">À compléter</span>';
}

function formStagiaire(st) {
  const id = esc(st.id);
  return `<div class="stagiaire" id="st-${id}">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong>${esc(st.prenom)} ${esc(st.nom)}</strong><span id="etat-${id}">${etatStagiaire(st)}</span></div>
    <div class="ligne">
      <div><label for="nn-${id}">Nom de naissance <span class="info" style="font-weight:normal;">(30 car. max.)</span></label>
        <input id="nn-${id}" maxlength="30" value="${esc(st.nom_naissance || '')}">
        <a class="lien info" data-nomnaiss="${id}">Identique au nom ci-dessus</a></div>
      <div><label for="dn-${id}">Date de naissance</label><input id="dn-${id}" type="date" value="${esc(st.date_naissance || '')}"></div>
      <div><label for="ln-${id}">Lieu de naissance</label><input id="ln-${id}" value="${esc(st.lieu_naissance || '')}"></div>
    </div>
    <div class="ligne">
      <div><label for="em-${id}">Email</label><input id="em-${id}" type="email" value="${esc(st.email || '')}"></div>
      <div><label for="tl-${id}">Téléphone</label><input id="tl-${id}" value="${esc(st.telephone || '')}"></div>
      <div><label for="nir-${id}">N° de sécurité sociale (NIR)</label>
        <input id="nir-${id}" autocomplete="off" inputmode="text" placeholder="${st.nir_renseigne ? '••• enregistré — saisir pour remplacer' : '13 caractères (ou 15 avec la clé)'}"></div>
    </div>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button class="principal petit" data-enreg="${id}">Enregistrer</button><span class="erreur" id="err-${id}" style="margin:0;"></span><span class="ok" id="ok-${id}"></span>
    </div>
  </div>`;
}

async function enregistrerStagiaire(id) {
  const st = STAGIAIRES.find(x => x.id === id);
  $('#err-' + id).textContent = ''; $('#ok-' + id).textContent = '';
  const bouton = document.querySelector(`[data-enreg="${id}"]`); bouton.disabled = true;
  const { error } = await supa.rpc('client_maj_stagiaire', { p_stagiaire: id, p_data: {
    nom_naissance: $('#nn-' + id).value, date_naissance: $('#dn-' + id).value, lieu_naissance: $('#ln-' + id).value,
    email: $('#em-' + id).value, telephone: $('#tl-' + id).value } });
  if (error) { bouton.disabled = false; $('#err-' + id).textContent = error.message; return; }
  st.nom_naissance = $('#nn-' + id).value.trim(); st.date_naissance = $('#dn-' + id).value || null;
  st.lieu_naissance = $('#ln-' + id).value.trim(); st.email = $('#em-' + id).value.trim(); st.telephone = $('#tl-' + id).value.trim();

  const nir = $('#nir-' + id).value.trim();
  if (nir) {
    const r = await supa.rpc('client_nir_definir', { p_stagiaire: id, p_nir: nir });
    if (r.error) { bouton.disabled = false; $('#err-' + id).textContent = 'Informations enregistrées, mais NIR refusé : ' + r.error.message; return; }
    st.nir_renseigne = true;
    $('#nir-' + id).value = ''; $('#nir-' + id).placeholder = '••• enregistré — saisir pour remplacer';
  }
  bouton.disabled = false;
  $('#ok-' + id).textContent = 'Enregistré ✔';
  $('#etat-' + id).innerHTML = etatStagiaire(st);
}

// ---------------------------------------------------------------------------
// Téléchargement
// ---------------------------------------------------------------------------
async function telecharger(docId, bouton) {
  const d = DOCS.find(x => x.id === docId);
  if (bouton) bouton.disabled = true;
  const { data, error } = await supa.storage.from('documents').createSignedUrl(d.storage_path, 120);
  if (bouton) bouton.disabled = false;
  if (error || !data) { alert('Téléchargement impossible : ' + (error?.message || 'document introuvable')); return; }
  window.open(data.signedUrl, '_blank');
}

// ---------------------------------------------------------------------------
// Signature électronique de la convention
// ---------------------------------------------------------------------------
let ctx2d = null, trace = false, aSigne = false;

function ouvrirSignature(docId) {
  const d = DOCS.find(x => x.id === docId);
  $('#voile').classList.add('actif');
  $('#feuille').innerHTML = `
    <h3 style="margin-top:0;">Signer la convention</h3>
    <p class="info">${esc(SESSION_COURANTE.formation)} — ${dateFr(SESSION_COURANTE.date_debut)}. <a class="lien" id="sg-lire">Lire la convention</a> avant de signer.</p>
    <div class="ligne">
      <div><label for="sg-nom">Nom et prénom du signataire</label><input id="sg-nom" value="${esc(((CTX.prenom || '') + ' ' + (CTX.nom || '')).trim())}"></div>
      <div><label for="sg-fonction">Fonction</label><input id="sg-fonction"></div>
    </div>
    <label style="display:flex;gap:8px;align-items:flex-start;font-weight:normal;"><input type="checkbox" id="sg-lu" style="margin-top:3px;">
      <span>J'ai lu la convention et je l'approuve. Je suis habilité(e) à engager ${esc(CTX.client)}. Je comprends que ma signature électronique a la même valeur que ma signature manuscrite pour cet engagement.</span></label>
    <label>Signature (au doigt ou à la souris)</label>
    <canvas id="sg-canvas"></canvas>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="secondaire" id="sg-effacer">Effacer</button><button class="secondaire" id="sg-annuler">Annuler</button>
      <button class="principal" id="sg-valider" style="flex:1;">Signer la convention</button>
    </div>
    <div class="erreur" id="sg-erreur"></div>`;
  const canvas = $('#sg-canvas');
  const preparer = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * 2); canvas.height = Math.round(r.height * 2);
    ctx2d = canvas.getContext('2d'); ctx2d.scale(2, 2); ctx2d.lineWidth = 2.5; ctx2d.lineCap = 'round'; ctx2d.lineJoin = 'round'; ctx2d.strokeStyle = '#000';
    aSigne = false;
  };
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.onpointerdown = e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); trace = true; aSigne = true; const [x, y] = pos(e); ctx2d.beginPath(); ctx2d.moveTo(x, y); ctx2d.lineTo(x + .1, y + .1); ctx2d.stroke(); };
  canvas.onpointermove = e => { if (!trace) return; e.preventDefault(); const [x, y] = pos(e); ctx2d.lineTo(x, y); ctx2d.stroke(); };
  canvas.onpointerup = canvas.onpointercancel = () => { trace = false; };
  preparer();
  $('#sg-effacer').onclick = preparer;
  $('#sg-annuler').onclick = () => $('#voile').classList.remove('actif');
  $('#sg-lire').onclick = () => telecharger(docId);
  $('#sg-valider').onclick = () => signerConvention(d);
}

async function sha256Hex(octets) {
  const h = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
}

function pagePreuve(d, nom, fonction, empreinte, pngSignature, horodatage) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ compress: true });
  const ligne = (t, y, o = {}) => { doc.setFont('helvetica', o.gras ? 'bold' : 'normal'); doc.setFontSize(o.taille || 11); doc.text(doc.splitTextToSize(t, 175), 18, y); return y + (o.pas || 7) * Math.max(1, doc.splitTextToSize(t, 175).length); };
  let y = 24;
  y = ligne('PAGE DE SIGNATURE ÉLECTRONIQUE', y, { gras: true, taille: 16, pas: 10 });
  y = ligne('Convention de formation professionnelle', y, { gras: true, pas: 8 });
  y += 4;
  y = ligne(`Organisme de formation : ${CTX.organisme}`, y);
  y = ligne(`Client : ${CTX.client}`, y);
  y = ligne(`Formation : ${SESSION_COURANTE.formation}`, y);
  y = ligne(`Dates : ${dateFr(SESSION_COURANTE.date_debut)}${SESSION_COURANTE.date_fin && SESSION_COURANTE.date_fin !== SESSION_COURANTE.date_debut ? ' au ' + dateFr(SESSION_COURANTE.date_fin) : ''}`, y);
  if (SESSION_COURANTE.numero_session) y = ligne(`Session n° ${SESSION_COURANTE.numero_session}`, y);
  y += 6;
  y = ligne('Signataire', y, { gras: true });
  y = ligne(`${nom}${fonction ? ' — ' + fonction : ''}`, y);
  y = ligne(`Compte utilisé : ${CTX.email}`, y);
  y = ligne(`Date et heure de la signature (horloge de l'appareil) : ${horodatage}`, y);
  y += 4;
  doc.setDrawColor(150); doc.rect(18, y, 80, 34); doc.addImage(pngSignature, 'PNG', 20, y + 2, 76, 30);
  y += 42;
  y = ligne('Déclaration du signataire', y, { gras: true });
  y = ligne("Le signataire déclare avoir pris connaissance de la convention ci-jointe (pages précédentes), l'approuver et être habilité à engager son entreprise. Signature électronique simple, réalisée après authentification du signataire dans l'espace client.", y, { taille: 10, pas: 5.5 });
  y += 4;
  y = ligne("Empreinte numérique (SHA-256) de la convention d'origine, permettant de vérifier qu'elle n'a pas été modifiée :", y, { taille: 9, pas: 5 });
  doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.text(doc.splitTextToSize(empreinte, 175), 18, y + 1);
  return doc.output('arraybuffer');
}

async function signerConvention(d) {
  const nom = $('#sg-nom').value.trim(), fonction = $('#sg-fonction').value.trim();
  const erreur = t => { $('#sg-erreur').textContent = t; };
  erreur('');
  if (!nom) return erreur('Indiquez le nom du signataire.');
  if (!$('#sg-lu').checked) return erreur('Cochez la case d\'approbation.');
  if (!aSigne) return erreur('Merci de signer dans le cadre.');
  $('#sg-valider').disabled = true; $('#sg-valider').textContent = 'Signature en cours…';
  try {
    // 1. récupérer la convention d'origine et calculer son empreinte
    const { data: blob, error: eDl } = await supa.storage.from('documents').download(d.storage_path);
    if (eDl) throw new Error('Lecture de la convention impossible : ' + eDl.message);
    const octets = await blob.arrayBuffer();
    const empreinte = await sha256Hex(octets);

    // 2. page de preuve + fusion avec la convention
    const src = $('#sg-canvas');
    const mini = document.createElement('canvas'); mini.width = 300; mini.height = 120;
    const c = mini.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 300, 120); c.drawImage(src, 0, 0, 300, 120);
    const horodatage = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' });
    const preuve = pagePreuve(d, nom, fonction, empreinte, mini.toDataURL('image/png'), horodatage);
    const orig = await PDFLib.PDFDocument.load(octets);
    const pp = await PDFLib.PDFDocument.load(preuve);
    (await orig.copyPages(pp, pp.getPageIndices())).forEach(p => orig.addPage(p));
    const signe = await orig.save();

    // 3. dépôt puis déclaration de la signature
    const organisationId = d.storage_path.split('/')[0];
    const chemin = `${organisationId}/${SESSION_COURANTE.id}/signees/${CTX.client_id}/${Date.now()}_convention_signee.pdf`;
    const { error: eUp } = await supa.storage.from('documents').upload(chemin, new Blob([signe], { type: 'application/pdf' }), { contentType: 'application/pdf' });
    if (eUp) throw new Error('Dépôt de la convention signée impossible : ' + eUp.message);
    const { error: eSig } = await supa.rpc('client_signer_convention', { p_document: d.id, p_nom: nom, p_fonction: fonction, p_chemin: chemin, p_empreinte: empreinte });
    if (eSig) throw new Error(eSig.message);

    $('#voile').classList.remove('actif');
    await afficherSessionsPuisRouvrir(SESSION_COURANTE.id);
  } catch (e) {
    $('#sg-valider').disabled = false; $('#sg-valider').textContent = 'Signer la convention';
    erreur(e.message || String(e));
  }
}

async function afficherSessionsPuisRouvrir(id) {
  const { data } = await supa.rpc('client_sessions');
  SESSIONS = data || SESSIONS;
  await ouvrirSessionClient(id);
}

demarrer();
