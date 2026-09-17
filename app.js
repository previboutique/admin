// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// app.js — métier : liste des écrans par rôle et table de dispatch.
// Les écrans eux-mêmes sont répartis par domaine dans des fichiers dédiés
// (dashboard.js, sessions.js, ...), chargés après celui-ci dans index.html.

// Onglets visibles par rôle. À enrichir au fil des écrans livrés.
window.ROLES_ONGLETS = {
  super_admin: [['accueil', 'Accueil'], ['organisations', 'Organisations']],
  admin: [['accueil', 'Accueil'], ['clients', 'Clients'], ['stagiaires', 'Stagiaires'], ['catalogue', 'Catalogue'], ['sessions', 'Sessions'], ['import', 'Import']],
  gestionnaire: [['accueil', 'Accueil'], ['clients', 'Clients'], ['stagiaires', 'Stagiaires'], ['sessions', 'Sessions']],
  // Un formateur n'a accès qu'à ses propres sessions (agenda, FISE,
  // évaluations des stagiaires) — la RLS sur sessions_formation /
  // session_participants filtre déjà côté base sur formateur_id = auth.uid().
  formateur: [['accueil', 'Accueil'], ['sessions', 'Sessions']],
};

window.DISPATCH_ONGLETS = {
  accueil: ecranAccueil,        // dashboard.js
  sessions: ecranSessions,      // sessions.js
  catalogue: ecranCatalogue,    // catalogue.js
  import: ecranImport,          // import_excel.js
  clients: ecranClients,        // clients.js
  // stagiaires: ecranStagiaires,  // à venir
  // organisations: ecranOrganisations, // à venir (super_admin)
};
