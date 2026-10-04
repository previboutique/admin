// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// familles.js — onglet "Familles & codes" (Activité formation) : les codes
// exigés par l'export Passeport de prévention (NSF, Formacode, compétences
// ROME, certification RS) sont saisis UNE fois par "famille de formation" et
// partagés par les fiches du catalogue (ex. SST et MAC SST).
//
// Le bloc `PP` (en haut) ne dépend que de données simples : il est conçu pour
// être repris tel quel dans l'appli de suivi HSE (contrôle des codes, export).
//
// Données : table familles_formation, référentiels referentiel_nsf /
// referentiel_formacodes / referentiel_rome / referentiel_certifications_pro,
// import par la fonction importer_catalogue_passeport (fichier
// passeport_donnees.json livré avec l'appli). Voir patch_2026-10-05.

// ---------------------------------------------------------------------------
// Bloc réutilisable : référentiels + contrôle des codes
// ---------------------------------------------------------------------------
window.PP = window.PP || {};

PP.FIABILITE = {
  fiche_officielle: { libelle: 'Fiche officielle', couleur: '#1a7f3c', fond: '#e3f6ee' },
  alignee: { libelle: 'Alignée sur fiche', couleur: '#2a78d6', fond: '#e8f0fb' },
  codes_valides: { libelle: 'Codes valides, sans fiche', couleur: '#8a5a00', fond: '#fff4d6' },
  cas_particulier: { libelle: 'Cas particulier', couleur: '#8a5a00', fond: '#fff4d6' },
  hors_perimetre: { libelle: 'Non déclarable', couleur: '#55636c', fond: '#eceff1' },
  a_verifier: { libelle: 'À vérifier', couleur: '#b3261e', fond: '#fde8e6' },
  personnalisee: { libelle: 'Personnalisée', couleur: '#6a3fb5', fond: '#efe7fb' },
};

// Texte libre -> liste de codes (séparateurs : / , ; espace, retour ligne).
PP.parseCodes = function (texte) {
  const vus = new Set();
  return String(texte || '').split(/[\s/,;]+/).map(c => c.trim()).filter(c => c && !vus.has(c) && vus.add(c));
};

// Charge les 4 référentiels (cache en mémoire). Retourne
// { nsf, formacode, rome, rs } : chacun une Map code -> libellé.
PP.chargerReferentiels = async function (force) {
  if (PP.REF && !force) return PP.REF;
  const lire = async table => {
    const { data, error } = await supa.from(table).select('code, libelle').limit(5000);
    if (error) { DEBUG.erreur('PP.chargerReferentiels ' + table, error); return new Map(); }
    return new Map((data || []).map(r => [r.code, r.libelle]));
  };
  const [nsf, formacode, rome, rs] = await Promise.all([
    lire('referentiel_nsf'), lire('referentiel_formacodes'), lire('referentiel_rome'), lire('referentiel_certifications_pro'),
  ]);
  PP.REF = { nsf, formacode, rome, rs };
  return PP.REF;
};

// Contrôle une famille selon les règles du guide d'import en masse (OF/ADF).
// f : { certifiante, fiabilite, codes_nsf, codes_formacode, codes_rome, codes_rs }
// Retourne une liste de { niveau: 'erreur' | 'alerte', texte }.
PP.controlerFamille = function (f, ref) {
  const pb = [];
  const nsf = f.codes_nsf || [], fc = f.codes_formacode || [], rome = f.codes_rome || [], rs = f.codes_rs || [];
  if (f.fiabilite === 'hors_perimetre') return [{ niveau: 'alerte', texte: 'Formation hors périmètre santé-sécurité : non déclarable dans Passeport de prévention.' }];
  if (f.fiabilite === 'cas_particulier') pb.push({ niveau: 'alerte', texte: 'Cas particulier : à déclarer recommandation par recommandation.' });
  if (nsf.length > 3) pb.push({ niveau: 'erreur', texte: 'NSF : 3 codes maximum.' });
  if (fc.length > 5) pb.push({ niveau: 'erreur', texte: 'Formacode : 5 codes maximum.' });
  if (rome.length < 3 || rome.length > 10) pb.push({ niveau: 'erreur', texte: `Compétences ROME : de 3 à 10 codes (actuellement ${rome.length}).` });
  if (rome.join('/').length > 70) pb.push({ niveau: 'erreur', texte: `Compétences ROME : 70 caractères maximum (actuellement ${rome.join('/').length}).` });
  if (f.certifiante) {
    if (rs.length === 0) pb.push({ niveau: 'erreur', texte: 'Formation certifiante : au moins un code RS est obligatoire.' });
  } else {
    if (nsf.length === 0) pb.push({ niveau: 'erreur', texte: 'Formation non certifiante : un code NSF est obligatoire.' });
    if (fc.length === 0) pb.push({ niveau: 'erreur', texte: 'Formation non certifiante : un Formacode est obligatoire.' });
    if (rs.length > 0) pb.push({ niveau: 'erreur', texte: 'Formation non certifiante : le code RS doit rester vide.' });
  }
  if (ref) {
    [['NSF', nsf, ref.nsf], ['Formacode', fc, ref.formacode], ['ROME', rome, ref.rome], ['RS', rs, ref.rs]].forEach(([nom, liste, map]) => {
      const inconnus = liste.filter(c => !map.has(c));
      if (inconnus.length) pb.push({ niveau: 'erreur', texte: `${nom} inconnu(s) des référentiels : ${inconnus.join(', ')}.` });
    });
  }
  if (f.fiabilite === 'codes_valides') pb.push({ niveau: 'alerte', texte: 'Codes valides mais non confirmés par une fiche officielle : à relire avant la première déclaration.' });
  return pb;
};

// ---------------------------------------------------------------------------
// Rattachement automatique : suggestion de famille pour une fiche du catalogue
// ---------------------------------------------------------------------------
PP.normaliser = function (s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
};
const PP_MOTS_VIDES = new Set(['les', 'des', 'aux', 'une', 'pour', 'sur', 'dans', 'avec', 'formation', 'initiale', 'recyclage', 'mac', 'the']);
PP.jetons = function (s) {
  return new Set(PP.normaliser(s).split(' ').filter(t => t.length >= 3 && !PP_MOTS_VIDES.has(t)));
};

// Retourne l'id de la famille la plus proche d'une fiche (score >= 0.5), ou null.
PP.suggererFamille = function (fiche, familles) {
  const texteFiche = PP.normaliser(`${fiche.code} ${fiche.denomination}`);
  const jf = PP.jetons(`${fiche.code} ${fiche.denomination}`);
  let meilleur = null, score = 0;
  familles.forEach(g => {
    const jg = PP.jetons(`${g.nom} ${g.intitule || ''}`);
    let commun = 0;
    jf.forEach(t => { if (jg.has(t)) commun += 1; });
    let s = jf.size && jg.size ? commun / Math.min(jf.size, jg.size) : 0;
    (g.mots_cles || []).forEach(m => { if (texteFiche.includes(PP.normaliser(m))) s += 1.5; });
    if (s > score) { score = s; meilleur = g; }
  });
  return score >= 0.5 ? meilleur.id : null;
};

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------
async function ecranFamilles(vue) {
  const peutModifier = ['admin', 'super_admin'].includes(S.profil?.role);
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div>
        <h2 style="margin:0;">Familles de formation et codes Passeport de prévention</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#55636c;">Les codes (NSF, Formacode, compétences ROME, certification RS) se saisissent une fois par famille et sont partagés par les fiches du catalogue (ex. SST et MAC SST).</p>
      </div>
      ${peutModifier ? `<div style="display:flex;gap:8px;">
        <button class="bouton" style="background:#eee;color:#333;" onclick="importerCataloguePasseport()">Importer le catalogue de référence</button>
        <button class="bouton" onclick="ouvrirFormFamille(null)">+ Nouvelle famille</button>
      </div>` : ''}
    </div>
    <div class="carte" id="familles-resume">Chargement…</div>
    <div id="familles-form"></div>
    <div id="familles-rattachement"></div>
    <div class="carte"><div id="familles-liste"></div></div>`;
  await chargerFamilles();
}

async function chargerFamilles() {
  const [{ data: familles, error: e1 }, { data: fiches, error: e2 }, ref] = await Promise.all([
    supa.from('familles_formation').select('*').order('nom'),
    supa.from('formations_catalogue').select('id, code, denomination, categorie, type_formation, formation_initiale_id, famille_id, actif').order('denomination'),
    PP.chargerReferentiels(true),
  ]);
  if (e1 || e2) { DEBUG.erreur('chargerFamilles', e1 || e2); $('#familles-resume').textContent = 'Erreur de chargement (le patch du 05/10/2026 est-il appliqué ?).'; return; }
  window.__familles = familles || [];
  window.__fichesFamilles = fiches || [];
  window.__ppRef = ref;
  rendreResumeFamilles();
  rendreListeFamilles();
}

function rendreResumeFamilles() {
  const familles = window.__familles, fiches = window.__fichesFamilles.filter(f => f.actif);
  const nonRattachees = fiches.filter(f => !f.famille_id);
  const enErreur = familles.filter(g => g.actif && PP.controlerFamille(g, window.__ppRef).some(p => p.niveau === 'erreur') && g.fiabilite !== 'hors_perimetre').length;
  $('#familles-resume').innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;">
      <div><strong style="font-size:22px;">${familles.length}</strong><div style="font-size:12px;color:#55636c;">familles</div></div>
      <div><strong style="font-size:22px;">${fiches.length - nonRattachees.length}</strong><div style="font-size:12px;color:#55636c;">fiches rattachées</div></div>
      <div><strong style="font-size:22px;color:${nonRattachees.length ? '#8a5a00' : '#1a7f3c'};">${nonRattachees.length}</strong><div style="font-size:12px;color:#55636c;">fiches sans famille</div></div>
      <div><strong style="font-size:22px;color:${enErreur ? '#b3261e' : '#1a7f3c'};">${enErreur}</strong><div style="font-size:12px;color:#55636c;">familles à corriger</div></div>
      <div style="margin-left:auto;">${familles.length && fiches.length ? '<button class="bouton" onclick="ouvrirRattachementFiches()">Rattacher les fiches du catalogue</button>' : ''}</div>
    </div>
    ${familles.length === 0 ? '<p style="margin:12px 0 0;color:#55636c;">Aucune famille pour le moment : clique sur « Importer le catalogue de référence » pour charger les 66 familles prêtes à l\'export. Les ${fiches.length} fiches de ton catalogue pourront ensuite y être rattachées.</p>' : ''}`;
}

function rendreListeFamilles() {
  const zone = $('#familles-liste');
  const familles = window.__familles;
  if (!familles.length) { zone.innerHTML = ''; return; }
  zone.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
      <input id="fam-filtre" placeholder="Rechercher une famille, un code…" style="flex:2;min-width:200px;">
      <select id="fam-fiabilite" style="flex:1;min-width:180px;">
        <option value="">Toutes les fiabilités</option>
        ${Object.entries(PP.FIABILITE).map(([k, v]) => `<option value="${k}">${esc(v.libelle)}</option>`).join('')}
      </select>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
        <th style="padding:6px 8px;">Famille</th><th style="padding:6px 8px;">Cert.</th><th style="padding:6px 8px;">NSF</th>
        <th style="padding:6px 8px;">Formacode</th><th style="padding:6px 8px;">ROME</th><th style="padding:6px 8px;">RS</th>
        <th style="padding:6px 8px;">Contrôle</th><th style="padding:6px 8px;">Fiches</th><th></th>
      </tr></thead>
      <tbody id="fam-corps"></tbody></table></div>`;
  const maj = () => {
    const q = PP.normaliser($('#fam-filtre').value), fia = $('#fam-fiabilite').value;
    const lignes = window.__familles.filter(g => {
      if (fia && g.fiabilite !== fia) return false;
      if (!q) return true;
      return PP.normaliser([g.nom, g.intitule, ...(g.codes_nsf || []), ...(g.codes_formacode || []), ...(g.codes_rome || []), ...(g.codes_rs || [])].join(' ')).includes(q);
    });
    $('#fam-corps').innerHTML = lignes.map(g => {
      const pb = PP.controlerFamille(g, window.__ppRef);
      const erreurs = pb.filter(p => p.niveau === 'erreur'), alertes = pb.filter(p => p.niveau === 'alerte');
      const fi = PP.FIABILITE[g.fiabilite] || PP.FIABILITE.a_verifier;
      const rattachees = window.__fichesFamilles.filter(f => f.famille_id === g.id);
      const etat = erreurs.length
        ? `<span title="${esc(erreurs.map(p => p.texte).join('\n'))}" style="color:#b3261e;font-weight:bold;">⛔ ${erreurs.length}</span>`
        : (alertes.length ? `<span title="${esc(alertes.map(p => p.texte).join('\n'))}" style="color:#8a5a00;">⚠</span>` : '<span style="color:#1a7f3c;">✔</span>');
      return `<tr style="border-top:1px solid #eee;${g.actif ? '' : 'opacity:.5;'}">
        <td style="padding:6px 8px;"><strong>${esc(g.nom)}</strong>
          <div><span style="font-size:11px;background:${fi.fond};color:${fi.couleur};border-radius:10px;padding:1px 8px;">${esc(fi.libelle)}</span>
          ${g.organisation_id ? '' : '<span style="font-size:11px;background:#eceff1;color:#55636c;border-radius:10px;padding:1px 8px;margin-left:4px;">Commune</span>'}</div></td>
        <td style="padding:6px 8px;">${g.certifiante ? 'Oui' : 'Non'}</td>
        <td style="padding:6px 8px;">${esc((g.codes_nsf || []).join(' / ')) || '—'}</td>
        <td style="padding:6px 8px;">${esc((g.codes_formacode || []).join(' / ')) || '—'}</td>
        <td style="padding:6px 8px;">${(g.codes_rome || []).length}</td>
        <td style="padding:6px 8px;">${(g.codes_rs || []).length ? (g.codes_rs.length === 1 ? esc(g.codes_rs[0]) : g.codes_rs.length + ' codes') : '—'}</td>
        <td style="padding:6px 8px;">${etat}</td>
        <td style="padding:6px 8px;font-size:12px;color:#55636c;">${rattachees.length ? rattachees.map(f => esc(f.code)).join(', ') : '—'}</td>
        <td style="padding:6px 8px;text-align:right;"><button class="bouton" style="padding:4px 10px;font-size:12px;" onclick="ouvrirFormFamille('${g.id}')">${['admin', 'super_admin'].includes(S.profil?.role) ? 'Modifier' : 'Voir'}</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" style="padding:12px;color:#55636c;">Aucune famille ne correspond.</td></tr>';
  };
  $('#fam-filtre').oninput = maj;
  $('#fam-fiabilite').onchange = maj;
  maj();
}

// ----- Import du catalogue de référence ------------------------------------
async function importerCataloguePasseport() {
  if (!confirm('Importer le catalogue de référence (référentiels de codes + familles de formation) ?\n\nLes familles que tu as modifiées à la main ne sont jamais écrasées.')) return;
  try {
    const rep = await fetch('passeport_donnees.json?v=' + Date.now());
    if (!rep.ok) throw new Error('Fichier passeport_donnees.json introuvable (a-t-il été réuploadé sur GitHub Pages ?)');
    const donnees = await rep.json();
    const { data, error } = await supa.rpc('importer_catalogue_passeport', { p: donnees });
    if (error) throw error;
    toast(`Import terminé : ${data.familles_creees} créée(s), ${data.familles_mises_a_jour} mise(s) à jour, ${data.familles_conservees} conservée(s).`);
    await chargerFamilles();
    // Enchaîne sur le rattachement des fiches du catalogue (suggestions à valider).
    if (window.__fichesFamilles.length) ouvrirRattachementFiches();
  } catch (e) {
    DEBUG.erreur('importerCataloguePasseport', e);
    toast('Import impossible : ' + (e.message || e), 'erreur');
  }
}

// ----- Formulaire d'une famille --------------------------------------------
function ouvrirFormFamille(id) {
  const g = id ? window.__familles.find(x => x.id === id) : null;
  const peutModifier = ['admin', 'super_admin'].includes(S.profil?.role) && (!g || g.organisation_id || S.profil.role === 'super_admin');
  const dis = peutModifier ? '' : 'disabled';
  const zone = $('#familles-form');
  const champCodes = (cle, label, liste, aide) => `
    <label for="fam-${cle}">${label}</label>
    <textarea id="fam-${cle}" rows="2" ${dis} placeholder="${aide}">${esc((liste || []).join(' / '))}</textarea>
    <div id="fam-${cle}-lib" style="font-size:12px;color:#55636c;margin:-4px 0 8px;"></div>`;
  zone.innerHTML = `
    <div class="carte" style="max-width:760px;">
      <h3 style="margin-top:0;">${g ? (peutModifier ? 'Modifier' : 'Consulter') : 'Nouvelle'} famille</h3>
      ${g && g.organisation_id === null && !peutModifier ? '<p style="font-size:12px;color:#8a5a00;">Famille commune : modifiable par le super-administrateur uniquement.</p>' : ''}
      <label for="fam-nom">Nom de la famille</label>
      <input id="fam-nom" ${dis} value="${g ? esc(g.nom) : ''}" placeholder="ex. Sauveteur Secouriste du Travail (SST et MAC SST)">
      <label for="fam-intitule">Intitulé du programme (optionnel)</label>
      <input id="fam-intitule" ${dis} value="${g ? esc(g.intitule) : ''}">
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <input type="checkbox" id="fam-certifiante" style="width:auto;" ${dis} ${g && g.certifiante ? 'checked' : ''}>
        <span>Formation certifiante (un code RS est alors obligatoire ; NSF et Formacode ne sont pas exportés)</span>
      </label>
      ${champCodes('nsf', 'Codes NSF (1 à 3)', g?.codes_nsf, 'ex. 344r / 344p')}
      ${champCodes('formacode', 'Formacodes (1 à 5)', g?.codes_formacode, 'ex. 42829')}
      ${champCodes('rome', 'Compétences transférables ROME (3 à 10, 70 caractères au total)', g?.codes_rome, 'ex. 115650 / 121885 / 400635')}
      ${champCodes('rs', 'Codes RS (certifiante : un seul est retenu par déclaration)', g?.codes_rs, 'ex. RS6937')}
      <label for="fam-motscles">Mots-clés pour le rattachement automatique (séparés par une virgule)</label>
      <input id="fam-motscles" ${dis} value="${g ? esc((g.mots_cles || []).join(', ')) : ''}" placeholder="ex. sst, mac sst">
      <label for="fam-remarques">Remarques</label>
      <textarea id="fam-remarques" rows="2" ${dis}>${g ? esc(g.remarques) : ''}</textarea>
      ${g ? `<p style="font-size:12px;color:#55636c;margin:6px 0;">Source : ${esc(g.source_officielle || '—')} · fiabilité : ${esc((PP.FIABILITE[g.fiabilite] || {}).libelle || g.fiabilite)}</p>` : ''}
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <input type="checkbox" id="fam-actif" style="width:auto;" ${dis} ${!g || g.actif ? 'checked' : ''}><span>Famille active</span>
      </label>
      <div id="fam-controle" style="margin-top:12px;"></div>
      <div style="margin-top:16px;">
        ${peutModifier ? '<button class="bouton" id="fam-valider">Enregistrer</button>' : ''}
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#familles-form').innerHTML=''">${peutModifier ? 'Annuler' : 'Fermer'}</button>
      </div>
      <div class="erreur" id="fam-erreur"></div>
    </div>`;
  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const lire = () => ({
    certifiante: $('#fam-certifiante').checked,
    fiabilite: g ? g.fiabilite : 'personnalisee',
    codes_nsf: PP.parseCodes($('#fam-nsf').value),
    codes_formacode: PP.parseCodes($('#fam-formacode').value),
    codes_rome: PP.parseCodes($('#fam-rome').value),
    codes_rs: PP.parseCodes($('#fam-rs').value),
  });
  const rafraichir = () => {
    const f = lire(), ref = window.__ppRef;
    [['nsf', f.codes_nsf, ref.nsf], ['formacode', f.codes_formacode, ref.formacode], ['rome', f.codes_rome, ref.rome], ['rs', f.codes_rs, ref.rs]].forEach(([cle, liste, map]) => {
      $('#fam-' + cle + '-lib').innerHTML = liste.map(c => map.has(c)
        ? `<span>${esc(c)} — ${esc(map.get(c))}</span>` : `<span style="color:#b3261e;">${esc(c)} — inconnu</span>`).join('<br>');
    });
    const pb = PP.controlerFamille(f, ref);
    $('#fam-controle').innerHTML = pb.length
      ? pb.map(p => `<div style="font-size:13px;color:${p.niveau === 'erreur' ? '#b3261e' : '#8a5a00'};">${p.niveau === 'erreur' ? '⛔' : '⚠'} ${esc(p.texte)}</div>`).join('')
      : '<div style="font-size:13px;color:#1a7f3c;">✔ Tous les contrôles du guide d\'import sont respectés.</div>';
  };
  ['nsf', 'formacode', 'rome', 'rs'].forEach(c => { $('#fam-' + c).oninput = rafraichir; });
  $('#fam-certifiante').onchange = rafraichir;
  rafraichir();

  if (!peutModifier) return;
  $('#fam-valider').onclick = async () => {
    const f = lire();
    const payload = {
      nom: $('#fam-nom').value.trim(),
      intitule: $('#fam-intitule').value.trim() || null,
      certifiante: f.certifiante,
      codes_nsf: f.codes_nsf, codes_formacode: f.codes_formacode, codes_rome: f.codes_rome, codes_rs: f.codes_rs,
      mots_cles: $('#fam-motscles').value.split(',').map(x => x.trim()).filter(Boolean),
      remarques: $('#fam-remarques').value.trim() || null,
      actif: $('#fam-actif').checked,
      modifie_manuellement: true,
      updated_at: new Date().toISOString(),
    };
    if (!payload.nom) { $('#fam-erreur').textContent = 'Le nom de la famille est obligatoire.'; return; }
    if (payload.codes_nsf.length > 3 || payload.codes_formacode.length > 5 || payload.codes_rome.length > 10 || payload.codes_rome.join('/').length > 70) {
      $('#fam-erreur').textContent = 'Trop de codes ou compétences ROME trop longues (voir les contrôles ci-dessus).'; return;
    }
    if (!g) { payload.organisation_id = S.profil.role === 'super_admin' ? null : S.organisation.id; payload.fiabilite = 'personnalisee'; }
    const req = g
      ? supa.from('familles_formation').update(payload).eq('id', g.id)
      : supa.from('familles_formation').insert(payload);
    const { error } = await req;
    if (error) {
      DEBUG.erreur('enregistrerFamille', error);
      $('#fam-erreur').textContent = error.code === '23505' ? 'Une famille porte déjà ce nom.' : 'Erreur : ' + error.message;
      return;
    }
    toast('Famille enregistrée.');
    $('#familles-form').innerHTML = '';
    await chargerFamilles();
  };
}

// ----- Rattachement des fiches du catalogue --------------------------------
function ouvrirRattachementFiches() {
  const familles = window.__familles.filter(g => g.actif);
  const fiches = window.__fichesFamilles.filter(f => f.actif);
  // Suggestion : fiches initiales d'abord, puis un recyclage reprend la famille
  // de sa formation initiale (SST -> MAC SST).
  const suggestion = {};
  fiches.filter(f => f.type_formation !== 'recyclage').forEach(f => { suggestion[f.id] = f.famille_id || PP.suggererFamille(f, familles); });
  fiches.filter(f => f.type_formation === 'recyclage').forEach(f => {
    suggestion[f.id] = f.famille_id || (f.formation_initiale_id && suggestion[f.formation_initiale_id]) || PP.suggererFamille(f, familles);
  });
  const options = sel => `<option value="">— aucune —</option>` + familles.map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.nom)}</option>`).join('');
  $('#familles-rattachement').innerHTML = `
    <div class="carte">
      <h3 style="margin-top:0;">Rattacher les fiches du catalogue à leur famille</h3>
      <p style="font-size:13px;color:#55636c;">Les propositions en orange sont des suggestions : vérifie-les, corrige si besoin, puis applique. Un recyclage reprend la famille de sa formation initiale.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="text-align:left;color:#55636c;font-size:12px;"><th style="padding:6px 8px;">Fiche du catalogue</th><th style="padding:6px 8px;">Famille</th></tr></thead>
        <tbody>${fiches.map(f => {
          const sug = suggestion[f.id], suggeree = !f.famille_id && sug;
          return `<tr style="border-top:1px solid #eee;">
            <td style="padding:6px 8px;"><strong>${esc(f.code)}</strong> — ${esc(f.denomination)}
              ${f.type_formation === 'recyclage' ? '<span style="font-size:11px;background:#e3f6ee;color:#1a7f3c;border-radius:10px;padding:1px 8px;margin-left:6px;">Recyclage</span>' : ''}</td>
            <td style="padding:6px 8px;"><select class="fam-rattache" data-fiche="${f.id}" data-avant="${f.famille_id || ''}" style="${suggeree ? 'background:#fff4d6;' : ''}">${options(sug || '')}</select></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      <div style="margin-top:12px;">
        <button class="bouton" id="fam-appliquer">Appliquer les rattachements</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#familles-rattachement').innerHTML=''">Fermer</button>
      </div>
    </div>`;
  $('#familles-rattachement').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#fam-appliquer').onclick = async () => {
    const changements = $$('.fam-rattache').filter(s => (s.value || '') !== (s.dataset.avant || ''));
    if (!changements.length) { toast('Aucun changement à enregistrer.'); return; }
    const resultats = await Promise.all(changements.map(s =>
      supa.from('formations_catalogue').update({ famille_id: s.value || null }).eq('id', s.dataset.fiche)));
    const echec = resultats.find(r => r.error);
    if (echec) { DEBUG.erreur('rattachementFiches', echec.error); toast('Erreur : ' + echec.error.message, 'erreur'); return; }
    toast(`${changements.length} fiche(s) rattachée(s).`);
    $('#familles-rattachement').innerHTML = '';
    await chargerFamilles();
  };
}
