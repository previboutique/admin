// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// dashboard_activite.js — tableau de bord de la catégorie "Activité formation" :
// nombre de sessions par mois (année choisie), répartition par type de
// formation par mois, et un prévisionnel pour les 6 prochains mois basé sur
// la moyenne historique de chaque mois calendaire sur les années précédentes.
// Graphiques en barres verticales (bâtons), comme demandé.

const DA_MOIS_LIBELLES = ['', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const DA_MOIS_LONGS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Palette catégorielle (charte data-viz — ordre fixe, jamais cyclé).
const DA_COULEURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const DA_COULEUR_AUTRES = '#9aa5ab';
const DA_COULEUR_PREVISIONNEL = '#c7d3da';

function daNormaliserCategorie(cat) {
  const v = (cat || '').trim();
  return v || 'Non catégorisé';
}

async function ecranTableauBordActivite(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin:0 0 4px;">Tableau de bord — Activité formation</h2>
      <p style="margin:0;color:#55636c;font-size:13px;">Nombre de sessions par mois et répartition par type de formation, sur l'année choisie. Prévisionnel calculé à partir de la moyenne des années précédentes.</p>
    </div>
    <div class="carte">
      <div style="min-width:140px;max-width:200px;">
        <label for="da-annee">Année</label>
        <select id="da-annee" onchange="rafraichirTableauBordActivite()"></select>
      </div>
    </div>
    <div id="da-contenu"><div class="carte">Chargement…</div></div>`;

  // Lecture par pages de 500 : sans cela, la base ne renvoie que 1000 lignes au maximum et les
  // sessions les plus récentes (triées en dernier) disparaissaient du tableau de bord.
  const toutes = [];
  for (let debut = 0; debut < 50000; debut += 500) {
    const { data: page, error } = await supa
      .from('sessions_formation')
      .select('id, date_debut, statut, formations_catalogue(categorie)')
      .order('date_debut', { ascending: true }).order('id', { ascending: true })
      .range(debut, debut + 499);
    if (error) { DEBUG.erreur('ecranTableauBordActivite', error); $('#da-contenu').innerHTML = '<div class="carte">Erreur de chargement.</div>'; return; }
    toutes.push(...(page || []));
    if (!page || page.length < 500) break;
  }

  // Ce qui est compté et ce qui ne l'est pas (affiché sous les chiffres pour que l'écart soit explicable)
  const ecartes = {
    total: toutes.length,
    annulees: toutes.filter(s => s.statut === 'annulee').length,
    sansDate: toutes.filter(s => !s.date_debut).length,
    avant2000: toutes.filter(s => s.date_debut && s.date_debut < '2000-01-01' && s.statut !== 'annulee').length,
  };
  window.__daEcartes = ecartes;
  window.__daSessions = toutes.filter(s => s.date_debut && s.statut !== 'annulee' && s.date_debut >= '2000-01-01');

  const anneeEnCours = new Date().getFullYear();
  const annees = [...new Set(window.__daSessions.map(s => Number(s.date_debut.slice(0, 4))))].sort((a, b) => b - a);
  if (!annees.includes(anneeEnCours)) annees.unshift(anneeEnCours);
  $('#da-annee').innerHTML = annees.map(a => `<option value="${a}" ${a === anneeEnCours ? 'selected' : ''}>${a}</option>`).join('');

  rafraichirTableauBordActivite();
}

function daNoteEcarts() {
  const e = window.__daEcartes;
  if (!e) return '';
  const morceaux = [];
  if (e.avant2000) morceaux.push(`<strong>${e.avant2000}</strong> session(s) datée(s) 01/01/1900 (date de remplacement d'un import) — non comptées, à dater dans « Corriger les rattachements »`);
  if (e.sansDate) morceaux.push(`<strong>${e.sansDate}</strong> session(s) sans date`);
  if (e.annulees) morceaux.push(`<strong>${e.annulees}</strong> session(s) annulée(s) (reportées ou annulées)`);
  return `<div class="carte" style="font-size:13px;${e.avant2000 || e.sansDate ? 'background:#fff9e8;border-color:#e6c76a;' : ''}">
    <strong>Contrôle :</strong> ${e.total} session(s) en base, dont ${window.__daSessions.length} comptées dans ce tableau de bord.
    ${morceaux.length ? '<div style="margin-top:4px;">Non comptées : ' + morceaux.join(' · ') + '.</div>' : ''}
  </div>`;
}

function rafraichirTableauBordActivite() {
  const zone = $('#da-contenu');
  if (!zone) return;

  const anneeFiltre = Number($('#da-annee')?.value) || new Date().getFullYear();
  const sessionsAnnee = (window.__daSessions || []).filter(s => Number(s.date_debut.slice(0, 4)) === anneeFiltre);

  // --- Sessions par mois ---
  const comptesParMois = Array.from({ length: 13 }, () => 0);
  sessionsAnnee.forEach(s => { comptesParMois[Number(s.date_debut.slice(5, 7))]++; });
  const totalAnnee = sessionsAnnee.length;

  // --- Répartition par type de formation (top 5 + Autres, ordre fixe) ---
  const totalParCategorie = {};
  sessionsAnnee.forEach(s => {
    const cat = daNormaliserCategorie(s.formations_catalogue?.categorie);
    totalParCategorie[cat] = (totalParCategorie[cat] || 0) + 1;
  });
  const TOP_N = 5;
  const categoriesTriees = Object.entries(totalParCategorie).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const topCategories = categoriesTriees.slice(0, TOP_N);
  const aDesAutres = categoriesTriees.length > TOP_N;
  const legende = topCategories.map((c, i) => ({ label: c, couleur: DA_COULEURS[i] }));
  if (aDesAutres) legende.push({ label: `Autres (${categoriesTriees.length - TOP_N})`, couleur: DA_COULEUR_AUTRES });

  const parMoisCategorie = Array.from({ length: 13 }, () => ({}));
  sessionsAnnee.forEach(s => {
    const mois = Number(s.date_debut.slice(5, 7));
    const catBrute = daNormaliserCategorie(s.formations_catalogue?.categorie);
    const cat = topCategories.includes(catBrute) ? catBrute : 'Autres';
    parMoisCategorie[mois][cat] = (parMoisCategorie[mois][cat] || 0) + 1;
  });

  // --- Prévisionnel semestre suivant : moyenne, par mois calendaire, sur
  // les années précédentes (hors année en cours, souvent incomplète). ---
  const anneeEnCours = new Date().getFullYear();
  const moisEnCours = new Date().getMonth() + 1;
  const anneesHistoriques = [...new Set((window.__daSessions || []).map(s => Number(s.date_debut.slice(0, 4))))].filter(a => a < anneeEnCours);

  const moyenneParMoisCalendaire = m => {
    if (!anneesHistoriques.length) return null;
    const total = anneesHistoriques.reduce((acc, an) => {
      const n = (window.__daSessions || []).filter(s => Number(s.date_debut.slice(0, 4)) === an && Number(s.date_debut.slice(5, 7)) === m).length;
      return acc + n;
    }, 0);
    return total / anneesHistoriques.length;
  };

  const previsionnel = [];
  for (let i = 1; i <= 6; i++) {
    const mois = ((moisEnCours - 1 + i) % 12) + 1;
    const annee = anneeEnCours + Math.floor((moisEnCours - 1 + i) / 12);
    const moyenne = moyenneParMoisCalendaire(mois);
    previsionnel.push({ mois, annee, valeur: moyenne === null ? null : Math.round(moyenne * 10) / 10 });
  }

  zone.innerHTML = `
    ${daNoteEcarts()}
    <div class="carte">
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        ${daStatTuile('Sessions sur l\'année', totalAnnee)}
        ${daStatTuile('Types de formation', categoriesTriees.length)}
      </div>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Sessions par mois — ${anneeFiltre}</h3>
      ${daBarresMois(comptesParMois.slice(1).map((v, i) => ({ label: DA_MOIS_LIBELLES[i + 1], valeur: v, couleur: DA_COULEURS[0] })))}
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Type de formation par mois — ${anneeFiltre}</h3>
      ${totalAnnee === 0 ? '<p style="color:#55636c;font-size:13px;">Aucune session sur cette année.</p>' : daBarresMoisEmpilees(parMoisCategorie, legende)}
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Prévisionnel — 6 prochains mois</h3>
      <p style="margin:0 0 12px;color:#55636c;font-size:13px;">
        ${anneesHistoriques.length ? `Moyenne du nombre de sessions par mois calendaire, calculée sur ${anneesHistoriques.length} année(s) précédente(s) (${anneesHistoriques.join(', ')}).` : 'Pas encore d\'historique sur une année précédente complète pour calculer un prévisionnel.'}
      </p>
      ${daBarresPrevisionnel(previsionnel)}
    </div>`;
}

function daStatTuile(libelle, valeur) {
  return `<div>
    <div style="font-size:12px;color:#55636c;">${esc(libelle)}</div>
    <div style="font-size:28px;font-weight:600;color:#1c2b36;">${esc(String(valeur))}</div>
  </div>`;
}

// Barres verticales simples (une série) : bâton <=24px de large, bout haut
// arrondi, valeur au-dessus, libellé du mois en-dessous.
function daBarresMois(items) {
  const max = Math.max(1, ...items.map(i => i.valeur));
  return `<div style="display:flex;align-items:flex-end;gap:6px;height:180px;padding-top:20px;">
    ${items.map(i => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
        <div style="font-size:11px;color:#55636c;margin-bottom:4px;">${i.valeur || ''}</div>
        <div style="width:100%;max-width:24px;height:${Math.max((i.valeur / max) * 100, i.valeur > 0 ? 3 : 0)}%;background:${i.couleur};border-radius:4px 4px 0 0;" title="${esc(i.label)} : ${i.valeur}"></div>
        <div style="font-size:11px;color:#55636c;margin-top:6px;">${esc(i.label)}</div>
      </div>`).join('')}
  </div>`;
}

// Barres verticales empilées (une série par catégorie) + légende (mandatoire
// dès 2 séries). parMoisCategorie[1..12] = { catégorie: n }.
function daBarresMoisEmpilees(parMoisCategorie, legende) {
  const totauxParMois = parMoisCategorie.slice(1).map(o => Object.values(o).reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totauxParMois);
  const couleurDe = cat => (legende.find(l => l.label === cat || l.label.startsWith(cat + ' ('))?.couleur) || DA_COULEUR_AUTRES;

  const colonnes = parMoisCategorie.slice(1).map((repartMois, i) => {
    const entrees = Object.entries(repartMois).sort((a, b) => {
      const oa = legende.findIndex(l => l.label === a[0] || l.label.startsWith(a[0] + ' ('));
      const ob = legende.findIndex(l => l.label === b[0] || l.label.startsWith(b[0] + ' ('));
      return oa - ob;
    });
    const total = totauxParMois[i];
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
      <div style="font-size:11px;color:#55636c;margin-bottom:4px;">${total || ''}</div>
      <div style="width:100%;max-width:24px;height:${Math.max((total / max) * 100, total > 0 ? 3 : 0)}%;display:flex;flex-direction:column-reverse;border-radius:4px 4px 0 0;overflow:hidden;">
        ${entrees.map(([cat, n]) => `<div style="width:100%;height:${total ? (n / total) * 100 : 0}%;background:${couleurDe(cat)};" title="${esc(cat)} : ${n}"></div>`).join('')}
      </div>
      <div style="font-size:11px;color:#55636c;margin-top:6px;">${DA_MOIS_LIBELLES[i + 1]}</div>
    </div>`;
  }).join('');

  return `<div style="display:flex;align-items:flex-end;gap:6px;height:180px;padding-top:20px;margin-bottom:14px;">${colonnes}</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px 18px;">
      ${legende.map(l => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1c2b36;">
        <span style="width:12px;height:12px;border-radius:3px;background:${l.couleur};display:inline-block;"></span>${esc(l.label)}
      </div>`).join('')}
    </div>`;
}

// Barres du prévisionnel : même style que daBarresMois mais couleur atténuée
// + libellé "mois AAAA" + mention "(prévisionnel)", pour bien les distinguer
// des barres de données réelles des graphiques ci-dessus.
function daBarresPrevisionnel(previsionnel) {
  const valeurs = previsionnel.map(p => p.valeur || 0);
  const max = Math.max(1, ...valeurs);
  return `<div style="display:flex;align-items:flex-end;gap:10px;height:160px;padding-top:20px;">
    ${previsionnel.map(p => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
        <div style="font-size:11px;color:#55636c;margin-bottom:4px;">${p.valeur === null ? '—' : p.valeur}</div>
        <div style="width:100%;max-width:28px;height:${p.valeur ? Math.max((p.valeur / max) * 100, 3) : 0}%;background:${DA_COULEUR_PREVISIONNEL};border:1px dashed #55636c;border-radius:4px 4px 0 0;" title="${DA_MOIS_LONGS[p.mois]} ${p.annee} (prévisionnel) : ${p.valeur === null ? 'pas d\'historique' : p.valeur}"></div>
        <div style="font-size:11px;color:#55636c;margin-top:6px;text-align:center;">${DA_MOIS_LIBELLES[p.mois]}<br>${p.annee}</div>
      </div>`).join('')}
  </div>`;
}
