// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// app.js — métier : menu latéral (catégories) + sous-onglets par catégorie,
// et table de dispatch. Les écrans eux-mêmes sont répartis par domaine dans
// des fichiers dédiés (dashboard.js, sessions.js, ...), chargés après
// celui-ci dans index.html.

// Menu latéral par rôle. Chaque catégorie a un id, un libellé, une icône et
// une liste de sous-onglets [id, libellé] (le premier sous-onglet est
// l'écran affiché par défaut en arrivant sur la catégorie). Une catégorie à
// un seul sous-onglet (ex. Accueil) s'ouvre directement dessus, sans barre
// de sous-onglets. À enrichir au fil des écrans livrés.
window.CATEGORIES_MENU = {
  super_admin: [
    { id: 'accueil', libelle: 'Accueil', icone: '🏠', onglets: [['accueil', 'Accueil']] },
    { id: 'administration', libelle: 'Administration', icone: '⚙️', onglets: [['organisations', 'Organisations']] },
  ],
  admin: [
    { id: 'accueil', libelle: 'Accueil', icone: '🏠', onglets: [['accueil', 'Accueil']] },
    { id: 'activite', libelle: 'Activité formation', icone: '📚', onglets: [['activite-dashboard', 'Tableau de bord'], ['catalogue', 'Catalogue'], ['sessions', 'Sessions'], ['bpf', 'BPF']] },
    { id: 'contacts', libelle: 'Contacts', icone: '👥', onglets: [['clients', 'Clients'], ['stagiaires', 'Stagiaires']] },
    { id: 'intervenants', libelle: 'Intervenants', icone: '🎓', onglets: [['intervenants-dashboard', 'Tableau de bord'], ['formateurs', 'Formateurs'], ['soustraitants', 'Organismes sous-traitants']] },
    { id: 'administration', libelle: 'Administration', icone: '⚙️', onglets: [['organisation', 'Organisme'], ['import', 'Import']] },
  ],
  gestionnaire: [
    { id: 'accueil', libelle: 'Accueil', icone: '🏠', onglets: [['accueil', 'Accueil']] },
    { id: 'activite', libelle: 'Activité formation', icone: '📚', onglets: [['sessions', 'Sessions']] },
    { id: 'contacts', libelle: 'Contacts', icone: '👥', onglets: [['clients', 'Clients'], ['stagiaires', 'Stagiaires']] },
  ],
  // Un formateur n'a accès qu'à ses propres sessions (agenda, FISE,
  // évaluations des stagiaires) — la RLS sur sessions_formation /
  // session_participants filtre déjà côté base sur formateur_id = auth.uid().
  formateur: [
    { id: 'accueil', libelle: 'Accueil', icone: '🏠', onglets: [['accueil', 'Accueil']] },
    { id: 'activite', libelle: 'Activité formation', icone: '📚', onglets: [['sessions', 'Sessions']] },
  ],
};

window.DISPATCH_ONGLETS = {
  accueil: ecranAccueil,        // dashboard.js
  sessions: ecranSessions,      // sessions.js
  catalogue: ecranCatalogue,    // catalogue.js
  import: ecranImport,          // import_excel.js
  clients: ecranClients,        // clients.js
  soustraitants: ecranSousTraitants, // clients.js (clients de type organisme_formation)
  bpf: ecranBPF,                 // bpf.js
  formateurs: ecranFormateurs,   // formateurs.js
  'intervenants-dashboard': ecranTableauBordIntervenants, // dashboard_intervenants.js
  'activite-dashboard': ecranTableauBordActivite, // dashboard_activite.js
  organisation: ecranOrganisation, // organisation.js
  // stagiaires: ecranStagiaires,  // à venir
  // organisations: ecranOrganisations, // à venir (super_admin)
};
