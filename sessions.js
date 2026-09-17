// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// sessions.js — écran Sessions : liste, création, et détail d'une session
// (inscription de stagiaires avec dédoublonnage, FISE = grille de
// certification, évaluation de satisfaction). Un formateur ne voit et ne peut
// modifier (statut, FISE, évaluation) que les sessions où il est assigné —
// la RLS sur sessions_formation/session_participants l'impose déjà côté base,
// cet écran adapte simplement l'affichage (pas de bouton "nouvelle session"
// ni de suppression de participant pour un formateur).

// Les 10 critères du questionnaire de satisfaction (repris tels quels de
// l'onglet "BDstagiaire" du classeur Excel).
const QUESTIONS_SATISFACTION = [
  "Qualité de l'organisation",
  "Clarté des objectifs",
  "Qualité du formateur",
  "Pertinence des méthodes pédagogiques du formateur",
  "Le formateur donne l'envie d'apprendre",
  "Qualité du matériel",
  "La formation correspondait-elle à mes attentes",
  "Etes-vous prêt à mettre en œuvre ces gestes et techniques",
  "La durée de la formation m'a paru adaptée",
  "Le rythme de la formation m'a paru adapté",
];

const PEUT_GERER_SESSIONS = () => ['admin', 'gestionnaire', 'super_admin'].includes(S.vision);

async function ecranSessions(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Sessions</h2>
      ${PEUT_GERER_SESSIONS() ? '<button class="bouton" onclick="ecranNouvelleSession($(\'#vue\'))">+ Nouvelle session</button>' : ''}
    </div>
    <div class="carte"><div id="liste-sessions">Chargement…</div></div>`;

  const { data, error } = await supa
    .from('sessions_formation')
    .select('id, date_debut, date_fin, lieu, statut, formations_catalogue(denomination), clients(raison_sociale)')
    .order('date_debut', { ascending: false })
    .limit(100);

  const zone = $('#liste-sessions');
  if (error) { DEBUG.erreur('ecranSessions', error); zone.textContent = 'Erreur de chargement.'; return; }
  if (!data || data.length === 0) { zone.innerHTML = '<p style="color:#55636c;">Aucune session.</p>'; return; }

  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
      <th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Formation</th>
      <th style="padding:6px 8px;">Client</th><th style="padding:6px 8px;">Statut</th>
    </tr></thead>
    <tbody>${data.map(s => `
      <tr style="border-top:1px solid #eee;cursor:pointer;" onclick="ouvrirSession('${s.id}')">
        <td style="padding:6px 8px;">${formatDateFr(s.date_debut)}</td>
        <td style="padding:6px 8px;">${esc(s.formations_catalogue?.denomination || '')}</td>
        <td style="padding:6px 8px;">${esc(s.clients?.raison_sociale || '—')}</td>
        <td style="padding:6px 8px;">${esc(s.statut)}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ============================================================================
// CRÉATION D'UNE SESSION
// ============================================================================

async function ecranNouvelleSession(vue) {
  const { data: clients } = await supa.from('clients').select('id, raison_sociale').eq('actif', true).order('raison_sociale');
  const { data: formations } = await supa.from('formations_catalogue').select('id, code, categorie, denomination').eq('actif', true).order('categorie').order('denomination');

  const parCategorie = {};
  (formations || []).forEach(f => { (parCategorie[f.categorie] = parCategorie[f.categorie] || []).push(f); });

  vue.innerHTML = `
    <div class="carte" style="max-width:560px;">
      <h2 style="margin-top:0;">Nouvelle session</h2>

      <label for="ns-client">Client</label>
      <input id="ns-client" list="ns-clients-liste" placeholder="Rechercher un client…">
      <datalist id="ns-clients-liste">
        ${(clients || []).map(c => `<option data-id="${c.id}" value="${esc(c.raison_sociale)}">`).join('')}
      </datalist>

      <label for="ns-formation">Formation</label>
      <select id="ns-formation">
        <option value="">— Choisir —</option>
        ${Object.entries(parCategorie).map(([cat, fs]) => `
          <optgroup label="${esc(cat)}">
            ${fs.map(f => `<option value="${f.id}">${esc(f.denomination)} (${esc(f.code)})</option>`).join('')}
          </optgroup>`).join('')}
      </select>

      <label for="ns-lieu">Lieu</label>
      <input id="ns-lieu" placeholder="Chez le client, ou adresse du centre">

      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="ns-date-debut">Date de début</label>
          <input id="ns-date-debut" type="date">
        </div>
        <div style="flex:1;">
          <label for="ns-date-fin">Date de fin</label>
          <input id="ns-date-fin" type="date">
        </div>
      </div>

      <button class="bouton" id="ns-valider" style="margin-top:16px;">Créer la session</button>
      <button class="bouton" style="margin-top:16px;margin-left:8px;background:#eee;color:#333;" onclick="allerA('sessions')">Annuler</button>
      <div class="erreur" id="ns-erreur"></div>
    </div>`;

  $('#ns-valider').onclick = async () => {
    const clientInput = $('#ns-client').value.trim();
    const option = $$('#ns-clients-liste option').find(o => o.value === clientInput);
    const formationId = $('#ns-formation').value;
    const dateDebut = $('#ns-date-debut').value;
    const dateFin = $('#ns-date-fin').value || dateDebut;
    const lieu = $('#ns-lieu').value.trim();

    if (!formationId || !dateDebut) { $('#ns-erreur').textContent = 'Formation et date de début obligatoires.'; return; }

    const { data, error } = await supa.from('sessions_formation').insert({
      organisation_id: S.organisation.id,
      formation_id: formationId,
      client_id: option ? option.dataset.id : null,
      lieu: lieu || null,
      date_debut: dateDebut,
      date_fin: dateFin,
      formateur_id: S.profil.role === 'formateur' ? S.profil.id : null,
    }).select().single();

    if (error) { DEBUG.erreur('creerSession', error); $('#ns-erreur').textContent = 'Erreur : ' + error.message; return; }
    toast('Session créée.');
    ouvrirSession(data.id);
  };
}

// ============================================================================
// DÉTAIL D'UNE SESSION — participants, FISE, évaluations
// ============================================================================

async function ouvrirSession(id) {
  S.ongletActif = 'sessions';
  rendreOnglets();
  const vue = $('#vue');
  vue.innerHTML = '<div class="carte">Chargement…</div>';

  const { data: session, error } = await supa
    .from('sessions_formation')
    .select('*, formations_catalogue(*), clients(raison_sociale)')
    .eq('id', id)
    .single();

  if (error) { DEBUG.erreur('ouvrirSession', error); vue.innerHTML = '<div class="carte">Session introuvable ou accès refusé.</div>'; return; }

  const { data: participants } = await supa
    .from('session_participants')
    .select('*, stagiaires(civilite, nom, prenom, date_naissance)')
    .eq('session_id', id);

  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h2 style="margin:0 0 4px;">${esc(session.formations_catalogue?.denomination || '')}</h2>
        <p style="margin:0;color:#55636c;font-size:14px;">
          ${formatDateFr(session.date_debut)}${session.date_fin !== session.date_debut ? ' → ' + formatDateFr(session.date_fin) : ''}
          — ${esc(session.lieu || 'lieu non renseigné')}
          — ${esc(session.clients?.raison_sociale || 'sans client')}
          — statut : ${esc(session.statut)}
        </p>
      </div>
      <button class="bouton" style="background:#eee;color:#333;" onclick="allerA('sessions')">← Retour</button>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">Documents de la session</h3>
      <button class="bouton" onclick="genererConvention(window.__sessionCourante, window.__participantsCourants)">Convention</button>
      <button class="bouton" style="margin-left:8px;" onclick="genererFeuillePresence(window.__sessionCourante, window.__participantsCourants)">Feuille d'émargement</button>
      <p style="font-size:12px;color:#55636c;margin:8px 0 0;">La feuille d'émargement n'a pas de modèle papier de référence confirmé — mise en page à ajuster si besoin.</p>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">Participants</h3>
      <div id="participants-liste"></div>
      ${PEUT_GERER_SESSIONS() ? `
      <div style="margin-top:16px;border-top:1px solid #eee;padding-top:16px;">
        <label for="sp-recherche">Ajouter un stagiaire (recherche par nom / prénom)</label>
        <input id="sp-recherche" placeholder="Nom ou prénom…">
        <div id="sp-resultats" style="margin-top:8px;"></div>
      </div>` : ''}
    </div>`;

  rendreParticipants(session, participants || []);

  if (PEUT_GERER_SESSIONS()) {
    let timer;
    $('#sp-recherche').oninput = (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => rechercherStagiaires(e.target.value.trim(), session), 250);
    };
  }
}

function rendreParticipants(session, participants) {
  const zone = $('#participants-liste');
  if (participants.length === 0) { zone.innerHTML = '<p style="color:#55636c;">Aucun stagiaire inscrit.</p>'; return; }

  zone.innerHTML = participants.map(p => `
    <div class="carte" style="margin-bottom:10px;background:#fafbfc;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <strong>${esc(p.stagiaires?.prenom)} ${esc(p.stagiaires?.nom)}</strong>
        <select data-pid="${p.id}" class="sp-statut" style="width:auto;">
          ${['inscrit','present','absent','certifie','non_certifie'].map(s => `<option value="${s}" ${s === p.statut ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="bouton" style="padding:5px 10px;font-size:12px;" onclick="toggleFise('${p.id}')">FISE / compétences</button>
        <button class="bouton" style="padding:5px 10px;font-size:12px;" onclick="toggleEvaluation('${p.id}')">Évaluation stagiaire</button>
        <button class="bouton" style="padding:5px 10px;font-size:12px;background:#eee;color:#333;" onclick="genererConvocation(window.__sessionCourante, window.__participantsCourants.find(x=>x.id==='${p.id}'))">Convocation</button>
        <button class="bouton" style="padding:5px 10px;font-size:12px;background:#eee;color:#333;" onclick="genererAFF(window.__sessionCourante, window.__participantsCourants.find(x=>x.id==='${p.id}'))">AFF</button>
        <button class="bouton" style="padding:5px 10px;font-size:12px;background:#eee;color:#333;" onclick="genererCertificatRealisation(window.__sessionCourante, window.__participantsCourants.find(x=>x.id==='${p.id}'))">Certificat</button>
      </div>
      <div id="fise-${p.id}" style="display:none;margin-top:12px;"></div>
      <div id="eval-${p.id}" style="display:none;margin-top:12px;"></div>
    </div>`).join('');

  $$('.sp-statut').forEach(sel => {
    sel.onchange = async () => {
      const { error } = await supa.from('session_participants').update({ statut: sel.value }).eq('id', sel.dataset.pid);
      if (error) { DEBUG.erreur('maj statut participant', error); toast('Erreur : ' + error.message, 'erreur'); return; }
      toast('Statut mis à jour.');
    };
  });

  // Garder en mémoire pour les toggles FISE/évaluation
  window.__participantsCourants = participants;
  window.__sessionCourante = session;
}

function toggleFise(participantId) {
  const zone = $('#fise-' + participantId);
  const visible = zone.style.display !== 'none';
  $$('[id^="fise-"], [id^="eval-"]').forEach(z => z.style.display = 'none');
  if (visible) return;

  const p = window.__participantsCourants.find(x => x.id === participantId);
  const competences = window.__sessionCourante.formations_catalogue?.competences || [];
  const grille = Array.isArray(p.grille_certification) && p.grille_certification.length ? p.grille_certification
    : competences.map(c => ({ libelle: c.libelle, acquis: null }));

  zone.innerHTML = `
    <div style="border-top:1px solid #e0e0e0;padding-top:10px;">
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">FISE — compétences visées par la formation, résultat à l'issue de l'évaluation.</p>
      ${grille.map((c, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;font-size:13px;">
          <span style="flex:1;">${esc(c.libelle)}</span>
          <select data-idx="${i}" class="fise-champ">
            <option value="">—</option>
            <option value="acquis" ${c.acquis === true ? 'selected' : ''}>Acquise</option>
            <option value="reste" ${c.acquis === false ? 'selected' : ''}>Reste à acquérir</option>
          </select>
        </div>`).join('')}
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;" onclick="enregistrerFise('${participantId}')">Enregistrer</button>
    </div>`;
  zone.style.display = 'block';
  zone.dataset.grille = JSON.stringify(grille);
}

async function enregistrerFise(participantId) {
  const zone = $('#fise-' + participantId);
  const grille = JSON.parse(zone.dataset.grille);
  $$('.fise-champ', zone).forEach(sel => {
    const i = Number(sel.dataset.idx);
    grille[i].acquis = sel.value === 'acquis' ? true : sel.value === 'reste' ? false : null;
  });
  const { error } = await supa.from('session_participants').update({ grille_certification: grille }).eq('id', participantId);
  if (error) { DEBUG.erreur('enregistrerFise', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('FISE enregistrée.');
}

function toggleEvaluation(participantId) {
  const zone = $('#eval-' + participantId);
  const visible = zone.style.display !== 'none';
  $$('[id^="fise-"], [id^="eval-"]').forEach(z => z.style.display = 'none');
  if (visible) return;

  const p = window.__participantsCourants.find(x => x.id === participantId);
  const reponses = p.evaluation_satisfaction || {};

  zone.innerHTML = `
    <div style="border-top:1px solid #e0e0e0;padding-top:10px;">
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Évaluation de satisfaction (note de 1 à 4).</p>
      ${QUESTIONS_SATISFACTION.map(q => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;font-size:13px;">
          <span style="flex:1;">${esc(q)}</span>
          <select data-q="${esc(q)}" class="eval-champ" style="width:70px;">
            <option value="">—</option>
            ${[1,2,3,4].map(n => `<option value="${n}" ${reponses[q] == n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>`).join('')}
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;" onclick="enregistrerEvaluation('${participantId}')">Enregistrer</button>
    </div>`;
  zone.style.display = 'block';
}

async function enregistrerEvaluation(participantId) {
  const zone = $('#eval-' + participantId);
  const reponses = {};
  let total = 0, n = 0;
  $$('.eval-champ', zone).forEach(sel => {
    if (sel.value) { reponses[sel.dataset.q] = Number(sel.value); total += Number(sel.value); n++; }
  });
  const noteMoyenne = n ? Math.round((total / n) * 100) / 100 : null;
  const { error } = await supa.from('session_participants')
    .update({ evaluation_satisfaction: reponses, note_moyenne: noteMoyenne })
    .eq('id', participantId);
  if (error) { DEBUG.erreur('enregistrerEvaluation', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Évaluation enregistrée.');
}

// ============================================================================
// RECHERCHE / AJOUT DE STAGIAIRE (dédoublonnage nom + prénom + client)
// ============================================================================

async function rechercherStagiaires(texte, session) {
  const zone = $('#sp-resultats');
  if (!texte) { zone.innerHTML = ''; return; }

  const { data, error } = await supa
    .from('stagiaires')
    .select('id, nom, prenom, date_naissance, client_id, clients(raison_sociale)')
    .or(`nom.ilike.%${texte}%,prenom.ilike.%${texte}%`)
    .limit(15);

  if (error) { DEBUG.erreur('rechercherStagiaires', error); return; }

  // Priorité d'affichage aux stagiaires déjà liés au même client que la session
  const tries = (data || []).slice().sort((a, b) => {
    const aMatch = a.client_id === session.client_id ? 0 : 1;
    const bMatch = b.client_id === session.client_id ? 0 : 1;
    return aMatch - bMatch;
  });

  zone.innerHTML = `
    ${tries.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:6px;font-size:13px;">
        <span>${esc(s.prenom)} ${esc(s.nom)} ${s.date_naissance ? '— né(e) le ' + formatDateFr(s.date_naissance) : ''} ${s.clients?.raison_sociale ? '— ' + esc(s.clients.raison_sociale) : ''}
          ${s.client_id === session.client_id && session.client_id ? '<span style="color:#0a5c8a;font-weight:600;">(même client)</span>' : ''}
        </span>
        <button class="bouton" style="padding:4px 10px;font-size:12px;" onclick="ajouterParticipant('${s.id}', '${session.id}')">Ajouter</button>
      </div>`).join('')}
    <div style="padding:8px;border:1px dashed #c9c9c9;border-radius:6px;font-size:13px;color:#55636c;">
      Stagiaire introuvable ?
      <button class="bouton" style="padding:4px 10px;font-size:12px;margin-left:6px;" onclick="ouvrirFormNouveauStagiaire('${texte.replace(/'/g, "\\'")}', '${session.id}', '${session.client_id || ''}')">Créer "${esc(texte)}"</button>
    </div>`;
}

async function ajouterParticipant(stagiaireId, sessionId) {
  const { error } = await supa.from('session_participants').insert({
    organisation_id: S.organisation.id,
    session_id: sessionId,
    stagiaire_id: stagiaireId,
    statut: 'inscrit',
  });
  if (error) {
    if (error.code === '23505') { toast('Ce stagiaire est déjà inscrit à cette session.', 'erreur'); return; }
    DEBUG.erreur('ajouterParticipant', error); toast('Erreur : ' + error.message, 'erreur'); return;
  }
  toast('Stagiaire ajouté.');
  $('#sp-recherche').value = '';
  $('#sp-resultats').innerHTML = '';
  ouvrirSession(sessionId);
}

function ouvrirFormNouveauStagiaire(texteRecherche, sessionId, clientId) {
  const [prenomDevine, ...resteNom] = texteRecherche.split(' ');
  const zone = $('#sp-resultats');
  zone.innerHTML = `
    <div class="carte" style="background:#fff;">
      <label for="new-nom">Nom</label>
      <input id="new-nom" value="${esc(resteNom.join(' ') || texteRecherche)}">
      <label for="new-prenom">Prénom</label>
      <input id="new-prenom" value="${resteNom.length ? esc(prenomDevine) : ''}">
      <label for="new-naissance">Date de naissance</label>
      <input id="new-naissance" type="date">
      <button class="bouton" style="margin-top:10px;" onclick="creerEtAjouterStagiaire('${sessionId}', '${clientId}')">Créer et ajouter à la session</button>
    </div>`;
}

async function creerEtAjouterStagiaire(sessionId, clientId) {
  const nom = $('#new-nom').value.trim();
  const prenom = $('#new-prenom').value.trim();
  const dateNaissance = $('#new-naissance').value || null;
  if (!nom || !prenom) { toast('Nom et prénom obligatoires.', 'erreur'); return; }

  const { data: stagiaire, error } = await supa.from('stagiaires').insert({
    organisation_id: S.organisation.id,
    client_id: clientId || null,
    nom, prenom,
    date_naissance: dateNaissance,
  }).select().single();

  if (error) { DEBUG.erreur('creerStagiaire', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  ajouterParticipant(stagiaire.id, sessionId);
}
