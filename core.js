// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// core.js — socle : connexion Supabase, authentification, état global S,
// routage entre onglets.

// ⚠️ À COMPLÉTER : remplacer par l'URL et la clé publique ("anon") de ton
// projet Supabase (Supabase → Project Settings → API). La clé "anon" est
// publique par conception : c'est la Row Level Security côté base qui protège
// les données, pas le secret de cette clé.
const SUPABASE_URL = 'https://kzahahrnauynnrfznkje.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VpOYj7KajWRHJKyjPyLh_g_mgabFpgZ';

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// État global de l'application
const S = {
  session: null,       // session Supabase Auth
  profil: null,         // ligne "profils" de l'utilisateur connecté
  organisation: null,   // ligne "organisations" de l'utilisateur connecté
  vision: null,          // rôle actif affiché (peut différer de profil.role pour l'ergonomie)
  categorieActive: null, // id de la catégorie sélectionnée dans le menu latéral
  ongletActif: null,     // id du sous-onglet affiché dans la catégorie active
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

// Catégories du menu latéral par rôle. Calculées dynamiquement selon
// S.vision — table CATEGORIES_MENU[role] définie dans app.js. Chaque
// catégorie : { id, libelle, icone, onglets: [[id, libellé], ...] }.
function categoriesPourRole(role) {
  const table = window.CATEGORIES_MENU || {};
  return table[role] || [];
}

// Retrouve la catégorie qui contient un sous-onglet donné (utile quand
// allerA(id) est appelé directement, sans passer par le menu latéral).
function categorieDeLOnglet(ongletId) {
  return categoriesPourRole(S.vision).find(cat => cat.onglets.some(([id]) => id === ongletId));
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
  await chargerImagesIdentite();
  appliquerIdentiteVisuelle();
}

// Précharge logo/signature/tampon en base64 (data URL) sur S.organisation,
// pour un usage synchrone dans pdf.js (évite de rendre chaque générateur de
// PDF asynchrone juste pour aller chercher une image sur le réseau).
async function chargerImagesIdentite() {
  const champs = { logo_url: '_logoDataUrl', signature_url: '_signatureDataUrl', tampon_url: '_tamponDataUrl' };
  await Promise.all(Object.entries(champs).map(async ([champUrl, champCache]) => {
    const url = S.organisation?.[champUrl];
    if (!url) { S.organisation[champCache] = null; return; }
    try {
      const reponse = await fetch(url);
      const blob = await reponse.blob();
      S.organisation[champCache] = await new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = reject;
        lecteur.readAsDataURL(blob);
      });
    } catch (e) {
      DEBUG.erreur('chargerImagesIdentite', e);
      S.organisation[champCache] = null;
    }
  }));
}

// Affiche le logo de l'organisme dans l'en-tête de l'appli, s'il existe.
function appliquerIdentiteVisuelle() {
  const zone = $('#logo-organisation');
  if (!zone) return;
  if (S.organisation?.logo_url) {
    zone.src = S.organisation.logo_url;
    zone.style.display = 'inline-block';
  } else {
    zone.style.display = 'none';
  }
}

function rendreMenuLateral() {
  const nav = $('#menu-lateral');
  if (!nav) return;
  nav.innerHTML = '';
  categoriesPourRole(S.vision).forEach(cat => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="cat-icone">${cat.icone || ''}</span><span>${esc(cat.libelle)}</span>`;
    btn.className = cat.id === S.categorieActive ? 'actif' : '';
    btn.onclick = () => allerACategorie(cat.id);
    nav.appendChild(btn);
  });
}

function rendreSousOnglets() {
  const nav = $('#onglets');
  if (!nav) return;
  nav.innerHTML = '';
  const cat = categoriesPourRole(S.vision).find(c => c.id === S.categorieActive);
  if (!cat || cat.onglets.length <= 1) { nav.style.display = 'none'; return; }
  nav.style.display = '';
  cat.onglets.forEach(([id, libelle]) => {
    const btn = document.createElement('button');
    btn.textContent = libelle;
    btn.className = id === S.ongletActif ? 'actif' : '';
    btn.onclick = () => allerA(id);
    nav.appendChild(btn);
  });
}

// Sélectionne une catégorie du menu latéral et ouvre son premier sous-onglet
// (c'est aussi ce qui ouvre directement une catégorie à un seul onglet, ex.
// Accueil, puisqu'il n'y a alors qu'un choix possible).
function allerACategorie(catId) {
  const cat = categoriesPourRole(S.vision).find(c => c.id === catId);
  if (!cat || !cat.onglets.length) return;
  S.categorieActive = catId;
  allerA(cat.onglets[0][0]);
}

function allerA(id) {
  S.ongletActif = id;
  const cat = categorieDeLOnglet(id);
  if (cat) S.categorieActive = cat.id;
  rendreMenuLateral();
  rendreSousOnglets();
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
  $('#menu-lateral').innerHTML = '';
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

  const categories = categoriesPourRole(S.vision);
  if (categories[0]) allerACategorie(categories[0].id);
}

supa.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') rendreEcranConnexion();
});

document.addEventListener('DOMContentLoaded', demarrer);
