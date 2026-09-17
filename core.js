// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// core.js — socle : connexion Supabase, authentification, état global S,
// routage entre onglets.

// Clé publique par conception : c'est la Row Level Security côté base qui
// protège les données, pas le secret de cette clé.
const SUPABASE_URL = 'https://kzahahrnauynnrfznkje.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VpOYj7KajWRHJKyjPyLh_g_mgabFpgZ';

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// État global de l'application
const S = {
  session: null,       // session Supabase Auth
  profil: null,         // ligne "profils" de l'utilisateur connecté
  organisation: null,   // ligne "organisations" de l'utilisateur connecté
  vision: null,          // rôle actif affiché (peut différer de profil.role pour l'ergonomie)
  ongletActif: null,
};

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function esc(txt) {
  if (txt === null || txt === undefined) return '';
  return String(txt).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, type) {
  DEBUG.log('TOAST', type || 'info', msg);
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:16px;right:16px;background:${type === 'erreur' ? '#b3261e' : '#0a5c8a'};color:#fff;padding:10px 16px;border-radius:6px;font-size:14px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Liste des onglets par rôle. Calculée dynamiquement selon S.vision.
// [id, libellé] — filtrée par ROLES_ONGLETS[role] défini dans app.js.
function onglestPourRole(role) {
  const table = window.ROLES_ONGLETS || {};
  return table[role] || [];
}

async function chargerProfil() {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) { S.profil = null; S.organisation = null; return; }

  const { data: profil, error: errProfil } = await supa.from('profils').select('*').eq('id', user.id).single();
  if (errProfil) { DEBUG.erreur('chargerProfil', errProfil); return; }
  S.profil = profil;
  S.vision = profil.role;

  const { data: org, error: errOrg } = await supa.from('organisations').select('*').eq('id', profil.organisation_id).single();
  if (errOrg) { DEBUG.erreur('chargerOrganisation', errOrg); return; }
  S.organisation = org;
  $('#titre-organisation').textContent = org.raison_sociale || 'Admin Formation';
}

function rendreOnglets() {
  const nav = $('#onglets');
  nav.innerHTML = '';
  const onglets = onglestPourRole(S.vision);
  onglets.forEach(([id, libelle]) => {
    const btn = document.createElement('button');
    btn.textContent = libelle;
    btn.className = id === S.ongletActif ? 'actif' : '';
    btn.onclick = () => allerA(id);
    nav.appendChild(btn);
  });
}

function allerA(id) {
  S.ongletActif = id;
  rendreOnglets();
  const dispatch = window.DISPATCH_ONGLETS || {};
  const fn = dispatch[id];
  const vue = $('#vue');
  if (fn) {
    vue.innerHTML = '';
    fn(vue);
  } else {
    vue.innerHTML = '<p>Écran non implémenté : ' + esc(id) + '</p>';
  }
}

async function deconnexion() {
  await supa.auth.signOut();
  location.reload();
}

function rendreEcranConnexion() {
  const vue = $('#vue');
  $('#onglets').innerHTML = '';
  vue.innerHTML = `
    <div class="carte" style="max-width:360px;margin:60px auto;">
      <h2 style="margin-top:0;font-size:18px;">Connexion</h2>
      <label for="ci-email">Email</label>
      <input id="ci-email" type="email" autocomplete="username">
      <label for="ci-mdp">Mot de passe</label>
      <input id="ci-mdp" type="password" autocomplete="current-password">
      <button class="bouton" id="ci-valider" style="margin-top:16px;width:100%;">Se connecter</button>
      <div class="erreur" id="ci-erreur"></div>
    </div>`;
  $('#ci-valider').onclick = async () => {
    const email = $('#ci-email').value.trim();
    const mdp = $('#ci-mdp').value;
    const { error } = await supa.auth.signInWithPassword({ email, password: mdp });
    if (error) { $('#ci-erreur').textContent = 'Connexion refusée : ' + error.message; return; }
    await demarrer();
  };
}

async function demarrer() {
  const { data: { session } } = await supa.auth.getSession();
  S.session = session;
  if (!session) { rendreEcranConnexion(); return; }

  await chargerProfil();
  if (!S.profil) {
    toast('Aucun profil trouvé pour ce compte — contacter un administrateur.', 'erreur');
    rendreEcranConnexion();
    return;
  }

  $('#zone-utilisateur').innerHTML = `
    <span style="font-size:13px;margin-right:12px;">${esc(S.profil.prenom || '')} ${esc(S.profil.nom || '')}</span>
    <button class="bouton" style="background:#fff2;padding:6px 12px;" id="btn-deconnexion">Déconnexion</button>`;
  $('#btn-deconnexion').onclick = deconnexion;

  const onglets = onglestPourRole(S.vision);
  allerA(onglets[0] ? onglets[0][0] : null);
}

supa.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') rendreEcranConnexion();
});

document.addEventListener('DOMContentLoaded', demarrer);
