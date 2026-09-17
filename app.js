// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// app.js — métier : écrans et logique applicative.
// Squelette de départ : seul l'écran "Accueil" est implémenté. Les écrans
// Clients, Stagiaires, Catalogue, Sessions, Documents seront ajoutés par
// domaine fonctionnel au fil du développement (voir MEMOIRE_PROJET.md, §9).

// Onglets visibles par rôle. À enrichir au fur et à mesure des écrans livrés.
window.ROLES_ONGLETS = {
  super_admin: [['accueil', 'Accueil'], ['organisations', 'Organisations']],
  admin: [['accueil', 'Accueil'], ['clients', 'Clients'], ['stagiaires', 'Stagiaires'], ['catalogue', 'Catalogue'], ['sessions', 'Sessions']],
  gestionnaire: [['accueil', 'Accueil'], ['clients', 'Clients'], ['stagiaires', 'Stagiaires'], ['sessions', 'Sessions']],
  formateur: [['accueil', 'Accueil'], ['sessions', 'Sessions']],
};

function ecranAccueil(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin-top:0;">Bienvenue, ${esc(S.profil.prenom || '')}</h2>
      <p>Organisation : <strong>${esc(S.organisation.raison_sociale)}</strong> — rôle : ${esc(S.profil.role)}</p>
      <p style="color:#55636c;font-size:14px;">
        Ceci est le socle de l'application (connexion, routage, base de données).
        Les écrans de gestion (clients, stagiaires, catalogue de formations,
        sessions, génération des documents) restent à construire — voir le
        backlog dans <code>MEMOIRE_PROJET.md</code>.
      </p>
    </div>`;
}

window.DISPATCH_ONGLETS = {
  accueil: ecranAccueil,
  // clients: ecranClients,        // à venir
  // stagiaires: ecranStagiaires,  // à venir
  // catalogue: ecranCatalogue,    // à venir
  // sessions: ecranSessions,      // à venir
  // organisations: ecranOrganisations, // à venir (super_admin)
};
