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

// Origines de financement d'une session, alignées sur le cadre C du Bilan
// Pédagogique et Financier (BPF) — permet de répartir automatiquement les
// produits de l'organisme par origine lors du calcul du BPF (voir bpf.js).
const ORIGINES_FINANCEMENT = [
  { groupe: 'Entreprise / particulier', options: [
    { valeur: 'entreprise', libelle: 'Entreprise (salariés)' },
    { valeur: 'particulier', libelle: 'Particulier (à ses frais)' },
  ]},
  { groupe: 'Organismes gestionnaires des fonds de la formation (OPCO...)', options: [
    { valeur: 'apprentissage', libelle: 'Contrat d\'apprentissage' },
    { valeur: 'professionnalisation', libelle: 'Contrat de professionnalisation' },
    { valeur: 'alternance_pro', libelle: 'Promotion ou reconversion par alternance' },
    { valeur: 'transition_pro', libelle: 'Projet de transition professionnelle' },
    { valeur: 'cpf', libelle: 'Compte personnel de formation (CPF)' },
    { valeur: 'recherche_emploi', libelle: 'Dispositif personnes en recherche d\'emploi' },
    { valeur: 'tns', libelle: 'Dispositif travailleurs non-salariés' },
    { valeur: 'plan_competences', libelle: 'Plan de développement des compétences / autre dispositif' },
  ]},
  { groupe: 'Pouvoirs publics', options: [
    { valeur: 'agents_publics', libelle: 'Formation d\'agents publics' },
    { valeur: 'instances_europeennes', libelle: 'Instances européennes' },
    { valeur: 'etat', libelle: 'État' },
    { valeur: 'collectivites', libelle: 'Conseil régional / collectivité' },
    { valeur: 'france_travail', libelle: 'France Travail (ex Pôle emploi)' },
    { valeur: 'autres_publics', libelle: 'Autres ressources publiques' },
  ]},
  { groupe: 'Autre', options: [
    { valeur: 'autre_organisme', libelle: 'Autre organisme de formation (y compris CFA)' },
    { valeur: 'autres_produits', libelle: 'Autres produits de formation professionnelle' },
  ]},
];

function libelleOrigineFinancement(valeur) {
  for (const g of ORIGINES_FINANCEMENT) {
    const o = g.options.find(o => o.valeur === valeur);
    if (o) return o.libelle;
  }
  return valeur;
}

// Statuts existants sur sessions_formation, dans l'ordre d'affichage du filtre.
const STATUTS_SESSION = ['planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee'];

// Toutes les sessions chargées une fois par passage sur l'écran, puis
// filtrées côté client (recherche texte + statut + période) pour une
// recherche instantanée sans aller-retour serveur à chaque frappe.
window.__sessionsToutes = [];

async function ecranSessions(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Sessions</h2>
      ${PEUT_GERER_SESSIONS() ? '<button class="bouton" onclick="ecranNouvelleSession($(\'#vue\'))">+ Nouvelle session</button>' : ''}
    </div>
    <div class="carte">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:2;min-width:200px;">
          <label for="filtre-texte">Rechercher</label>
          <input id="filtre-texte" placeholder="Client, formation, lieu…" oninput="filtrerEtAfficherSessions()">
        </div>
        <div style="flex:1;min-width:150px;">
          <label for="filtre-statut">Statut</label>
          <select id="filtre-statut" onchange="filtrerEtAfficherSessions()">
            <option value="">Tous</option>
            ${STATUTS_SESSION.map(s => `<option value="${s}">${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:140px;">
          <label for="filtre-date-debut">Du</label>
          <input id="filtre-date-debut" type="date" onchange="filtrerEtAfficherSessions()">
        </div>
        <div style="flex:1;min-width:140px;">
          <label for="filtre-date-fin">Au</label>
          <input id="filtre-date-fin" type="date" onchange="filtrerEtAfficherSessions()">
        </div>
        <div>
          <label for="filtre-sans-stagiaire">&nbsp;</label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:normal;white-space:nowrap;padding:8px 0;">
            <input type="checkbox" id="filtre-sans-stagiaire" style="width:auto;" onchange="filtrerEtAfficherSessions()">
            Sans stagiaire uniquement
          </label>
        </div>
        <div>
          <label for="filtre-sans-formateur">&nbsp;</label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:normal;white-space:nowrap;padding:8px 0;">
            <input type="checkbox" id="filtre-sans-formateur" style="width:auto;" onchange="filtrerEtAfficherSessions()">
            Sans formateur uniquement
          </label>
        </div>
        <div>
          <button class="bouton" style="background:#eee;color:#333;" onclick="reinitialiserFiltresSessions()">Réinitialiser</button>
        </div>
      </div>
      <p style="font-size:12px;color:#55636c;margin:8px 0 0;">"Sans stagiaire uniquement" aide à repérer les sessions vides créées par erreur (ex. doublons d'un import) — ouvre la session puis utilise "Supprimer" pour la retirer. "Sans formateur uniquement" liste les sessions à compléter (voir aussi l'outil d'assignation rapide ci-dessous, qui porte lui sur toutes les sessions sans formateur, indépendamment de ce filtre).</p>
      <div id="bulk-suppression-zone"></div>
      <div id="bulk-formateur-zone"></div>
    </div>
    <div class="carte"><div id="liste-sessions">Chargement…</div></div>`;

  const [{ data, error }, { data: formateurs }] = await Promise.all([
    supa.from('sessions_formation')
      .select('id, numero_session, date_debut, date_fin, lieu, statut, formateur_id, formations_catalogue(denomination), session_clients(clients(raison_sociale)), session_participants(count)')
      .order('date_debut', { ascending: false })
      .limit(300),
    supa.from('profils').select('id, nom, prenom, formateur_externe').eq('actif', true).order('nom'),
  ]);

  const zone = $('#liste-sessions');
  if (error) { DEBUG.erreur('ecranSessions', error); zone.textContent = 'Erreur de chargement.'; return; }
  (data || []).forEach(s => {
    s.__nomsClients = (s.session_clients || []).map(sc => sc.clients?.raison_sociale).filter(Boolean);
    s.__nbStagiaires = s.session_participants?.[0]?.count || 0;
  });
  window.__sessionsToutes = data || [];
  window.__sessionsFormateursDisponibles = formateurs || [];
  filtrerEtAfficherSessions();
}

function reinitialiserFiltresSessions() {
  $('#filtre-texte').value = '';
  $('#filtre-statut').value = '';
  $('#filtre-date-debut').value = '';
  $('#filtre-date-fin').value = '';
  $('#filtre-sans-stagiaire').checked = false;
  $('#filtre-sans-formateur').checked = false;
  filtrerEtAfficherSessions();
}

function filtrerEtAfficherSessions() {
  const zone = $('#liste-sessions');
  if (!zone) return;

  const texte = ($('#filtre-texte')?.value || '').trim().toLowerCase();
  const statut = $('#filtre-statut')?.value || '';
  const dateDebut = $('#filtre-date-debut')?.value || '';
  const dateFin = $('#filtre-date-fin')?.value || '';
  const sansStagiaire = $('#filtre-sans-stagiaire')?.checked || false;
  const sansFormateur = $('#filtre-sans-formateur')?.checked || false;

  const data = (window.__sessionsToutes || []).filter(s => {
    if (statut && s.statut !== statut) return false;
    if (dateDebut && s.date_debut < dateDebut) return false;
    if (dateFin && s.date_debut > dateFin) return false;
    if (sansStagiaire && s.__nbStagiaires > 0) return false;
    if (sansFormateur && s.formateur_id) return false;
    if (texte) {
      const cible = [
        s.numero_session || '',
        (s.__nomsClients || []).join(' '),
        s.formations_catalogue?.denomination || '',
        s.lieu || '',
      ].join(' ').toLowerCase();
      if (!cible.includes(texte)) return false;
    }
    return true;
  });

  rendreZoneSuppressionGroupee();
  rendreZoneAssignationFormateurGroupee();

  if (data.length === 0) { zone.innerHTML = '<p style="color:#55636c;">Aucune session ne correspond à ces critères.</p>'; return; }

  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
      <th style="padding:6px 8px;">N°</th><th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Formation</th>
      <th style="padding:6px 8px;">Client(s)</th><th style="padding:6px 8px;text-align:right;">Stagiaires</th><th style="padding:6px 8px;">Statut</th>
    </tr></thead>
    <tbody>${data.map(s => `
      <tr style="border-top:1px solid #eee;cursor:pointer;${s.__nbStagiaires === 0 ? 'background:#fdf6e8;' : ''}" onclick="ouvrirSession('${s.id}')">
        <td style="padding:6px 8px;color:#55636c;font-variant-numeric:tabular-nums;">${esc(s.numero_session || '—')}</td>
        <td style="padding:6px 8px;">${formatDateFr(s.date_debut)}</td>
        <td style="padding:6px 8px;">${esc(s.formations_catalogue?.denomination || '')}</td>
        <td style="padding:6px 8px;">${esc((s.__nomsClients || []).join(', ') || '—')}</td>
        <td style="padding:6px 8px;text-align:right;${s.__nbStagiaires === 0 ? 'color:#b3261e;font-weight:600;' : ''}">${s.__nbStagiaires}</td>
        <td style="padding:6px 8px;">${esc(s.statut)}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

function rendreZoneSuppressionGroupee() {
  const zone = $('#bulk-suppression-zone');
  if (!zone) return;
  if (!PEUT_GERER_SESSIONS()) { zone.innerHTML = ''; return; }

  const cibles = (window.__sessionsToutes || []).filter(s => s.statut === 'terminee' && s.__nbStagiaires === 0);
  if (cibles.length === 0) { zone.innerHTML = ''; return; }

  zone.innerHTML = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
      <button class="bouton" style="background:#fdeeee;color:#b3261e;" onclick="ouvrirConfirmationSuppressionGroupee()">
        Supprimer les ${cibles.length} session(s) terminée(s) sans stagiaire
      </button>
    </div>
    <div id="suppression-groupee-zone"></div>`;
}

function sessionsSansFormateurDansPlage() {
  const debut = $('#bulk-formateur-date-debut')?.value || '';
  const fin = $('#bulk-formateur-date-fin')?.value || '';
  return (window.__sessionsToutes || []).filter(s => {
    if (s.formateur_id) return false;
    if (debut && s.date_debut < debut) return false;
    if (fin && s.date_debut > fin) return false;
    return true;
  });
}

function rendreZoneAssignationFormateurGroupee() {
  const zone = $('#bulk-formateur-zone');
  if (!zone) return;
  if (!PEUT_GERER_SESSIONS()) { zone.innerHTML = ''; return; }
  if (S.organisation && S.organisation.assignation_rapide_formateur_active === false) { zone.innerHTML = ''; return; }

  const toutesSansFormateur = (window.__sessionsToutes || []).filter(s => !s.formateur_id);
  const formateurs = window.__sessionsFormateursDisponibles || [];
  if (toutesSansFormateur.length === 0 || formateurs.length === 0) { zone.innerHTML = ''; return; }

  zone.innerHTML = `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
      <p style="font-size:13px;font-weight:600;margin:0 0 6px;">
        Assigner un formateur à <span id="bulk-formateur-compte">${toutesSansFormateur.length}</span> session(s) sans formateur
      </p>
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">
        Ce nombre porte sur toutes tes sessions sans formateur — il ne tient pas compte des filtres de recherche/statut/dates au-dessus (indépendant, par exemple, de "Sans stagiaire uniquement"). Seules les dates "Du"/"Au" ci-dessous le restreignent.
      </p>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
        <div>
          <label for="bulk-formateur-select">Formateur</label>
          <select id="bulk-formateur-select" style="min-width:220px;">
            ${formateurs.map(f => `<option value="${f.id}">${esc(f.prenom + ' ' + f.nom)}${f.formateur_externe ? ' (externe)' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="bulk-formateur-date-debut">Du</label>
          <input id="bulk-formateur-date-debut" type="date" oninput="rafraichirCompteFormateurGroupe()" onchange="rafraichirCompteFormateurGroupe()">
        </div>
        <div>
          <label for="bulk-formateur-date-fin">Au</label>
          <input id="bulk-formateur-date-fin" type="date" oninput="rafraichirCompteFormateurGroupe()" onchange="rafraichirCompteFormateurGroupe()">
        </div>
        <button class="bouton" onclick="assignerFormateurGroupe()">Assigner</button>
      </div>
      <p style="font-size:12px;color:#55636c;margin:6px 0 0;">
        Laisse les dates vides pour prendre toutes les sessions sans formateur, ou précise une période (date de début de session) pour ne cibler que celles-là.
        Vérifie ensuite au cas par cas si plusieurs formateurs étaient réellement concernés. Désactivable dans l'onglet Organisme → Outils.
      </p>
    </div>`;
}

function rafraichirCompteFormateurGroupe() {
  const compte = $('#bulk-formateur-compte');
  if (compte) compte.textContent = sessionsSansFormateurDansPlage().length;
}

async function assignerFormateurGroupe() {
  const formateurId = $('#bulk-formateur-select')?.value;
  if (!formateurId) return;
  const cibles = sessionsSansFormateurDansPlage();
  if (cibles.length === 0) { toast('Aucune session sans formateur sur cette période.', 'erreur'); return; }
  if (!confirm(`Assigner ce formateur à ${cibles.length} session(s) sans formateur ?`)) return;

  const ids = cibles.map(s => s.id);
  const { error } = await supa.from('sessions_formation').update({ formateur_id: formateurId }).in('id', ids);
  if (error) { DEBUG.erreur('assignerFormateurGroupe', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast(`Formateur assigné à ${cibles.length} session(s).`);
  ecranSessions($('#vue'));
}

function ouvrirConfirmationSuppressionGroupee() {
  const cibles = (window.__sessionsToutes || []).filter(s => s.statut === 'terminee' && s.__nbStagiaires === 0);
  const zone = $('#suppression-groupee-zone');
  zone.innerHTML = `
    <div class="carte" style="border-color:#b3261e;background:#fdeeee;margin-top:10px;">
      <h3 style="margin-top:0;color:#b3261e;">Supprimer ${cibles.length} session(s) terminée(s) sans stagiaire</h3>
      <p style="font-size:13px;">Cette action supprime définitivement ces sessions (${cibles.map(s => esc(s.numero_session || '—')).join(', ')}) et les documents associés enregistrés. Utile pour retirer les doublons créés par un import raté.</p>
      <label for="supp-groupee-texte">Pour confirmer, tape <strong>SUPPRESSION</strong> en toutes lettres ci-dessous :</label>
      <input id="supp-groupee-texte" placeholder="SUPPRESSION">
      <button class="bouton" id="supp-groupee-valider" style="margin-top:10px;background:#b3261e;" disabled>Confirmer la suppression</button>
      <button class="bouton" style="margin-top:10px;margin-left:8px;background:#eee;color:#333;" onclick="$('#suppression-groupee-zone').innerHTML=''">Annuler</button>
      <div class="erreur" id="supp-groupee-erreur"></div>
    </div>`;

  const champ = $('#supp-groupee-texte');
  const bouton = $('#supp-groupee-valider');
  champ.oninput = () => { bouton.disabled = champ.value.trim() !== 'SUPPRESSION'; };

  bouton.onclick = async () => {
    if (champ.value.trim() !== 'SUPPRESSION') return;
    bouton.disabled = true;
    bouton.textContent = 'Suppression…';
    const ids = cibles.map(s => s.id);
    const { error } = await supa.from('sessions_formation').delete().in('id', ids);
    if (error) { DEBUG.erreur('supprimerSessionsGroupe', error); $('#supp-groupee-erreur').textContent = 'Erreur : ' + error.message; bouton.disabled = false; bouton.textContent = 'Confirmer la suppression'; return; }
    toast(`${cibles.length} session(s) supprimée(s).`);
    ecranSessions($('#vue'));
  };
}

// ============================================================================
// CRÉATION D'UNE SESSION
// ============================================================================

let __nsCompteurLigneClient = 0;

async function ecranNouvelleSession(vue) {
  const { data: clients } = await supa.from('clients').select('id, raison_sociale').eq('actif', true).order('raison_sociale');
  const { data: formations } = await supa.from('formations_catalogue').select('id, code, categorie, denomination').eq('actif', true).order('categorie').order('denomination');
  const { data: formateurs } = await supa.from('profils').select('id, nom, prenom, formateur_externe').eq('actif', true).order('nom');

  const parCategorie = {};
  (formations || []).forEach(f => { (parCategorie[f.categorie] = parCategorie[f.categorie] || []).push(f); });
  window.__nsClientsDisponibles = clients || [];
  window.__nsFormations = formations || [];
  __nsCompteurLigneClient = 0;

  vue.innerHTML = `
    <div class="carte" style="max-width:620px;">
      <h2 style="margin-top:0;">Nouvelle session</h2>

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

      <label style="margin-top:14px;">Client(s) de la session</label>
      <p style="font-size:12px;color:#55636c;margin:2px 0 8px;">Une session peut réunir plusieurs entreprises (formation mutualisée) — chacune avec son propre tarif, pré-rempli depuis le catalogue mais modifiable.</p>
      <div id="ns-clients-lignes"></div>
      <datalist id="ns-clients-liste">
        ${(clients || []).map(c => `<option data-id="${c.id}" value="${esc(c.raison_sociale)}">`).join('')}
      </datalist>
      <button class="bouton" style="background:#eee;color:#333;font-size:13px;padding:6px 12px;margin-top:6px;" onclick="ajouterLigneClientSession()">+ Ajouter un client</button>

      <label for="ns-formateur" style="margin-top:14px;">Formateur</label>
      <select id="ns-formateur">
        <option value="">— Aucun / à définir —</option>
        ${(formateurs || []).map(f => `<option value="${f.id}" ${S.profil.role === 'formateur' && f.id === S.profil.id ? 'selected' : ''}>${esc(f.prenom + ' ' + f.nom)}${f.formateur_externe ? ' (externe)' : ''}</option>`).join('')}
      </select>
      <p style="font-size:12px;color:#55636c;margin:2px 0 0;">Sert au calcul des heures de formation par formateur (BPF cadre D et E) — assigne-le même s'il n'est pas encore connu de tous les stagiaires.</p>

      <label for="ns-modalite" style="margin-top:14px;">Modalité</label>
      <select id="ns-modalite">
        <option value="presentiel" selected>Présentiel</option>
        <option value="distanciel">Distanciel (classe virtuelle, e-learning…)</option>
        <option value="mixte">Mixte</option>
      </select>

      <label for="ns-origine" style="margin-top:14px;">Origine du financement</label>
      <select id="ns-origine">
        ${ORIGINES_FINANCEMENT.map(g => `
          <optgroup label="${esc(g.groupe)}">
            ${g.options.map(o => `<option value="${o.valeur}" ${o.valeur === 'entreprise' ? 'selected' : ''}>${esc(o.libelle)}</option>`).join('')}
          </optgroup>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-weight:normal;margin-top:8px;">
        <input type="checkbox" id="ns-sous-traitance" style="width:auto;">
        Session confiée par un autre organisme de formation (sous-traitance reçue)
      </label>
      <p style="font-size:12px;color:#55636c;margin:2px 0 0;">Sert au calcul automatique du Bilan Pédagogique et Financier (BPF) annuel.</p>

      <button class="bouton" id="ns-valider" style="margin-top:16px;">Créer la session</button>
      <button class="bouton" style="margin-top:16px;margin-left:8px;background:#eee;color:#333;" onclick="allerA('sessions')">Annuler</button>
      <div class="erreur" id="ns-erreur"></div>
    </div>`;

  ajouterLigneClientSession();

  $('#ns-formation').onchange = (e) => {
    const f = (formations || []).find(x => x.id === e.target.value);
    if (f && f.prix != null) {
      $$('.ns-client-prix').forEach(input => { if (!input.value) input.value = f.prix; });
    }
  };

  $('#ns-valider').onclick = async () => {
    const formationId = $('#ns-formation').value;
    const dateDebut = $('#ns-date-debut').value;
    const dateFin = $('#ns-date-fin').value || dateDebut;
    const lieu = $('#ns-lieu').value.trim();
    const origineFinancement = $('#ns-origine').value;
    const sousTraitanceRecue = $('#ns-sous-traitance').checked;

    if (!formationId || !dateDebut) { $('#ns-erreur').textContent = 'Formation et date de début obligatoires.'; return; }

    const lignesClients = lireLignesClientSession();
    if (lignesClients.erreur) { $('#ns-erreur').textContent = lignesClients.erreur; return; }

    const premier = lignesClients.valides[0];
    const { data, error } = await supa.from('sessions_formation').insert({
      organisation_id: S.organisation.id,
      formation_id: formationId,
      client_id: premier ? premier.clientId : null,     // client "principal" pour compatibilité — la vérité est dans session_clients
      lieu: lieu || null,
      date_debut: dateDebut,
      date_fin: dateFin,
      prix_unitaire: premier ? premier.prix : null,
      modalite: $('#ns-modalite').value,
      origine_financement: origineFinancement,
      sous_traitance_recue: sousTraitanceRecue,
      formateur_id: $('#ns-formateur').value || null,
    }).select().single();

    if (error) { DEBUG.erreur('creerSession', error); $('#ns-erreur').textContent = 'Erreur : ' + error.message; return; }

    if (lignesClients.valides.length) {
      const { error: errClients } = await supa.from('session_clients').insert(
        lignesClients.valides.map(l => ({
          organisation_id: S.organisation.id,
          session_id: data.id,
          client_id: l.clientId,
          prix_unitaire: l.prix,
          numero_devis: l.devis,
        }))
      );
      if (errClients) { DEBUG.erreur('creerSessionClients', errClients); toast('Session créée, mais erreur sur les clients : ' + errClients.message, 'erreur'); }
    }

    toast('Session créée.');
    ouvrirSession(data.id);
  };
}

function ajouterLigneClientSession() {
  const id = ++__nsCompteurLigneClient;
  const zone = $('#ns-clients-lignes');
  const ligne = document.createElement('div');
  ligne.className = 'ns-ligne-client';
  ligne.dataset.id = id;
  ligne.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;';
  ligne.innerHTML = `
    <div style="flex:2;">
      <input class="ns-client-input" list="ns-clients-liste" placeholder="Rechercher un client…">
    </div>
    <div style="flex:1;">
      <input class="ns-client-prix" type="number" step="0.01" placeholder="Tarif (€)">
    </div>
    <div style="flex:1;">
      <input class="ns-client-devis" placeholder="N° devis">
    </div>
    <button type="button" class="bouton" style="background:#fdeeee;color:#b3261e;padding:8px 10px;" onclick="this.closest('.ns-ligne-client').remove()">✕</button>`;
  zone.appendChild(ligne);
}

function lireLignesClientSession() {
  const lignes = $$('.ns-ligne-client');
  const valides = [];
  for (const ligne of lignes) {
    const texte = $('.ns-client-input', ligne).value.trim();
    if (!texte) continue;
    const option = $$('#ns-clients-liste option').find(o => o.value === texte);
    if (!option) return { erreur: `Client "${texte}" introuvable dans la liste — choisis-le parmi les suggestions.` };
    const clientId = option.dataset.id;
    if (valides.some(v => v.clientId === clientId)) return { erreur: `Le client "${texte}" est renseigné plusieurs fois.` };
    const prixTxt = $('.ns-client-prix', ligne).value;
    valides.push({
      clientId,
      prix: prixTxt ? Number(prixTxt) : null,
      devis: $('.ns-client-devis', ligne).value.trim() || null,
    });
  }
  return { valides };
}

// ============================================================================
// DÉTAIL D'UNE SESSION — participants, FISE, évaluations
// ============================================================================

async function ouvrirSession(id) {
  S.ongletActif = 'sessions';
  S.categorieActive = (typeof categorieDeLOnglet === 'function' && categorieDeLOnglet('sessions')?.id) || S.categorieActive;
  rendreMenuLateral();
  rendreSousOnglets();
  const vue = $('#vue');
  vue.innerHTML = '<div class="carte">Chargement…</div>';

  const { data: session, error } = await supa
    .from('sessions_formation')
    .select('*, formations_catalogue(*)')
    .eq('id', id)
    .single();

  if (error) { DEBUG.erreur('ouvrirSession', error); vue.innerHTML = '<div class="carte">Session introuvable ou accès refusé.</div>'; return; }

  const [{ data: participants }, { data: sessionClients }, { data: formateursDisponibles }] = await Promise.all([
    supa.from('session_participants').select('*, stagiaires(civilite, nom, prenom, date_naissance), clients(raison_sociale, ville)').eq('session_id', id),
    supa.from('session_clients').select('*, clients(raison_sociale, ville)').eq('session_id', id).order('created_at'),
    PEUT_GERER_SESSIONS() ? supa.from('profils').select('id, nom, prenom, formateur_externe').eq('actif', true).order('nom') : Promise.resolve({ data: [] }),
  ]);

  window.__sessionClients = sessionClients || [];
  const nomsClients = (sessionClients || []).map(sc => sc.clients?.raison_sociale).filter(Boolean);

  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h2 style="margin:0 0 4px;">${esc(session.formations_catalogue?.denomination || '')} <span style="color:#55636c;font-weight:normal;font-size:14px;">— n° ${esc(session.numero_session || '—')}</span></h2>
        <p style="margin:0;color:#55636c;font-size:14px;">
          ${formatDateFr(session.date_debut)}${session.date_fin !== session.date_debut ? ' → ' + formatDateFr(session.date_fin) : ''}
          — ${esc(session.lieu || 'lieu non renseigné')}
          — ${esc(nomsClients.join(', ') || 'sans client')}
          — statut : ${esc(session.statut)}
        </p>
      </div>
      <div style="text-align:right;">
        <button class="bouton" style="background:#eee;color:#333;" onclick="allerA('sessions')">← Retour</button>
        ${PEUT_GERER_SESSIONS() && (session.statut !== 'terminee' || (participants || []).length === 0) ? `
        <button class="bouton" style="background:#fdeeee;color:#b3261e;margin-left:8px;" onclick="ouvrirConfirmationSuppression('${session.id}', ${(participants || []).length})">Supprimer</button>` : ''}
      </div>
    </div>

    <div id="suppression-zone"></div>

    ${PEUT_GERER_SESSIONS() ? `
    <div class="carte">
      <h3 style="margin-top:0;">Clients de la session</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 10px;">Chaque client a son propre tarif — utile pour une formation mutualisée entre plusieurs entreprises.</p>
      <div id="sess-clients-liste"></div>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:10px;">
        <div style="flex:2;">
          <label for="sess-client-nouveau">Ajouter un client</label>
          <input id="sess-client-nouveau" list="sess-clients-liste-datalist" placeholder="Rechercher un client…">
          <datalist id="sess-clients-liste-datalist"></datalist>
        </div>
        <div style="flex:1;"><label for="sess-client-nouveau-prix">Tarif (€)</label><input id="sess-client-nouveau-prix" type="number" step="0.01"></div>
        <div style="flex:1;"><label for="sess-client-nouveau-devis">N° devis</label><input id="sess-client-nouveau-devis"></div>
        <button class="bouton" style="padding:8px 14px;" onclick="ajouterClientSessionExistante('${session.id}')">Ajouter</button>
      </div>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">Financement et formateur</h3>
      <label for="sess-formateur">Formateur</label>
      <select id="sess-formateur" style="max-width:420px;">
        <option value="">— Aucun / à définir —</option>
        ${(formateursDisponibles || []).map(f => `<option value="${f.id}" ${f.id === session.formateur_id ? 'selected' : ''}>${esc(f.prenom + ' ' + f.nom)}${f.formateur_externe ? ' (externe)' : ''}</option>`).join('')}
      </select>
      <p style="font-size:12px;color:#55636c;margin:2px 0 8px;">Sert au calcul des heures par formateur (BPF cadres D et E).</p>
      <label for="sess-modalite">Modalité</label>
      <select id="sess-modalite" style="max-width:420px;">
        <option value="presentiel" ${session.modalite === 'presentiel' ? 'selected' : ''}>Présentiel</option>
        <option value="distanciel" ${session.modalite === 'distanciel' ? 'selected' : ''}>Distanciel (classe virtuelle, e-learning…)</option>
        <option value="mixte" ${session.modalite === 'mixte' ? 'selected' : ''}>Mixte</option>
      </select>
      <label for="sess-origine">Origine du financement</label>
      <select id="sess-origine" style="max-width:420px;">
        ${ORIGINES_FINANCEMENT.map(g => `
          <optgroup label="${esc(g.groupe)}">
            ${g.options.map(o => `<option value="${o.valeur}" ${o.valeur === session.origine_financement ? 'selected' : ''}>${esc(o.libelle)}</option>`).join('')}
          </optgroup>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;font-weight:normal;margin-top:8px;">
        <input type="checkbox" id="sess-sous-traitance" style="width:auto;" ${session.sous_traitance_recue ? 'checked' : ''}>
        Session confiée par un autre organisme de formation (sous-traitance reçue)
      </label>
      <button class="bouton" style="padding:6px 14px;font-size:13px;margin-top:10px;" onclick="enregistrerFinancementSession('${session.id}')">Enregistrer</button>
      <p style="font-size:12px;color:#55636c;margin:8px 0 0;">Sert au calcul automatique du Bilan Pédagogique et Financier (BPF) annuel.</p>
    </div>` : ''}

    <div class="carte">
      <h3 style="margin-top:0;">Documents de la session</h3>
      ${(sessionClients && sessionClients.length) ?
        sessionClients.map(sc => `<button class="bouton" style="margin:0 8px 8px 0;" onclick="genererConventionPourClient('${sc.client_id}')">Convention — ${esc(sc.clients?.raison_sociale || '')}</button>`).join('')
        : `<button class="bouton" style="margin:0 8px 8px 0;" onclick="genererConvention(window.__sessionCourante, window.__participantsCourants)">Convention</button>`}
      <button class="bouton" style="margin:0 0 8px;" onclick="genererFeuillePresence(window.__sessionCourante, window.__participantsCourants)">Feuille d'émargement</button>
      <p style="font-size:12px;color:#55636c;margin:8px 0 0;">Chaque client a sa propre Convention (tarif et liste de stagiaires qui lui sont rattachés). La feuille d'émargement n'a pas de modèle papier de référence confirmé — mise en page à ajuster si besoin.</p>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">Téléchargement groupé et envoi au client</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Sélectionne les documents à télécharger en une fois (ZIP) ou à envoyer par email au client.</p>
      <div id="selection-documents">Chargement…</div>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">Participants</h3>
      <div id="participants-liste"></div>
      ${PEUT_GERER_SESSIONS() ? `
      <div style="margin-top:16px;border-top:1px solid #eee;padding-top:16px;">
        ${sessionClients && sessionClients.length > 1 ? `
        <label for="sp-client">Entreprise cliente du stagiaire à ajouter</label>
        <select id="sp-client">
          ${sessionClients.map(sc => `<option value="${sc.client_id}">${esc(sc.clients?.raison_sociale || '')}</option>`).join('')}
        </select>` : ''}
        <label for="sp-recherche">Ajouter un stagiaire (recherche par nom / prénom)</label>
        <input id="sp-recherche" placeholder="Nom ou prénom…">
        <div id="sp-resultats" style="margin-top:8px;"></div>
      </div>` : ''}
    </div>`;

  rendreParticipants(session, participants || []);
  rendreSelectionDocuments(session, participants || []);

  if (PEUT_GERER_SESSIONS()) {
    rendreClientsSession(session.id, window.__sessionClients);
    let timer;
    $('#sp-recherche').oninput = (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => rechercherStagiaires(e.target.value.trim(), session), 250);
    };
  }
}

// Génère la Convention de formation pour UN client de la session (chaque
// client a sa propre Convention — tarif et annexe limités à ses stagiaires).
function genererConventionPourClient(clientId) {
  const clientEntry = (window.__sessionClients || []).find(sc => sc.client_id === clientId);
  if (!clientEntry) { toast('Client introuvable pour cette session.', 'erreur'); return; }
  genererConvention(window.__sessionCourante, window.__participantsCourants, false, clientEntry);
}

// Détermine le client actuellement sélectionné pour l'ajout d'un stagiaire à
// une session (le sélecteur s'il y a plusieurs clients, sinon le seul client
// de la session, sinon aucun).
function clientSelectionnePourAjout(session) {
  const selecteur = $('#sp-client');
  if (selecteur) return selecteur.value || null;
  const clients = window.__sessionClients || [];
  return clients.length === 1 ? clients[0].client_id : null;
}

// ============================================================================
// CLIENTS DE LA SESSION (une session peut en réunir plusieurs, chacun avec
// son propre tarif — voir session_clients).
// ============================================================================

function rendreClientsSession(sessionId, sessionClients) {
  const zone = $('#sess-clients-liste');
  if (!zone) return;

  if (!sessionClients.length) {
    zone.innerHTML = '<p style="color:#55636c;font-size:13px;">Aucun client rattaché à cette session pour l\'instant.</p>';
  } else {
    zone.innerHTML = sessionClients.map(sc => `
      <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #eee;font-size:13px;">
        <strong style="flex:2;">${esc(sc.clients?.raison_sociale || '')}</strong>
        <input type="number" step="0.01" class="sc-prix" data-scid="${sc.id}" value="${sc.prix_unitaire != null ? sc.prix_unitaire : ''}" placeholder="Tarif (€)" style="flex:1;">
        <input class="sc-devis" data-scid="${sc.id}" value="${esc(sc.numero_devis || '')}" placeholder="N° devis" style="flex:1;">
        <button class="bouton" style="padding:5px 10px;font-size:12px;" onclick="enregistrerClientSession('${sc.id}')">Enregistrer</button>
        <button class="bouton" style="padding:5px 10px;font-size:12px;background:#fdeeee;color:#b3261e;" onclick="retirerClientSession('${sc.id}', '${sessionId}')">Retirer</button>
      </div>`).join('');
  }

  // Datalist "ajouter un client" : uniquement les clients pas encore dans la session.
  const dejaPresents = new Set(sessionClients.map(sc => sc.client_id));
  supa.from('clients').select('id, raison_sociale').eq('actif', true).order('raison_sociale').then(({ data }) => {
    const dl = $('#sess-clients-liste-datalist');
    if (dl) dl.innerHTML = (data || []).filter(c => !dejaPresents.has(c.id)).map(c => `<option data-id="${c.id}" value="${esc(c.raison_sociale)}">`).join('');
  });
}

async function enregistrerClientSession(sessionClientId) {
  const prixInput = document.querySelector(`.sc-prix[data-scid="${sessionClientId}"]`);
  const devisInput = document.querySelector(`.sc-devis[data-scid="${sessionClientId}"]`);
  const { error } = await supa.from('session_clients').update({
    prix_unitaire: prixInput.value ? Number(prixInput.value) : null,
    numero_devis: devisInput.value.trim() || null,
  }).eq('id', sessionClientId);
  if (error) { DEBUG.erreur('enregistrerClientSession', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Tarif client mis à jour.');
}

async function retirerClientSession(sessionClientId, sessionId) {
  const { error } = await supa.from('session_clients').delete().eq('id', sessionClientId);
  if (error) { DEBUG.erreur('retirerClientSession', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Client retiré de la session.');
  ouvrirSession(sessionId);
}

async function ajouterClientSessionExistante(sessionId) {
  const texte = $('#sess-client-nouveau').value.trim();
  const option = $$('#sess-clients-liste-datalist option').find(o => o.value === texte);
  if (!option) { toast('Choisis un client dans la liste des suggestions.', 'erreur'); return; }

  const { error } = await supa.from('session_clients').insert({
    organisation_id: S.organisation.id,
    session_id: sessionId,
    client_id: option.dataset.id,
    prix_unitaire: $('#sess-client-nouveau-prix').value ? Number($('#sess-client-nouveau-prix').value) : null,
    numero_devis: $('#sess-client-nouveau-devis').value.trim() || null,
  });
  if (error) {
    if (error.code === '23505') { toast('Ce client est déjà rattaché à cette session.', 'erreur'); return; }
    DEBUG.erreur('ajouterClientSessionExistante', error); toast('Erreur : ' + error.message, 'erreur'); return;
  }
  toast('Client ajouté à la session.');
  ouvrirSession(sessionId);
}

async function enregistrerFinancementSession(sessionId) {
  const origine = $('#sess-origine').value;
  const sousTraitance = $('#sess-sous-traitance').checked;
  const modalite = $('#sess-modalite').value;
  const formateurId = $('#sess-formateur')?.value || null;
  const { error } = await supa.from('sessions_formation').update({ origine_financement: origine, sous_traitance_recue: sousTraitance, modalite, formateur_id: formateurId }).eq('id', sessionId);
  if (error) { DEBUG.erreur('enregistrerFinancementSession', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Financement mis à jour.');
  if (window.__sessionCourante) {
    window.__sessionCourante.origine_financement = origine;
    window.__sessionCourante.sous_traitance_recue = sousTraitance;
    window.__sessionCourante.modalite = modalite;
    window.__sessionCourante.formateur_id = formateurId;
  }
}

function ouvrirConfirmationSuppression(sessionId, nbStagiaires) {
  const zone = $('#suppression-zone');
  zone.innerHTML = `
    <div class="carte" style="border-color:#b3261e;background:#fdeeee;">
      <h3 style="margin-top:0;color:#b3261e;">Supprimer cette session</h3>
      <p style="font-size:13px;">Cette action supprime définitivement la session, ses inscriptions et les documents associés enregistrés.${nbStagiaires > 0 ? '' : ' Cette session ne compte aucun stagiaire — c\'est sans risque, notamment pour retirer un doublon créé par erreur lors d\'un import.'}</p>
      <label for="supp-texte">Pour confirmer, tape <strong>SUPPRESSION</strong> en toutes lettres ci-dessous :</label>
      <input id="supp-texte" placeholder="SUPPRESSION">
      <button class="bouton" id="supp-valider" style="margin-top:10px;background:#b3261e;" disabled>Confirmer la suppression</button>
      <button class="bouton" style="margin-top:10px;margin-left:8px;background:#eee;color:#333;" onclick="$('#suppression-zone').innerHTML=''">Annuler</button>
      <div class="erreur" id="supp-erreur"></div>
    </div>`;

  const champ = $('#supp-texte');
  const bouton = $('#supp-valider');
  champ.oninput = () => { bouton.disabled = champ.value.trim() !== 'SUPPRESSION'; };

  bouton.onclick = async () => {
    if (champ.value.trim() !== 'SUPPRESSION') return;
    const { error } = await supa.from('sessions_formation').delete().eq('id', sessionId);
    if (error) { DEBUG.erreur('supprimerSession', error); $('#supp-erreur').textContent = 'Erreur : ' + error.message; return; }
    toast('Session supprimée.');
    allerA('sessions');
  };
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

  const clientChoisi = clientSelectionnePourAjout(session);

  // Priorité d'affichage aux stagiaires déjà liés au client sélectionné pour l'ajout
  const tries = (data || []).slice().sort((a, b) => {
    const aMatch = a.client_id === clientChoisi ? 0 : 1;
    const bMatch = b.client_id === clientChoisi ? 0 : 1;
    return aMatch - bMatch;
  });

  zone.innerHTML = `
    ${tries.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:6px;font-size:13px;">
        <span>${esc(s.prenom)} ${esc(s.nom)} ${s.date_naissance ? '— né(e) le ' + formatDateFr(s.date_naissance) : ''} ${s.clients?.raison_sociale ? '— ' + esc(s.clients.raison_sociale) : ''}
          ${s.client_id === clientChoisi && clientChoisi ? '<span style="color:#0a5c8a;font-weight:600;">(même client)</span>' : ''}
        </span>
        <button class="bouton" style="padding:4px 10px;font-size:12px;" onclick="ajouterParticipant('${s.id}', '${session.id}', '${clientChoisi || ''}')">Ajouter</button>
      </div>`).join('')}
    <div style="padding:8px;border:1px dashed #c9c9c9;border-radius:6px;font-size:13px;color:#55636c;">
      Stagiaire introuvable ?
      <button class="bouton" style="padding:4px 10px;font-size:12px;margin-left:6px;" onclick="ouvrirFormNouveauStagiaire('${texte.replace(/'/g, "\\'")}', '${session.id}', '${clientChoisi || ''}')">Créer "${esc(texte)}"</button>
    </div>`;
}

async function ajouterParticipant(stagiaireId, sessionId, clientId) {
  const { error } = await supa.from('session_participants').insert({
    organisation_id: S.organisation.id,
    session_id: sessionId,
    stagiaire_id: stagiaireId,
    client_id: clientId || null,
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
  ajouterParticipant(stagiaire.id, sessionId, clientId);
}
