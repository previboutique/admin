// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// dashboard_intervenants.js — tableau de bord de la catégorie "Intervenants" :
// statistiques des heures dispensées par formateur et par nature (interne /
// sous-traitance externe), filtrables par année et par mois. Graphiques en
// barres horizontales plutôt qu'en camemberts — plus faciles à comparer d'un
// coup d'œil (les angles d'un camembert sont difficiles à juger précisément,
// surtout au-delà de 2-3 parts) ; à repasser en camembert si tu préfères
// vraiment ce rendu une fois que tu l'auras vu.

const TBI_MOIS_LIBELLES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Palette catégorielle (issue de la charte data-viz — ordre fixe, jamais cyclé).
const TBI_COULEURS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const TBI_COULEUR_AUTRES = '#9aa5ab';

async function ecranTableauBordIntervenants(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin:0 0 4px;">Tableau de bord — Intervenants</h2>
      <p style="margin:0;color:#55636c;font-size:13px;">Heures dispensées par formateur et par nature (interne / sous-traitance externe), sur la période choisie.</p>
    </div>
    <div class="carte">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="min-width:140px;">
          <label for="tbi-annee">Année</label>
          <select id="tbi-annee" onchange="rafraichirTableauBordIntervenants()"></select>
        </div>
        <div style="min-width:160px;">
          <label for="tbi-mois">Mois</label>
          <select id="tbi-mois" onchange="rafraichirTableauBordIntervenants()">
            <option value="">Tous les mois</option>
            ${TBI_MOIS_LIBELLES.slice(1).map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div id="tbi-contenu"><div class="carte">Chargement…</div></div>`;

  const { data, error } = await supa
    .from('sessions_formation')
    .select('date_debut, formateur_id, statut, formations_catalogue(duree_heures), profils:formateur_id(nom, prenom, formateur_externe)')
    .neq('statut', 'annulee')
    .order('date_debut', { ascending: true });

  if (error) { DEBUG.erreur('ecranTableauBordIntervenants', error); $('#tbi-contenu').innerHTML = '<div class="carte">Erreur de chargement.</div>'; return; }

  window.__tbiSessions = data || [];

  const annees = [...new Set(window.__tbiSessions.map(s => Number(s.date_debut.slice(0, 4))))].sort((a, b) => b - a);
  const anneeEnCours = new Date().getFullYear();
  if (!annees.includes(anneeEnCours)) annees.unshift(anneeEnCours);
  const selectAnnee = $('#tbi-annee');
  selectAnnee.innerHTML = `<option value="">Toutes les années</option>` + annees.map(a => `<option value="${a}" ${a === anneeEnCours ? 'selected' : ''}>${a}</option>`).join('');

  rafraichirTableauBordIntervenants();
}

function rafraichirTableauBordIntervenants() {
  const zone = $('#tbi-contenu');
  if (!zone) return;

  const anneeFiltre = $('#tbi-annee')?.value || '';
  const moisFiltre = $('#tbi-mois')?.value || '';

  const sessions = (window.__tbiSessions || []).filter(s => {
    if (anneeFiltre && s.date_debut.slice(0, 4) !== anneeFiltre) return false;
    if (moisFiltre && Number(s.date_debut.slice(5, 7)) !== Number(moisFiltre)) return false;
    return true;
  });

  const totalSessions = sessions.length;
  const totalHeures = sessions.reduce((a, s) => a + (Number(s.formations_catalogue?.duree_heures) || 0), 0);

  // Regroupement par formateur (heures = somme des durées des formations des
  // sessions qui lui sont assignées). Les sessions sans formateur assigné
  // sont comptées à part ("Non assigné"), pour rester visibles sans fausser
  // le classement des vrais formateurs.
  const parFormateur = {};
  sessions.forEach(s => {
    const heures = Number(s.formations_catalogue?.duree_heures) || 0;
    const cle = s.formateur_id || '__non_assigne__';
    if (!parFormateur[cle]) {
      parFormateur[cle] = {
        label: s.formateur_id ? `${s.profils?.prenom || ''} ${s.profils?.nom || ''}`.trim() || 'Formateur' : 'Non assigné',
        externe: !!s.profils?.formateur_externe,
        heures: 0, sessions: 0,
      };
    }
    parFormateur[cle].heures += heures;
    parFormateur[cle].sessions += 1;
  });
  const formateursActifs = Object.keys(parFormateur).filter(k => k !== '__non_assigne__').length;

  let listeFormateurs = Object.values(parFormateur).sort((a, b) => b.heures - a.heures);
  const nonAssigneIdx = listeFormateurs.findIndex(f => f.label === 'Non assigné');
  let nonAssigne = null;
  if (nonAssigneIdx !== -1) { nonAssigne = listeFormateurs[nonAssigneIdx]; listeFormateurs.splice(nonAssigneIdx, 1); }

  const TOP_N = 6;
  let repartitionFormateurs = listeFormateurs.slice(0, TOP_N).map((f, i) => ({ label: f.label, valeur: f.heures, couleur: TBI_COULEURS[i] }));
  if (listeFormateurs.length > TOP_N) {
    const resteHeures = listeFormateurs.slice(TOP_N).reduce((a, f) => a + f.heures, 0);
    repartitionFormateurs.push({ label: `Autres formateurs (${listeFormateurs.length - TOP_N})`, valeur: resteHeures, couleur: TBI_COULEUR_AUTRES });
  }
  if (nonAssigne && nonAssigne.heures > 0) {
    repartitionFormateurs.push({ label: 'Non assigné', valeur: nonAssigne.heures, couleur: '#d7dee3' });
  }

  const heuresInternes = Object.values(parFormateur).filter(f => f.label !== 'Non assigné' && !f.externe).reduce((a, f) => a + f.heures, 0);
  const heuresExternes = Object.values(parFormateur).filter(f => f.label !== 'Non assigné' && f.externe).reduce((a, f) => a + f.heures, 0);
  const repartitionNature = [
    { label: 'Formateurs internes', valeur: heuresInternes, couleur: TBI_COULEURS[0] },
    { label: 'Sous-traitance externe', valeur: heuresExternes, couleur: TBI_COULEURS[1] },
  ];

  zone.innerHTML = `
    <div class="carte">
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        ${tbiStatTuile('Sessions', totalSessions)}
        ${tbiStatTuile('Heures dispensées', totalHeures)}
        ${tbiStatTuile('Formateurs actifs', formateursActifs)}
      </div>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Heures dispensées par formateur</h3>
      ${tbiBarresHorizontales(repartitionFormateurs, 'h')}
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Formateurs internes vs sous-traitance externe</h3>
      ${tbiBarresHorizontales(repartitionNature, 'h')}
    </div>`;
}

function tbiStatTuile(libelle, valeur) {
  return `<div>
    <div style="font-size:12px;color:#55636c;">${esc(libelle)}</div>
    <div style="font-size:28px;font-weight:600;color:#1c2b36;">${esc(String(valeur))}</div>
  </div>`;
}

// Barres horizontales : label à gauche, barre colorée (fait <= 24px de haut,
// bout arrondi), valeur au bout. Légende omise volontairement (chaque barre
// porte déjà son libellé — l'identité n'a pas besoin de la couleur seule).
function tbiBarresHorizontales(items, unite) {
  const donnees = items.filter(i => i.valeur > 0);
  if (donnees.length === 0) return '<p style="color:#55636c;font-size:13px;">Aucune donnée sur cette période.</p>';
  const max = Math.max(...donnees.map(i => i.valeur));
  return `<div style="display:flex;flex-direction:column;gap:10px;">
    ${donnees.map(i => `
      <div style="display:flex;align-items:center;gap:10px;" title="${esc(i.label)} : ${esc(String(i.valeur))}${unite === 'h' ? ' h' : ''}">
        <div style="flex:0 0 170px;font-size:13px;color:#1c2b36;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(i.label)}</div>
        <div style="flex:1;background:#f4f6f8;border-radius:4px;height:20px;overflow:hidden;">
          <div style="height:100%;width:${Math.max((i.valeur / max) * 100, 3)}%;background:${i.couleur};border-radius:4px;"></div>
        </div>
        <div style="flex:0 0 60px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:#55636c;">${esc(String(i.valeur))}${unite === 'h' ? ' h' : ''}</div>
      </div>`).join('')}
  </div>`;
}
