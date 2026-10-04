// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// fiche_synthese.js — FEUILLE DE SYNTHÈSE d'une session (A3 paysage, recto/verso), document INTERNE
// (non envoyé au client). Reproduit à l'identique les modèles Excel « Administratif Mac SST » et
// « Administratif EPI » : le gabarit (textes fixes, cases, cadres) est dans fiche_synthese_gabarit.js ;
// ce fichier y ajoute les valeurs de la session (client, dates, stagiaires, évaluation, radar).
// Coordonnées en points (1 pt = 1/72 pouce), origine en haut à gauche, page A3 = 1190,55 x 841,89.
// Police : Carlito (équivalent métrique de Calibri), chargée depuis le dossier "polices".

const FS_PAGE_L = 1190.55, FS_PAGE_H = 841.89;
const FS_ASC = 0.952;                      // ligne de base = haut de la ligne + 0,952 x taille (Calibri)
const FS_COULEURS = { secourisme: '#00B050', incendie: '#FF0000', electrique: '#0070C0', autre: '#808080' };

// Matériel pédagogique : 8 emplacements fixes (cases du modèle), dans l'ordre du modèle.
// Les listes Secourisme et Incendie sont celles des modèles ; Habilitation électrique et autres : à adapter ici.
const FS_EMPLACEMENTS = [[211.4, 213.4], [391.5, 213.4], [31.3, 237.4], [211.4, 237.4], [391.5, 237.4], [31.3, 260.8], [211.4, 260.8], [391.5, 260.8]];
const FS_MATERIEL = {
  secourisme: ['Mannequin Ambu', 'Basic Buddy adulte', 'Mannequin enfant', 'Mannequin nourrisson', 'Mannequin OBVA N', 'DSA', 'Caisse simulation', "Plan d'intervention"],
  incendie: ['Générateur de flamme', 'Extincteur EAU', 'Extincteur CO2', 'Bouteille de Gaz', 'Veste Textile', 'Paire Gants EPI', 'Table Pliable', 'Caisse Incendie'],
  electrique: ['Armoire électrique', 'Pince ampèremétrique', 'VAT', 'Gants isolants', 'Écran facial', 'Tapis isolant', 'Cadenas de consignation', 'Documents de formation'],
  autre: [],
};

const FS_PEDAGO_EXTRA = { incendie: [[31.3, 132.7, "Adopter son comportement en cas d'incendie", 155]] };

const FS_QUESTIONS = (typeof QUESTIONS_SATISFACTION !== 'undefined') ? QUESTIONS_SATISFACTION : [];

function fsFamille(categorie) {
  const c = String(categorie || '').toLowerCase();
  if (/secour|sst/.test(c)) return 'secourisme';
  if (/incend|epi|évac|evac/.test(c)) return 'incendie';
  if (/habilit|électri|electri/.test(c)) return 'electrique';
  return 'autre';
}

const fsFr2 = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const fsDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const fsHex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Police Carlito : chargée une fois, puis mise en cache.
let FS_POLICES = null;
async function fsChargerPolices() {
  if (FS_POLICES) return FS_POLICES;
  const lire = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Police introuvable : ' + url + ' (dossier "polices" à téléverser sur GitHub Pages)');
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  FS_POLICES = { normal: await lire('polices/Carlito-Regular.ttf'), gras: await lire('polices/Carlito-Bold.ttf') };
  return FS_POLICES;
}

// Construit les deux pages. d = données déjà préparées (voir fsPreparer).
function fsConstruire(doc, d, polices) {
  doc.addFileToVFS('Carlito-Regular.ttf', polices.normal);
  doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal', undefined, 'Identity-H');
  doc.addFileToVFS('Carlito-Bold.ttf', polices.gras);
  doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold', undefined, 'Identity-H');

  const coul = FS_COULEURS[d.famille];
  const noir = [0, 0, 0];
  const texte = (x, haut, taille, gras, txt, couleur, opts) => {
    if (txt === null || txt === undefined || txt === '') return;
    doc.setFont('Carlito', gras ? 'bold' : 'normal'); doc.setFontSize(taille);
    doc.setTextColor(...(couleur ? (typeof couleur === 'string' ? fsHex(couleur) : couleur) : noir));
    doc.text(String(txt), x, haut + FS_ASC * taille, opts || {});
  };
  const largeur = (txt, taille, gras) => { doc.setFont('Carlito', gras ? 'bold' : 'normal'); doc.setFontSize(taille); return doc.getTextWidth(String(txt)); };
  // Texte tronqué à la largeur de la cellule (comme Excel qui coupe le texte à la limite de la cellule)
  const tronque = (txt, taille, gras, max) => { let t = String(txt || ''); while (t.length && largeur(t, taille, gras) > max) t = t.slice(0, -1); return t; };
  const cadres = rects => { doc.setFillColor(0, 0, 0); rects.forEach(r => doc.rect(r[0], r[1], r[2], r[3], 'F')); };
  const croix = (bx, by) => texte(bx + 2.8, by + 0.4, 12, false, 'X');
  // Valeur écrite juste après son libellé fixe
  const apres = (x, haut, libelle, valeur, gras, couleur) => { if (valeur) texte(x + largeur(libelle, 12, false) + 6, haut, 12, gras, valeur, couleur); };

  const logo = d.logo;
  const placerLogos = (haut) => {
    if (!logo) return;
    try {
      const p = doc.getImageProperties(logo);
      const l = 97.5, h = Math.min(62, l * p.height / p.width);
      [438.0, 1019.0].forEach(x => doc.addImage(logo, p.fileType || 'PNG', x, haut, l, h, 'logo-of', 'FAST'));
    } catch (e) { /* logo illisible : on continue sans */ }
  };

  // ================= RECTO (page 1) =================
  const G = FS_GABARIT;
  cadres(G.p1.r);
  G.p1.t.forEach(t => texte(t[0], t[1], t[2], !!t[3], t[4]));
  placerLogos(54);

  // Bandeau vertical (couleur selon la famille de formation)
  doc.setFillColor(...fsHex(coul)); doc.rect(548, 54, 92, 247, 'F');
  const bande = (x, sens, txt) => {
    let taille = 12; const w0 = largeur(txt, 12, true);
    if (w0 > 232) taille = 12 * 232 / w0;
    const w = largeur(txt, taille, true);
    doc.setFont('Carlito', 'bold'); doc.setFontSize(taille); doc.setTextColor(0, 0, 0);
    if (sens === 90) doc.text(txt, x, 61 + w, { angle: 90 });
    else doc.text(txt, x, 57, { angle: -90 });
  };
  const ligneFormation = `Formation : ${d.codeFormation}   Date : ${d.dateDebut}`;
  const ligneClient = `Client : ${d.nomClient}   N° session : ${d.numeroSession}`;
  bande(562, 90, ligneFormation); bande(582, 90, ligneClient);
  bande(605, -90, ligneClient); bande(625, -90, ligneFormation);

  // Matériel pédagogique
  texte(291.4 - largeur(d.libelleFamille, 12, true) / 2, 189.4, 12, true, d.libelleFamille, coul);
  (FS_PEDAGO_EXTRA[d.famille] || []).forEach(e => {   // outil pédagogique propre à la famille (ex. Incendie)
    cadres([[18, 133, 1, 16], [19, 133, 10, 1], [19, 148, 10, 1], [28, 134, 1, 15]]);
    texte(e[0], e[1], 12, false, tronque(e[2], 12, false, e[3]));
  });
  (FS_MATERIEL[d.famille] || []).forEach((m, i) => {
    const e = FS_EMPLACEMENTS[i]; if (!e) return;
    const bx = Math.round(e[0] - 13.3), by = Math.round(e[1] - 0.4);   // case à cocher à gauche du libellé
    cadres([[bx, by, 1, 16], [bx + 1, by, 10, 1], [bx + 1, by + 15, 10, 1], [bx + 10, by + 1, 1, 15]]);
    texte(e[0], e[1], 12, false, tronque(m, 12, false, 165));
  });

  // Prise de contact
  texte(882.3, 108.7, 12, false, d.nomClient);
  apres(652.2, 132.7, 'Nom du contact :', d.contactNom);
  apres(892.3, 132.7, 'Courriel :', d.contactEmail);
  texte(772.3, 156.7, 12, false, tronque(d.contactTel, 12, false, 62));
  texte(923.6, 156.7, 12, false, tronque(d.adresseClient, 12, false, 1175 - 923.6));
  texte(772.3, 189.4, 12, true, d.libelleFamille, coul);
  texte(772.3, 213.4, 12, true, tronque(d.nomFormation, 12, true, 1175 - 772.3), coul);
  texte(822.3, 237.4, 12, true, tronque(d.dateHoraires, 12, true, 1175 - 822.3), '#0070C0');

  // Administratif
  if (d.devisNumero) croix(769, 285);
  texte(1002.3, 285.4, 12, false, d.devisNumero);
  texte(1118.4, 285.4, 12, false, d.prix);
  if (d.conventionSignee) { croix(769, 309); croix(839, 309); apres(912.3, 309.4, 'Date de signature :', d.conventionSignee); }
  apres(912.3, 333.4, "Nombre d'inscrit :", String(d.nbInscrits));
  if (d.famille === 'secourisme') {
    FS_GABARIT.sst.forEach(t => texte(t[0], t[1], t[2], !!t[3], t[4], t[5] === '#ff0000' ? '#FF0000' : null));
    apres(972.3, 260.8, 'N° ForePrev :', d.numeroForprev);
    apres(652.2, 381.5, 'Date déclaration ForePrev :', d.dateForprev);
  }

  // Infos entreprise
  if (d.interEntreprise) croix(649, 431); else if (d.nbClients >= 1) croix(769, 431);
  if (d.sousTraitance) croix(889, 431);
  texte(692.2, 455.5, 12, false, d.nomClient);
  texte(902.3, 455.5, 12, false, d.siret);
  apres(1032.3, 455.5, 'Code APE :', d.ape);
  texte(742.2, 480.8, 12, false, d.secteur);
  texte(791.6, 505.5, 12, true, tronque(d.lieu, 12, true, 1035 - 791.6), '#0070C0');
  // AT / MP / jours d'ITT (N-1 puis N-2)
  const stat = (s, centres) => { if (!s) return; [s.at, s.mp, s.itt].forEach((v, i) => { if (v !== null && v !== undefined) texte(centres[i] - largeur(String(v), 12, false) / 2, 553.5, 12, false, String(v)); }); };
  stat(d.statN1, [922, 962, 1004]); stat(d.statN2, [1072, 1112, 1154]);

  // QR codes de la session (émargement + évaluation), dans l'espace libre sous le matériel
  const qrs = (d.qrs || []).filter(q => q && q.image);
  qrs.forEach((q, i) => {
    const taille = 110, x = qrs.length === 1 ? 240 : 70 + i * 250, y = 335;
    try { doc.addImage(q.image, 'PNG', x, y, taille, taille, 'qr-' + i, 'FAST'); } catch (e) { return; }
    const w = largeur(q.libelle, 12, true);
    texte(x + taille / 2 - w / 2, y + taille + 2, 12, true, q.libelle);
    const w2 = largeur(q.detail, 10, false);
    texte(x + taille / 2 - w2 / 2, y + taille + 17, 10, false, q.detail, '#55636C');
  });

  // Liste des inscrits : jusqu'à 10 stagiaires = présentation du modèle (5 lignes x 2 colonnes) ;
  // de 11 à 20 = présentation resserrée (10 lignes x 2 colonnes, texte plus petit) ; au-delà de 20 : mention.
  const MAX_INSCRITS = 20;
  if (d.inscrits.length <= 10) {
    d.inscrits.forEach((p, i) => {
      const x = i % 2 === 0 ? 21.3 : 311.4, haut = 505.5 + 48 * Math.floor(i / 2);
      texte(x, haut, 12, false, tronque('Identité : ' + p.identite, 12, false, 262));
      texte(x, haut + 24, 12, false, tronque('Employeur : ' + p.employeur, 12, false, 262));
    });
  } else {
    // on retire les 10 cadres du modèle et on dessine 20 cadres plus bas
    doc.setFillColor(255, 255, 255);
    doc.rect(10, 500, 590, 60 + 240, 'F');
    const ph = 29.5;
    for (let i = 0; i < MAX_INSCRITS; i++) {
      const bx = i % 2 === 0 ? 18 : 308, by = 502 + ph * Math.floor(i / 2);
      cadres([[bx, by, 1, 28], [bx + 1, by, 280, 1], [bx + 1, by + 27, 280, 1], [bx + 280, by + 1, 1, 27]]);
      const p = d.inscrits[i];
      if (p) {
        texte(bx + 3.3, by + 1.5, 9.5, false, tronque('Identité : ' + p.identite, 9.5, false, 272));
        texte(bx + 3.3, by + 14, 9.5, false, tronque('Employeur : ' + p.employeur, 9.5, false, 272));
      }
    }
  }
  if (d.inscrits.length > MAX_INSCRITS) texte(21.3, 800, 10, false, `+ ${d.inscrits.length - MAX_INSCRITS} autre(s) stagiaire(s) non listé(s) — voir la liste de la session`, '#C00000');

  // ================= VERSO (page 2) =================
  doc.addPage([FS_PAGE_L, FS_PAGE_H], 'landscape');
  cadres(G.p2.r);
  G.p2.t.forEach(t => texte(t[0], t[1], t[2], !!t[3], t[4]));
  placerLogos(64.1);

  // Bilan pédagogique : tableau des notes
  const tops = [599.5, 615.5, 631.5, 647.5, 663.6, 679.6, 695.6, 711.6, 727.6, 742.9];
  d.lignesEval.forEach((l, i) => {
    if (!l.nb) return;
    l.c.forEach((v, k) => { const cx = [310.1, 340.1, 370.1, 400.1][k]; texte(cx, tops[i], 12, false, String(v)); });
    texte(425.5, tops[i], 12, false, fsFr2(l.moy) + ' / 4');
  });
  if (d.noteTotale !== null) texte(505.5, 599.5, 12, false, fsFr2(d.noteTotale) + '  /4');

  // Radar de satisfaction (10 axes, 4 anneaux, centre (897 ; 667), rayon 101 pour la note 4)
  const cx = 897.0, cy = 667.0, R = 101.0, N = 10;
  const pt = (k, r) => { const a = 2 * Math.PI * k / N; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  doc.setLineWidth(0.75); doc.setDrawColor(0, 112, 192);
  [1, 2, 3, 4].forEach(a => { const r = R * a / 4; for (let k = 0; k < N; k++) { const p = pt(k, r), q = pt(k + 1, r); doc.line(p[0], p[1], q[0], q[1]); } });
  doc.setDrawColor(42, 113, 175);
  for (let k = 0; k < N; k++) { const p = pt(k, R); doc.line(cx, cy, p[0], p[1]); }
  const valeurs = d.lignesEval.map(l => l.moy);
  if (valeurs.some(v => v !== null)) {
    const pts = valeurs.map((v, k) => pt(k, R * Math.max(0, Math.min(4, v || 0)) / 4));
    doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.4 }));
    doc.setFillColor(...fsHex(coul));
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
    doc.restoreGraphicsState();
    doc.setLineWidth(1); doc.setDrawColor(...fsHex(coul));
    for (let k = 0; k < N; k++) { const p = pts[k], q = pts[(k + 1) % N]; doc.line(p[0], p[1], q[0], q[1]); }
  }
  [['0,00', 661.6], ['1,00', 636.2], ['2,00', 611.5], ['3,00', 586.2], ['4,00', 560.9]].forEach(a => texte(871.6, a[1], 9, false, a[0], '#7F7F7F'));
}

// Prépare les valeurs à partir de la session, des stagiaires et des données chargées.
function fsPreparer(session, participants, extra) {
  extra = extra || {};
  const f = session.formations_catalogue || {};
  const famille = fsFamille(f.categorie);
  const libelleFamille = f.categorie || ({ secourisme: 'Secourisme', incendie: 'Incendie', electrique: 'Habilitation électrique' })[famille] || '';
  const client = extra.client || null;
  const adresseClient = client ? [client.adresse, [client.code_postal, String(client.ville || '').toUpperCase()].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (client.code_postal ? ` (${String(client.code_postal).slice(0, 2)})` : '') : '';
  const contact = extra.contact || null;

  // Dates et horaires : "du 06/11/2024 de 09:00 à 12:00 et de 13:00 à 17:00"
  const hor = (session.horaires || []).filter(h => h && h.date).sort((a, b) => (a.date + (a.debut || '')).localeCompare(b.date + (b.debut || '')));
  const dates = [...new Set(hor.map(h => h.date))];
  const d1 = dates[0] || session.date_debut, d2 = dates[dates.length - 1] || session.date_fin || session.date_debut;
  const premiers = hor.filter(h => h.date === d1 && h.debut && h.fin).map(h => `de ${h.debut} à ${h.fin}`).join(' et ');
  const dateHoraires = `du ${fsDate(d1)}${d2 && d2 !== d1 ? ' au ' + fsDate(d2) : ''}${premiers ? ' ' + premiers : ''}`;

  const clientsDistincts = new Set((participants || []).map(p => p.client_id).filter(Boolean));
  const nbClients = Math.max(clientsDistincts.size, client ? 1 : 0);
  const prixNum = extra.prix !== undefined && extra.prix !== null ? extra.prix : session.prix_unitaire;

  const evalues = (participants || []).filter(p => p.evaluation_satisfaction && Object.keys(p.evaluation_satisfaction).length);
  const lignesEval = FS_QUESTIONS.map(q => {
    const c = [0, 0, 0, 0];
    evalues.forEach(p => { const v = Number(p.evaluation_satisfaction[q]); if (v >= 1 && v <= 4) c[v - 1]++; });
    const nb = c.reduce((a, b) => a + b, 0);
    return { c, nb, moy: nb ? (c[0] + 2 * c[1] + 3 * c[2] + 4 * c[3]) / nb : null };
  });
  const moys = lignesEval.filter(l => l.moy !== null).map(l => l.moy);

  const civ = c => (/^m(me|adame)/i.test(c || '') ? 'Mme' : (/^m/i.test(c || '') ? 'M.' : ''));
  const inscrits = (participants || []).map(p => {
    const s = p.stagiaires || {};
    const ent = p.clients?.raison_sociale || '';
    return { identite: [civ(s.civilite), String(s.nom || '').toUpperCase(), s.prenom || ''].filter(Boolean).join(' '), employeur: ent ? ent + (p.clients?.ville ? ' à ' + p.clients.ville : '') : '' };
  });

  return {
    famille, libelleFamille, logo: extra.logo || null,
    codeFormation: f.code || '', nomFormation: f.denomination || '',
    dateDebut: fsDate(session.date_debut), numeroSession: session.numero_session || '',
    nomClient: client?.raison_sociale || (inscrits[0]?.employeur || '').split(' à ')[0] || '',
    adresseClient, contactNom: contact ? [contact.civilite, contact.prenom, contact.nom].filter(Boolean).join(' ') : '',
    contactEmail: contact?.email || '', contactTel: contact?.telephone || '',
    dateHoraires, devisNumero: extra.devis || session.numero_devis || '',
    prix: prixNum !== null && prixNum !== undefined && prixNum !== '' ? fsFr2(Number(prixNum)) + '  €' : '',
    conventionSignee: extra.conventionSigneeLe ? fsDate(extra.conventionSigneeLe) : '',
    nbInscrits: (participants || []).length,
    numeroForprev: session.numero_forprev || '', dateForprev: fsDate(session.date_declaration_forprev),
    interEntreprise: clientsDistincts.size > 1, nbClients, sousTraitance: !!session.sous_traitance_recue,
    siret: client?.siret || '', ape: client?.code_ape || '', secteur: client?.secteur_activite || '',
    lieu: [session.lieu, session.adresse, [session.code_postal, String(session.ville || '').toUpperCase()].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    statN1: extra.statN1 ? { at: extra.statN1.accidents_travail, mp: extra.statN1.maladies_professionnelles, itt: extra.statN1.jours_itt } : null,
    statN2: extra.statN2 ? { at: extra.statN2.accidents_travail, mp: extra.statN2.maladies_professionnelles, itt: extra.statN2.jours_itt } : null,
    qrs: extra.qrs || [],
    inscrits, lignesEval, noteTotale: moys.length ? moys.reduce((a, b) => a + b, 0) / moys.length : null,
  };
}

async function genererFicheSynthese(session, participants) {
  try {
    const polices = await fsChargerPolices();
    const orgId = session.organisation_id;
    const sc = (window.__sessionClients || []);
    // Client principal : 1er client rattaché à la session, sinon celui des stagiaires, sinon l'ancien champ client_id
    const clientId = sc[0]?.client_id || (participants || []).map(p => p.client_id).find(Boolean) || session.client_id || null;
    let client = null, contact = null, statN1 = null, statN2 = null, conv = null;
    const annee = Number(String(session.date_debut || '').slice(0, 4)) || new Date().getFullYear();
    if (clientId) {
      const [c, ct, st, sg] = await Promise.all([
        supa.from('clients').select('raison_sociale, siret, code_ape, adresse, code_postal, ville, secteur_activite').eq('id', clientId).maybeSingle(),
        supa.from('contacts_client').select('civilite, nom, prenom, email, telephone, contact_principal').eq('client_id', clientId).order('contact_principal', { ascending: false }).limit(1),
        supa.from('statistiques_client').select('annee, accidents_travail, maladies_professionnelles, jours_itt').eq('client_id', clientId).in('annee', [annee - 1, annee - 2]),
        supa.from('signatures_conventions').select('signe_le').eq('session_id', session.id).eq('client_id', clientId).order('signe_le', { ascending: false }).limit(1),
      ]);
      client = c.data || null; contact = (ct.data || [])[0] || null;
      statN1 = (st.data || []).find(x => x.annee === annee - 1) || null; statN2 = (st.data || []).find(x => x.annee === annee - 2) || null;
      conv = (sg.data || [])[0]?.signe_le || null;
    }
    // QR codes (mêmes liens que dans la fiche session) ; ignorés si les patchs SQL correspondants n'ont pas été exécutés
    const qrs = [];
    try {
      if (typeof qrcode === 'function' && typeof qrDataUrl === 'function') {
        if (session.token_emargement) qrs.push({ image: qrDataUrl(urlEmargement(session), 8), libelle: 'Émargement', detail: 'stagiaires et formateur' });
        if (session.token_evaluation) qrs.push({ image: qrDataUrl(urlEvaluation(session), 8), libelle: 'Évaluation', detail: 'satisfaction à chaud' });
      }
    } catch (e) { DEBUG.erreur('fiche synthèse QR', e); }
    const entree = sc.find(x => x.client_id === clientId);
    const d = fsPreparer(session, participants, {
      client, contact, statN1, statN2, conventionSigneeLe: conv, logo: S.organisation?._logoDataUrl || null, qrs,
      prix: entree?.prix_unitaire ?? null, devis: entree?.numero_devis || null,
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [FS_PAGE_L, FS_PAGE_H], compress: true });
    fsConstruire(doc, d, polices);
    doc.save(`Feuille de synthese ${session.numero_session || ''} ${d.codeFormation}.pdf`.replace(/\s+/g, ' ').replace(/[\\/:*?"<>|]/g, '-'));
  } catch (e) {
    DEBUG.erreur('genererFicheSynthese', e);
    toast('Feuille de synthèse impossible : ' + e.message, 'erreur');
  }
}
