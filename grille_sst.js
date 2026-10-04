// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// grille_sst.js — Grilles de certification des compétences du SST (INRS) :
//   • « sst » = Formation initiale (juin 2020) : compétences C1 à C8, 8 acquises = certifié ;
//   • « mac » = Maintien et actualisation des compétences (juillet 2023) : C2 à C8, 7 acquises = certifié.
// Le formateur saisit, pour chaque stagiaire, chaque indicateur (Acquis / Non acquis) ; l'état de
// chaque compétence et le résultat (certifié oui/non) sont calculés selon les « conditions
// d'acquisition » de la grille. Un PDF (2 pages A4) par stagiaire est généré en fin de session.
// Stockage : session_participants.grille_sst (JSON, voir patch_2026-10-05h_grille_sst.sql).

// ---------------------------------------------------------------------------
// Définition des grilles. regle : 'inc' = tous les indicateurs incontournables (surlignés en jaune)
// doivent être acquis ; 'any' = l'un des indicateurs acquis ; 'all' = tous acquis ; 'info' = non
// bloquant (indicateur sans critère incontournable, ignoré dans le calcul).
// ---------------------------------------------------------------------------
const GS_GRILLES = {
  sst: {
    titre: 'Formation initiale', edition: 'Juin 2020', seuil: 8, codes: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
    epreuves: [
      { titre: "EPREUVE 1 : Lors d’une mise en situation d'accident du travail simulée (action / analyse), le candidat devra montrer sa capacité à mettre en œuvre l’intégralité des compétences lui permettant d’intervenir efficacement", comps: ['C2', 'C3', 'C4', 'C5'] },
      { titre: "EPREUVE 2 : Lors d’un entretien avec le formateur, le candidat devra répondre à un questionnement simple portant sur sa connaissance du cadre réglementaire de l’activité SST et ses compétences en matière de prévention", comps: ['C1', 'C6', 'C7', 'C8'] },
    ],
    comps: {
      C1: { groupes: [{ label: "Délimiter son champ d’intervention en matière de secours", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C1a1', t: "Explique les limites de son intervention" }] }] },
      C2: { groupes: [
        { label: "Identifier les dangers persistants et repérer les personnes qui pourraient y être exposées", regle: 'inc', cond: "Au moins l’indicateur incontournable acquis",
          ind: [{ id: 'C2a1', inc: 1, t: "Repère le(s) danger(s) persistant(s) dans la situation d’accident simulée" },
                { id: 'C2a2', t: "Repère la(les) personne(s) qui est(sont) exposée(s) au(x) danger(s) persistant(s) identifié(s)" }] },
        { label: "Supprimer ou isoler le danger persistant, ou soustraire la victime au danger persistant sans s'exposer soi-même", regle: 'any', cond: "L’un des indicateurs acquis",
          ind: [{ id: 'C2b1', t: "Assure ou fait assurer la suppression" }, { id: 'C2b2', t: "Isole ou fait isoler le danger" }, { id: 'C2b3', t: "Soustrait ou fait soustraire la victime au danger" }] }] },
      C3: { groupes: [{ label: "Rechercher, suivant un ordre déterminé, la présence d’un (ou plusieurs) des signes indiquant que la vie de la victime est immédiatement menacée", regle: 'inc', cond: "Au moins l’indicateur incontournable acquis",
        ind: [{ id: 'C3a1', inc: 1, t: "Recherche les signes indiquant que la vie de la victime est menacée" }, { id: 'C3a2', t: "Effectue l’examen dans l’ordre déterminé" }] }] },
      C4: { groupes: [{ label: "Garantir une alerte favorisant l’arrivée de secours adaptés au plus près de la victime", regle: 'inc', cond: "Au moins l’indicateur incontournable acquis",
        ind: [{ id: 'C4a1', inc: 1, t: "Transmet le message d’alerte permettant le déclenchement des secours adaptés" }, { id: 'C4a2', t: "Favorise l’arrivée des secours au plus près de la victime" }] }] },
      C5: { cond: "Au moins les 2 indicateurs incontournables acquis", groupes: [
        { label: "Choisir à l’issue de l’examen l’action ou les actions à effectuer", regle: 'inc', ind: [{ id: 'C5a1', inc: 1, t: "Choisit l’action appropriée au résultat à atteindre" }] },
        { label: "Réaliser l’action ou les actions choisie(s) en respectant la conduite à tenir indiquée dans le guide des données techniques", regle: 'info', ind: [{ id: 'C5b1', t: "Utilise la (ou les) technique(s) préconisée(s)" }] },
        { label: "Surveiller, jusqu'à la prise en charge de la victime par les secours spécialisés, l’amélioration ou l’aggravation de son état et adapter sa conduite si besoin", regle: 'inc',
          ind: [{ id: 'C5c1', inc: 1, t: "Surveille la victime et agit en conséquence jusqu’à la prise en charge de celle-ci par les secours" }] }] },
      C6: { groupes: [{ label: "Situer son rôle de SST dans l’organisation de la prévention de l’entreprise", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C6a1', t: "Indique comment il peut contribuer concrètement à la prévention dans son entreprise" }] }] },
      C7: { groupes: [{ label: "Caractériser des risques professionnels dans une situation de travail", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C7a1', t: "À partir d’une situation dangereuse, détermine des risques et les autres dommages potentiels" }] }] },
      C8: { groupes: [{ label: "Participer à la maîtrise des risques professionnels par des actions de prévention", regle: 'inc', cond: "Au moins l’indicateur incontournable acquis",
        intro: "À partir de la situation dangereuse ayant engendré le dommage dans la situation précédemment simulée :",
        ind: [{ id: 'C8a1', inc: 1, t: "supprime ou à défaut réduit les risques" }, { id: 'C8a2', t: "propose, si possible, des pistes d’amélioration" }] }] },
    },
  },
  mac: {
    titre: 'Maintien et Actualisation des Compétences', edition: 'Juillet 2023', seuil: 7, codes: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
    epreuves: [
      { titre: "EPREUVE 1 : A partir d’une mise en situation d'accident du travail proposée par le formateur, le candidat devra montrer sa capacité à mettre en œuvre les compétences qui lui permettraient d’intervenir efficacement", comps: ['C2', 'C3', 'C4', 'C5'] },
      { titre: "EPREUVE 2 : Le candidat répondra à un questionnement simple portant sur ses compétences en matière de prévention", comps: ['C6', 'C7', 'C8'] },
    ],
    comps: {
      C2: { groupes: [{ label: "Supprimer ou isoler le danger persistant, ou soustraire la victime au danger persistant sans s'exposer soi-même", regle: 'any', cond: "L’un des indicateurs acquis",
        ind: [{ id: 'C2b1', t: "Assure ou fait assurer la suppression" }, { id: 'C2b2', t: "Isole ou fait isoler le danger" }, { id: 'C2b3', t: "Soustrait ou fait soustraire la victime au danger" }] }] },
      C3: { groupes: [{ label: "Rechercher, suivant un ordre déterminé, la présence d’un (ou plusieurs) des signes indiquant que la vie de la victime est immédiatement menacée", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C3a1', t: "Recherche les signes indiquant que la vie de la victime est menacée" }] }] },
      C4: { groupes: [{ label: "Garantir une alerte favorisant l’arrivée de secours adaptés au plus près de la victime", regle: 'inc', cond: "Au moins l’indicateur incontournable acquis",
        ind: [{ id: 'C4a1', inc: 1, t: "Transmet le message d’alerte permettant le déclenchement des secours adaptés" }, { id: 'C4a2', t: "Favorise l’arrivée des secours au plus près de la victime" }] }] },
      C5: { cond: "Les 2 indicateurs acquis", groupes: [
        { label: "Choisir à l’issue de l’examen l’action ou les actions à effectuer", regle: 'all', ind: [{ id: 'C5a1', t: "Choisit l’action appropriée au résultat à atteindre" }] },
        { label: "Surveiller, jusqu'à la prise en charge de la victime par les secours spécialisés, l’amélioration ou l’aggravation de son état et adapter sa conduite si besoin", regle: 'all',
          ind: [{ id: 'C5c1', t: "Surveille la victime et agit en conséquence jusqu’à la prise en charge de celle-ci par les secours" }] }] },
      C6: { groupes: [{ label: "Situer son rôle de SST dans l’organisation de la prévention de l’entreprise", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C6a1', t: "Indique comment il peut contribuer concrètement à la prévention dans son entreprise" }] }] },
      C7: { groupes: [{ label: "Caractériser des risques professionnels dans une situation de travail", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C7a1', t: "A partir de la situation d’accident de travail précédemment simulée, explicite le mécanisme d’apparition du dommage rencontré" }] }] },
      C8: { groupes: [{ label: "Participer à la maîtrise des risques professionnels par des actions de prévention", regle: 'all', cond: "L’indicateur acquis",
        ind: [{ id: 'C8a1', t: "A partir de la situation d’accident précédemment simulée, propose des actions visant à supprimer ou à défaut réduire les risques" }] }] },
    },
  },
};

// Quelle grille s'applique à la formation de la session ? null = pas une formation SST.
function grilleSstType(session) {
  const f = session?.formations_catalogue;
  if (!f) return null;
  const texte = `${f.denomination || ''} ${f.code || ''}`;
  if (!/\bsst\b|sauveteur/i.test(texte)) return null;
  return (f.type_formation === 'recyclage' || /\bmac\b|maintien|actualisation|recyclage/i.test(texte)) ? 'mac' : 'sst';
}

// ---------------------------------------------------------------------------
// Calcul. État d'un indicateur : true (acquis), false (non acquis), null/undefined (non évalué).
// Résultat d'un groupe / d'une compétence : true, false, ou null (pas encore décidable).
// ---------------------------------------------------------------------------
function gsEtatGroupe(groupe, ind) {
  if (groupe.regle === 'info') return true;
  const val = groupe.ind.map(i => (ind || {})[i.id]);
  if (groupe.regle === 'any') {
    if (val.some(v => v === true)) return true;
    return val.every(v => v === false) ? false : null;
  }
  const requis = groupe.regle === 'inc' ? groupe.ind.map((i, k) => (i.inc ? val[k] : 'x')).filter(v => v !== 'x') : val;
  if (requis.some(v => v === false)) return false;
  if (requis.some(v => v !== true)) return null;
  return true;
}

function gsEtatCompetence(grille, code, ind) {
  const etats = grille.comps[code].groupes.map(g => gsEtatGroupe(g, ind));
  if (etats.some(e => e === false)) return false;
  if (etats.some(e => e === null)) return null;
  return true;
}

// Retourne { comp: {C1: true|false|null, ...}, acquises, certifie: true|false|null }
function gsCalculer(type, ind) {
  const grille = GS_GRILLES[type];
  const comp = {};
  let acquises = 0, refusees = 0;
  grille.codes.forEach(c => {
    comp[c] = gsEtatCompetence(grille, c, ind);
    if (comp[c] === true) acquises++;
    if (comp[c] === false) refusees++;
  });
  // MAC : 7 sur 7 ; SST : 8 sur 8 -> une seule compétence non acquise suffit à refuser.
  const certifie = acquises >= grille.seuil ? true : (refusees > 0 ? false : null);
  return { comp, acquises, certifie };
}

const gsLibelleEtat = e => e === true ? 'Acquise' : e === false ? 'Non acquise' : 'à évaluer';
const gsCouleurEtat = e => e === true ? '#1a7f3c' : e === false ? '#b3261e' : '#55636c';

// Nom de l'évaluateur proposé par défaut : formateur de la session, sinon l'utilisateur connecté.
function gsEvaluateurParDefaut(session) {
  if (session?.__formateurNom) return session.__formateurNom;
  if (S.profil && S.profil.role === 'formateur') return `${S.profil.prenom || ''} ${S.profil.nom || ''}`.trim();
  return '';
}

// ---------------------------------------------------------------------------
// Saisie (fiche de session, bouton par stagiaire)
// ---------------------------------------------------------------------------
function gsParticipant(pid) { return (window.__participantsCourants || []).find(x => x.id === pid); }

function toggleGrilleSst(participantId) {
  const zone = $('#grille-' + participantId);
  const visible = zone.style.display !== 'none';
  $$('[id^="fise-"], [id^="eval-"], [id^="grille-"]').forEach(z => z.style.display = 'none');
  if (visible) return;

  const session = window.__sessionCourante;
  const type = grilleSstType(session);
  const grille = GS_GRILLES[type];
  const p = gsParticipant(participantId);
  const sauve = p.grille_sst || {};
  const ind = sauve.grille === type ? (sauve.ind || {}) : {};
  const evaluateur = sauve.evaluateur || gsEvaluateurParDefaut(session);
  const dateCert = sauve.date_certification || session.date_fin || session.date_debut || '';
  const select = id => `<select class="gs-ind" data-id="${id}" style="width:130px;">
      <option value="">—</option><option value="oui" ${ind[id] === true ? 'selected' : ''}>Acquis</option><option value="non" ${ind[id] === false ? 'selected' : ''}>Non acquis</option></select>`;

  zone.innerHTML = `
    <div style="border-top:1px solid #e0e0e0;padding-top:10px;">
      <p style="font-size:12px;color:#55636c;margin:0 0 8px;">Grille de certification INRS — ${esc(grille.titre)} (${esc(grille.edition)}). Les indicateurs <mark style="background:#fff200;">surlignés</mark> sont incontournables. L'état de chaque compétence et le résultat se calculent tout seuls.</p>
      ${grille.epreuves.map(ep => `
        <div style="font-weight:600;font-size:12.5px;margin:10px 0 4px;color:#1a7f3c;">${esc(ep.titre.split(':')[0])}</div>
        ${ep.comps.map(code => {
          const c = grille.comps[code];
          return `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:6px 10px;margin-bottom:6px;background:#fff;">
            <div style="display:flex;justify-content:space-between;gap:8px;"><strong style="font-size:13px;">${code}</strong>
              <span class="gs-etat" data-code="${code}" style="font-size:12.5px;font-weight:600;"></span></div>
            ${c.groupes.map(g => `
              <div style="font-size:12px;color:#55636c;margin:4px 0 2px;">${esc(g.label)}${g.intro ? '<br><em>' + esc(g.intro) + '</em>' : ''}</div>
              ${g.ind.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0;font-size:13px;">
                <span style="flex:1;${i.inc ? 'background:#fff200;' : ''}">${esc(i.t)}</span>${select(i.id)}</div>`).join('')}`).join('')}
            <div style="font-size:11.5px;color:#55636c;margin-top:3px;">Condition : ${esc(c.cond || c.groupes[0].cond)}</div>
          </div>`;
        }).join('')}`).join('')}
      <div id="gs-resultat-${participantId}" style="font-size:14px;font-weight:700;margin:8px 0;"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div><label for="gs-eval-${participantId}">Formateur / évaluateur</label><input id="gs-eval-${participantId}" value="${esc(evaluateur)}" style="min-width:220px;"></div>
        <div><label for="gs-date-${participantId}">Date de certification</label><input id="gs-date-${participantId}" type="date" value="${esc(dateCert)}"></div>
      </div>
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;" onclick="enregistrerGrilleSst('${participantId}')">Enregistrer</button>
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;background:#eee;color:#333;" onclick="enregistrerGrilleSst('${participantId}', true)">Enregistrer et télécharger le PDF</button>
    </div>`;
  zone.style.display = 'block';
  zone.dataset.type = type;
  // Groupes « l'un des indicateurs acquis » : un seul indicateur peut être Acquis, les autres passent à Non acquis.
  const groupesUniques = [];
  Object.values(grille.comps).forEach(c => c.groupes.forEach(g => { if (g.regle === 'any') groupesUniques.push(g.ind.map(i => i.id)); }));
  $$('.gs-ind', zone).forEach(sel => sel.onchange = () => {
    if (sel.value === 'oui') {
      const groupe = groupesUniques.find(ids => ids.includes(sel.dataset.id));
      if (groupe) $$('.gs-ind', zone).forEach(o => { if (o !== sel && groupe.includes(o.dataset.id)) o.value = 'non'; });
    }
    gsRafraichir(participantId);
  });
  gsRafraichir(participantId);
}

function gsLireDom(zone) {
  const ind = {};
  $$('.gs-ind', zone).forEach(s => { if (s.value) ind[s.dataset.id] = s.value === 'oui'; });
  return ind;
}

function gsRafraichir(participantId) {
  const zone = $('#grille-' + participantId);
  const type = zone.dataset.type;
  const r = gsCalculer(type, gsLireDom(zone));
  $$('.gs-etat', zone).forEach(el => { const e = r.comp[el.dataset.code]; el.textContent = gsLibelleEtat(e); el.style.color = gsCouleurEtat(e); });
  const res = $('#gs-resultat-' + participantId);
  const n = GS_GRILLES[type].codes.length;
  res.innerHTML = `${r.acquises} compétence(s) acquise(s) sur ${n} — Candidat certifié : <span style="color:${gsCouleurEtat(r.certifie)}">${r.certifie === true ? 'OUI' : r.certifie === false ? 'NON' : 'à évaluer'}</span>`;
}

async function enregistrerGrilleSst(participantId, pdf) {
  const zone = $('#grille-' + participantId);
  const type = zone.dataset.type;
  const ind = gsLireDom(zone);
  const valeur = { grille: type, ind, evaluateur: ($('#gs-eval-' + participantId).value || '').trim(), date_certification: $('#gs-date-' + participantId).value || null };
  const { error } = await supa.from('session_participants').update({ grille_sst: valeur }).eq('id', participantId);
  if (error) {
    DEBUG.erreur('enregistrerGrilleSst', error);
    toast(/grille_sst/.test(error.message || '') ? "Colonne manquante : exécute d'abord le patch 2026-10-05h dans Supabase." : 'Erreur : ' + error.message, 'erreur');
    return;
  }
  const p = gsParticipant(participantId);
  p.grille_sst = valeur;
  toast('Grille enregistrée.');
  const r = gsCalculer(type, ind);
  if (r.certifie !== null) {
    const statut = r.certifie ? 'certifie' : 'non_certifie';
    if (p.statut !== statut && confirm(`Résultat de la grille : ${r.certifie ? 'certifié' : 'non certifié'}. Passer le statut du stagiaire à « ${statut} » ?`)) {
      const { error: e2 } = await supa.from('session_participants').update({ statut }).eq('id', participantId);
      if (e2) { DEBUG.erreur('statut grille', e2); toast('Erreur : ' + e2.message, 'erreur'); }
      else { p.statut = statut; if (typeof rendreSynthese === 'function') rendreSynthese(); }
    }
  }
  if (pdf) genererGrilleSst(window.__sessionCourante, p);
}

// ---------------------------------------------------------------------------
// PDF — une grille de 2 pages A4 par stagiaire, mise en page calquée sur le modèle INRS.
// ---------------------------------------------------------------------------
const GS_VERT = [26, 127, 60];
const GS_X = [15, 25, 71, 137, 151, 165, 195];     // colonnes : code | compétence | indicateurs | acquis | non acquis | conditions

function gsFrDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }

function gsCase(doc, x, y, coche) {
  doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.3);
  doc.rect(x, y, 4, 4);
  if (coche) { doc.setLineWidth(0.5); doc.line(x + 0.7, y + 0.7, x + 3.3, y + 3.3); doc.line(x + 3.3, y + 0.7, x + 0.7, y + 3.3); }
}

function gsEntete(doc, type, session, st) {
  const grille = GS_GRILLES[type];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...GS_VERT);
  doc.text('Grille de certification des compétences du SST', 105, 18, { align: 'center' });
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text(grille.titre, 105, 25, { align: 'center' });
  ajouterLogoEnTete(doc);
}

function gsBlocCandidat(doc, session, st, y) {
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(15, y, 180, 24);
  doc.line(105, y, 105, y + 24);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...GS_VERT);
  doc.text('Candidat :', 18, y + 5.5); doc.text('Session :', 108, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Nom :', 18, y + 12); doc.text('Prénom :', 18, y + 17); doc.text('Date de naissance :', 18, y + 22);
  doc.text('Du :', 108, y + 12); doc.text('Au :', 108, y + 17);
  doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold');
  doc.text(String(st.nom || '').toUpperCase(), 40, y + 12);
  doc.text(String(st.prenom || ''), 40, y + 17);
  doc.text(gsFrDate(st.date_naissance), 54, y + 22);
  doc.text(gsFrDate(session.date_debut), 118, y + 12);
  doc.text(gsFrDate(session.date_fin || session.date_debut), 118, y + 17);
  return y + 24;
}

function gsTexte(doc, lignes, x, y, interligne, surligne) {
  lignes.forEach((l, k) => {
    const yy = y + k * interligne;
    if (surligne) { doc.setFillColor(255, 242, 0); doc.rect(x - 0.3, yy - 3, doc.getTextWidth(l) + 0.6, 4, 'F'); }
    doc.setTextColor(20, 20, 20);
    doc.text(l, x, yy);
  });
}

function gsEpreuve(doc, type, ep, ind, y) {
  const grille = GS_GRILLES[type];
  const [x0, x1, x2, x3, x4, x5, x6] = GS_X;
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  // En-tête d'épreuve
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...GS_VERT);
  const titre = doc.splitTextToSize(ep.titre, 172);
  const hT = titre.length * 4.4 + 3;
  doc.rect(x0, y, 180, hT);
  doc.text(titre, 105, y + 5, { align: 'center' });
  y += hT;
  // En-tête de colonnes
  doc.rect(x0, y, 180, 11);
  [x1, x2, x3, x4, x5].forEach(x => doc.line(x, y, x, y + 11));
  doc.setFontSize(9);
  doc.text('Compétences', (x1 + x2) / 2, y + 6.5, { align: 'center' });
  doc.text('INDICATEURS DE REUSSITE', (x2 + x3) / 2, y + 6.5, { align: 'center' });
  doc.text('Acquis', (x3 + x4) / 2, y + 6.5, { align: 'center' });
  doc.text('Non', (x4 + x5) / 2, y + 4.5, { align: 'center' }); doc.text('acquis', (x4 + x5) / 2, y + 8.5, { align: 'center' });
  doc.text("Conditions", (x5 + x6) / 2, y + 4.5, { align: 'center' }); doc.text("d’acquisition", (x5 + x6) / 2, y + 8.5, { align: 'center' });
  y += 11;

  ep.comps.forEach(code => {
    const c = grille.comps[code];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
    // Mesure : hauteur de chaque indicateur et de chaque groupe
    const mesure = c.groupes.map(g => {
      const inds = g.ind.map(i => {
        const l = doc.splitTextToSize(i.t, x3 - x2 - 4);
        return { i, lignes: l, h: Math.max(9, l.length * 4 + 4) };
      });
      const intro = g.intro ? doc.splitTextToSize(g.intro, x3 - x2 - 4) : [];
      const lab = doc.splitTextToSize(g.label, x2 - x1 - 4);
      let h = inds.reduce((s, a) => s + a.h, 0) + (intro.length ? intro.length * 4 + 2 : 0);
      const hLab = lab.length * 4 + 4;
      if (hLab > h) { inds[inds.length - 1].h += hLab - h; h = hLab; }
      return { g, inds, intro, lab, h };
    });
    const hComp = mesure.reduce((s, m) => s + m.h, 0);
    const condTxt = c.cond ? doc.splitTextToSize(c.cond, x6 - x5 - 4) : null;
    // Cases du code et des conditions (couvrent toute la compétence quand cond est global)
    doc.rect(x0, y, x1 - x0, hComp);
    doc.setFont('helvetica', 'bold'); doc.text(code, (x0 + x1) / 2, y + hComp / 2 + 1.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    if (condTxt) {
      doc.rect(x5, y, x6 - x5, hComp);
      doc.text(condTxt, x5 + 2, y + hComp / 2 - (condTxt.length - 1) * 2 + 1.2);
    }
    let yy = y;
    mesure.forEach(m => {
      doc.rect(x1, yy, x2 - x1, m.h);
      doc.text(m.lab, x1 + 2, yy + m.h / 2 - (m.lab.length - 1) * 2 + 1.2);
      if (!condTxt) {
        const ct = doc.splitTextToSize(m.g.cond, x6 - x5 - 4);
        doc.rect(x5, yy, x6 - x5, m.h);
        doc.text(ct, x5 + 2, yy + m.h / 2 - (ct.length - 1) * 2 + 1.2);
      }
      let yi = yy;
      if (m.intro.length) { doc.setFont('helvetica', 'italic'); doc.text(m.intro, x2 + 2, yi + 4); doc.setFont('helvetica', 'normal'); }
      let yTop = yi + (m.intro.length ? m.intro.length * 4 + 2 : 0);
      m.inds.forEach(a => {
        doc.rect(x2, yTop, x3 - x2, a.h);
        gsTexte(doc, a.lignes, x2 + 2, yTop + a.h / 2 - (a.lignes.length - 1) * 2 + 1.2, 4, !!a.i.inc);
        doc.rect(x3, yTop, x4 - x3, a.h); doc.rect(x4, yTop, x5 - x4, a.h);
        const v = (ind || {})[a.i.id];
        gsCase(doc, (x3 + x4) / 2 - 2, yTop + a.h / 2 - 2, v === true);
        gsCase(doc, (x4 + x5) / 2 - 2, yTop + a.h / 2 - 2, v === false);
        yTop += a.h;
      });
      // La zone « intro » couvre acquis/non acquis sur toute la hauteur du groupe : on referme le cadre.
      if (m.intro.length) { doc.rect(x3, yi, x4 - x3, m.intro.length * 4 + 2); doc.rect(x4, yi, x5 - x4, m.intro.length * 4 + 2); }
      yy += m.h;
    });
    y += hComp;
  });
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text('Les critères de réussite incontournables sont surlignés en jaune : ', 18, y + 5);
  const w = doc.getTextWidth('Les critères de réussite incontournables sont surlignés en jaune : ');
  doc.setFillColor(255, 242, 0); doc.rect(18 + w - 0.3, y + 2, doc.getTextWidth('exemple') + 0.6, 4, 'F');
  doc.setTextColor(20, 20, 20); doc.text('exemple', 18 + w, y + 5);
  return y + 8;
}

function gsSynthese(doc, type, r, valeur, session, y) {
  const grille = GS_GRILLES[type];
  const n = grille.codes.length;
  const hLignes = n * 5.6 + 2;
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(15, y, 180, hLignes + 17);
  doc.line(105, y, 105, y + hLignes + 17);
  doc.line(105, y + hLignes, 195, y + hLignes);
  doc.line(15, y + hLignes, 105, y + hLignes);
  // Gauche : formateur
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...GS_VERT);
  doc.text('Formateur / évaluateur :', 18, y + 5.5);
  doc.text('NOM :', 18, y + 14); doc.text('Prénom :', 18, y + 24); doc.text('Signature :', 18, y + 34);
  const ev = String(valeur.evaluateur || '').trim();
  const mots = ev.split(/\s+/);
  const prenom = mots.length > 1 ? mots[0] : '', nom = mots.length > 1 ? mots.slice(1).join(' ') : ev;
  doc.setTextColor(20, 20, 20);
  doc.text(nom.toUpperCase(), 34, y + 14); doc.text(prenom, 36, y + 24);
  doc.setTextColor(...GS_VERT);
  doc.text('Date de certification :', 18, y + hLignes + 5.5);
  doc.setTextColor(20, 20, 20); doc.text(gsFrDate(valeur.date_certification), 58, y + hLignes + 5.5);
  // Droite : compétences
  grille.codes.forEach((code, k) => {
    const yy = y + 5 + k * 5.6;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GS_VERT);
    doc.text(`Compétence ${code.slice(1)} :`, 108, yy);
    gsCase(doc, 138, yy - 3.2, r.comp[code] === true); doc.text('Acquise', 144, yy);
    gsCase(doc, 160, yy - 3.2, r.comp[code] === false); doc.text('Non acquise', 166, yy);
  });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...GS_VERT);
  doc.text('Résultat :', 108, y + hLignes + 5.5);
  doc.text('Candidat certifié', 108, y + hLignes + 13);
  gsCase(doc, 138, y + hLignes + 9.8, r.certifie === true); doc.text('OUI*', 144, y + hLignes + 13);
  gsCase(doc, 160, y + hLignes + 9.8, r.certifie === false); doc.text('NON', 166, y + hLignes + 13);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text(`* : ${grille.seuil} compétences acquises donnent la certification`, 18, y + hLignes + 17 + 5);
  return y + hLignes + 17 + 8;
}

function genererGrilleSst(session, participant, sansTelechargement) {
  const type = grilleSstType(session);
  if (!type) { toast("Cette formation n'est pas une formation SST : pas de grille.", 'erreur'); return null; }
  const st = participant.stagiaires || {};
  const sauve = participant.grille_sst || {};
  const ind = sauve.grille === type ? (sauve.ind || {}) : {};
  const valeur = { evaluateur: sauve.evaluateur || gsEvaluateurParDefaut(session), date_certification: sauve.date_certification || session.date_fin || session.date_debut };
  const r = gsCalculer(type, ind);
  const grille = GS_GRILLES[type];

  const doc = new jsPDF({ compress: true });
  gsEntete(doc, type, session, st);
  let y = gsBlocCandidat(doc, session, st, 32) + 6;
  y = gsEpreuve(doc, type, grille.epreuves[0], ind, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text('Page 1/2', 195, 275, { align: 'right' });
  doc.text(`Grille établie d'après le modèle INRS — ${grille.titre} — ${grille.edition}`, 105, 281, { align: 'center' });

  doc.addPage();
  gsEntete(doc, type, session, st);
  y = gsEpreuve(doc, type, grille.epreuves[1], ind, 32) + 8;
  gsSynthese(doc, type, r, valeur, session, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text('Page 2/2', 195, 275, { align: 'right' });
  doc.text(`Grille établie d'après le modèle INRS — ${grille.titre} — ${grille.edition}`, 105, 281, { align: 'center' });

  const prefixe = type === 'mac' ? 'Grille MAC SST' : 'Grille SST';
  return telechargerOuOuvrir(doc, nomFichierDoc(prefixe, session, st), sansTelechargement);
}

// Fin de session : un PDF par stagiaire (hors absents), regroupés dans un ZIP.
async function genererGrillesSstSession(session, participants) {
  const type = grilleSstType(session);
  if (!type) { toast("Cette formation n'est pas une formation SST.", 'erreur'); return; }
  const liste = (participants || []).filter(p => p.statut !== 'absent' && p.stagiaires);
  if (!liste.length) { toast('Aucun stagiaire présent dans cette session.', 'erreur'); return; }
  if (liste.length === 1) { genererGrilleSst(session, liste[0]); return; }
  if (typeof JSZip === 'undefined') { toast('Bibliothèque ZIP non chargée (JSZip manquant dans index.html).', 'erreur'); return; }
  const zip = new JSZip();
  liste.forEach(p => { const g = genererGrilleSst(session, p, true); if (g) zip.file(g.nomFichier, g.doc.output('blob')); });
  const contenu = await zip.generateAsync({ type: 'blob' });
  const nomZip = `Grilles ${type === 'mac' ? 'MAC SST' : 'SST'} - ${session.numero_session || ''} - ${session.date_debut}.zip`.replace(/[/\\?%*:|"<>]+/g, '').replace(/\s+/g, ' ');
  const url = URL.createObjectURL(contenu);
  const a = document.createElement('a'); a.href = url; a.download = nomZip; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  const nonEvalues = liste.filter(p => !(p.grille_sst && p.grille_sst.grille === type && Object.keys(p.grille_sst.ind || {}).length)).length;
  toast(`${liste.length} grille(s) générée(s)` + (nonEvalues ? ` — dont ${nonEvalues} non saisie(s) (cases vides).` : '.'));
}
