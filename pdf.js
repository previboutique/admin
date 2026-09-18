// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// pdf.js — génération des documents PDF (jsPDF), reproduisant les gabarits
// réels observés dans le classeur Excel d'origine (Convention, Convocation,
// AFF, Certificat de réalisation). La Feuille de présence n'avait pas
// d'exemple exploitable (version scannée) : mise en page originale à valider.
//
// Toutes les informations d'organisme (raison sociale, SIRET, représentant...)
// sont lues depuis S.organisation — rien n'est codé en dur, pour rester
// compatible avec la marque blanche.

const { jsPDF } = window.jspdf;
const MARGE = 15;
const LARGEUR_UTILE = 210 - MARGE * 2;

function formatDateLongue(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPlageDatesLongue(debut, fin) {
  if (!fin || debut === fin) return formatDateLongue(debut);
  return `du ${formatDateLongue(debut)} au ${formatDateLongue(fin)}`;
}

function piedDePageTexte() {
  return S.organisation.pied_de_page_documents ||
    `${S.organisation.raison_sociale}${S.organisation.forme_juridique ? ' - ' + S.organisation.forme_juridique : ''}` +
    `${S.organisation.siret ? ' — SIRET : ' + S.organisation.siret : ''}` +
    `${S.organisation.rcs ? ' – ' + S.organisation.rcs : ''}` +
    `${S.organisation.tva_intracommunautaire ? ' - n° TVA intracommunautaire : ' + S.organisation.tva_intracommunautaire : ''}`;
}

function ajouterPiedDePage(doc) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(piedDePageTexte(), 105, 289, { align: 'center' });
  }
}

function titre(doc, texte, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(texte, 105, y, { align: 'center' });
  return y + 7;
}

function sousTitre(doc, texte, y) {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(texte, 105, y, { align: 'center' });
  return y + 8;
}

function paragraphe(doc, texte, y, opts = {}) {
  doc.setFont('helvetica', opts.gras ? 'bold' : 'normal');
  doc.setFontSize(opts.taille || 10.5);
  doc.setTextColor(20, 20, 20);
  const lignes = doc.splitTextToSize(texte || '', opts.largeur || LARGEUR_UTILE);
  doc.text(lignes, opts.x || MARGE, y, opts.align ? { align: opts.align } : undefined);
  return y + lignes.length * (opts.interligne || 5) + (opts.apres || 3);
}

// sansTelechargement=true : construit le PDF (pied de page inclus) sans le
// télécharger — utilisé pour le téléchargement groupé (ZIP) et l'envoi par
// email, où le fichier part vers un ZIP ou vers Supabase Storage plutôt que
// directement sur le disque de l'utilisateur.
function telechargerOuOuvrir(doc, nomFichier, sansTelechargement) {
  ajouterPiedDePage(doc);
  if (!sansTelechargement) doc.save(nomFichier);
  return { doc, nomFichier };
}

// Logo de l'organisme, en haut à droite de chaque document (si téléversé
// dans l'écran Organisme). N'échoue jamais silencieusement : une image
// invalide est simplement ignorée.
function ajouterLogoEnTete(doc) {
  const logo = S.organisation?._logoDataUrl;
  if (!logo) return;
  try {
    const proprietes = doc.getImageProperties(logo);
    const largeurMax = 30, hauteurMax = 16;
    let largeur = largeurMax, hauteur = (proprietes.height / proprietes.width) * largeur;
    if (hauteur > hauteurMax) { hauteur = hauteurMax; largeur = (proprietes.width / proprietes.height) * hauteur; }
    const largeurPage = doc.internal.pageSize.getWidth();
    doc.addImage(logo, proprietes.fileType || 'PNG', largeurPage - MARGE - largeur, 8, largeur, hauteur);
  } catch (e) { /* image illisible — on ignore, le document reste généré sans logo */ }
}

// Signature du représentant + tampon de l'organisme, insérés côte à côte à
// la position (x, y) — utilisés sur les documents qui portent une signature
// (Convention, Certificat de réalisation).
function ajouterSignatureEtTampon(doc, x, y) {
  const largeurMax = 35, hauteurMax = 20;
  let decalage = 0;
  [S.organisation?._signatureDataUrl, S.organisation?._tamponDataUrl].forEach(image => {
    if (!image) return;
    try {
      const proprietes = doc.getImageProperties(image);
      let largeur = largeurMax, hauteur = (proprietes.height / proprietes.width) * largeur;
      if (hauteur > hauteurMax) { hauteur = hauteurMax; largeur = (proprietes.width / proprietes.height) * hauteur; }
      doc.addImage(image, proprietes.fileType || 'PNG', x - largeur - decalage, y, largeur, hauteur);
      decalage += largeur + 4;
    } catch (e) { /* image illisible — ignorée */ }
  });
}

function nomFichierDoc(prefixe, session, stagiaire, nomClient) {
  const date = session.date_debut;
  const client = (nomClient || session.clients?.raison_sociale || '').replace(/[^\w-]+/g, '');
  const nom = stagiaire ? (stagiaire.prenom + ' ' + stagiaire.nom).replace(/[^\w-]+/g, '') : '';
  return `${date} - ${prefixe}${nom ? ' - ' + nom : ''}${client ? ' - ' + client : ''}.pdf`.replace(/\s+/g, ' ');
}

// ============================================================================
// CONVOCATION — un document par stagiaire
// ============================================================================
function genererConvocation(session, participant, sansTelechargement) {
  const doc = new jsPDF();
  ajouterLogoEnTete(doc);
  const f = session.formations_catalogue;
  const st = participant.stagiaires;
  let y = 20;

  y = titre(doc, 'CONVOCATION', y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(`${st.civilite || ''} ${st.prenom} ${st.nom}`.trim(), 105, y + 3, { align: 'center' });
  y += 15;

  y = paragraphe(doc, `Vous êtes attendu(e) le ${formatPlageDatesLongue(session.date_debut, session.date_fin)} pour la formation intitulée :`, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const denomLignes = doc.splitTextToSize(f?.denomination || '', LARGEUR_UTILE);
  doc.text(denomLignes, 105, y + 3, { align: 'center' });
  y += denomLignes.length * 6 + 8;

  const adresse = [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')].filter(Boolean);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text("La formation se déroulera à l'adresse :", MARGE, y);
  doc.text(adresse.length ? adresse : ['Adresse à confirmer'], 195, y, { align: 'right' });
  y += Math.max(1, adresse.length) * 5 + 8;

  y = paragraphe(doc, `Elle se déroulera le ${formatPlageDatesLongue(session.date_debut, session.date_fin)}`, y, { apres: 6 });

  doc.setFont('helvetica', 'normal'); doc.text('Selon les horaires suivant :', MARGE, y); y += 8;
  const horaires = (session.horaires && session.horaires[0]) || {};
  doc.text(`Heure de début :   ${horaires.debut || 'à préciser'}`, MARGE, y); y += 6;
  doc.text(`Pause déjeuner :   ${horaires.pause_debut || '—'} à ${horaires.pause_fin || '—'}`, MARGE, y); y += 6;
  doc.text(`Heure de fin :     ${horaires.fin || 'à préciser'}`, MARGE, y); y += 10;

  if (f?.consignes_convocation) {
    y = paragraphe(doc, "Afin de garantir le bon déroulement du stage, merci d'appliquer les consignes ci-dessous :", y, { apres: 2 });
    f.consignes_convocation.split('\n').forEach(ligne => {
      y = paragraphe(doc, '• ' + ligne.replace(/^[•\t\s]+/, ''), y, { apres: 1 });
    });
    y += 6;
  }

  y = paragraphe(doc, `Veuillez recevoir ${st.civilite || ''} ${st.nom} , l'expression de nos sincères salutations.`, y, { apres: 10 });
  doc.setFont('helvetica', 'bold');
  doc.text(S.organisation.raison_sociale, 195, y, { align: 'right' });

  return telechargerOuOuvrir(doc, nomFichierDoc('Convocation', session, st), sansTelechargement);
}

// ============================================================================
// ATTESTATION DE FIN DE FORMATION (AFF) — un document par stagiaire
// ============================================================================
function genererAFF(session, participant, sansTelechargement) {
  const doc = new jsPDF();
  ajouterLogoEnTete(doc);
  const f = session.formations_catalogue;
  const st = participant.stagiaires;
  const formateurNom = session.__formateurNom || S.organisation.representant_nom || S.profil.prenom + ' ' + S.profil.nom;
  let y = 18;

  y = titre(doc, 'ATTESTATION DE FIN DE FORMATION', y);
  y = sousTitre(doc, 'Article L6353-1 du code du travail', y);

  y = paragraphe(doc, `Je soussigné, ${formateurNom}, formateur pour la ${S.organisation.raison_sociale}, certifie que :`, y, { apres: 4 });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(`${st.civilite || ''} ${st.nom} ${st.prenom}${st.date_naissance ? ' né(e) le ' + formatDateLongue(st.date_naissance) : ''}`.trim(), 105, y, { align: 'center' });
  y += 10;

  y = paragraphe(doc,
    "a suivi, dans le cadre d'une action de Formation Professionnelle Continue relevant de l'article L6313-1 du Code " +
    "du Travail – action de prévention / d'adaptation et développement des compétences / d'acquisition, entretien " +
    `ou perfectionnement de connaissances, la formation suivante dispensée le : ${formatPlageDatesLongue(session.date_debut, session.date_fin)}`, y, { apres: 5 });

  doc.autoTable({
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    body: [
      ['Intitulé', f?.denomination || ''],
      ['Rappel des compétences', f?.rappel_competences || ''],
      ['Durée', (f?.duree_heures || '') + ' Heures'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
  });
  y = doc.lastAutoTable.finalY + 5;

  y = paragraphe(doc,
    'a été évalué(e), au regard des objectifs de formation rappelés ci-dessus, à l\'issue des épreuves certificatives ' +
    'mises en œuvre par l\'équipe pédagogique, et a acquis les compétences suivantes :', y, { apres: 3 });

  const grille = (Array.isArray(participant.grille_certification) && participant.grille_certification.length)
    ? participant.grille_certification
    : (f?.competences || []).map(c => ({ libelle: c.libelle, acquis: null }));

  doc.autoTable({
    startY: y,
    head: [['Compétences visées', 'Acquise', 'Reste à acquérir']],
    body: grille.map(c => [c.libelle, c.acquis === true ? 'X' : '', c.acquis === false ? 'X' : '']),
    styles: { fontSize: 9.5, cellPadding: 2 },
    headStyles: { fillColor: [10, 92, 138] },
    columnStyles: { 1: { halign: 'center', cellWidth: 22 }, 2: { halign: 'center', cellWidth: 30 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  const toutAcquis = grille.length > 0 && grille.every(c => c.acquis === true);
  y = paragraphe(doc, toutAcquis
    ? "a validé l'ensemble des compétences visées par la formation."
    : "a validé les compétences visées par la formation indiquées ci-dessus.", y, { apres: 8 });

  doc.text(`Fait à ${S.organisation.ville || ''}, le ${formatDateLongue(new Date().toISOString().slice(0, 10))}`, MARGE, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formateurNom, 195, y, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text('Document à conserver par le/la stagiaire. Aucun duplicata ne sera délivré', 105, y, { align: 'center' });

  return telechargerOuOuvrir(doc, nomFichierDoc('AFF', session, st), sansTelechargement);
}

// ============================================================================
// CERTIFICAT DE RÉALISATION — un document par stagiaire
// ============================================================================
function genererCertificatRealisation(session, participant, sansTelechargement) {
  const doc = new jsPDF();
  // Logo officiel du Ministère du Travail, en haut à gauche — modèle
  // réglementaire du Certificat de réalisation (arrêté du 21 décembre 2018).
  // Ne pas utiliser ce logo ailleurs (voir logo_gouvernement.js).
  try {
    const proprietesLogoGouv = doc.getImageProperties(LOGO_MINISTERE_TRAVAIL_BASE64);
    const largeurLogoGouv = 28;
    const hauteurLogoGouv = (proprietesLogoGouv.height / proprietesLogoGouv.width) * largeurLogoGouv;
    doc.addImage(LOGO_MINISTERE_TRAVAIL_BASE64, 'PNG', MARGE, 10, largeurLogoGouv, hauteurLogoGouv);
  } catch (e) { /* logo illisible — le document reste généré sans lui */ }
  ajouterLogoEnTete(doc);
  const f = session.formations_catalogue;
  const st = participant.stagiaires;
  const client = participant.clients || session.clients;
  let y = 42;

  y = titre(doc, 'CERTIFICAT DE REALISATION', y);
  y += 5;

  y = paragraphe(doc, `Je soussigné ${S.organisation.representant_nom || ''}`, y, { apres: 2 });
  y = paragraphe(doc,
    "représentant légal du dispensateur de l'action concourant au développement des compétences " +
    `(raison sociale du dispensateur de formation ou de l'employeur en cas de formation interne) ` +
    `${S.organisation.raison_sociale}, enregistrée sous le numéro de déclaration d'activité ${S.organisation.numero_declaration_activite || ''}`,
    y, { taille: 9.5, apres: 5 });

  y = paragraphe(doc, 'atteste que :', y, { apres: 3 });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(`${st.civilite || ''} ${st.nom} ${st.prenom}`.trim(), MARGE, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  if (client) { doc.text(`salarié(e) de l'entreprise ${client.raison_sociale}${client_ville_txt(client)}`, MARGE, y); y += 7; }
  y = paragraphe(doc, `a suivi l'action ${f?.denomination || ''}`, y, { apres: 6 });

  y = paragraphe(doc, "Nature de l'action concourant au développement des compétences :", y, { apres: 2 });
  y = paragraphe(doc, ' X    action de formation', y, { apres: 1, taille: 10 });
  y = paragraphe(doc, '      bilan de compétences', y, { apres: 1, taille: 10 });
  y = paragraphe(doc, "      action de VAE", y, { apres: 1, taille: 10 });
  y = paragraphe(doc, "      action de formation par apprentissage", y, { apres: 6, taille: 10 });

  y = paragraphe(doc,
    `qui s'est déroulée ${formatPlageDatesLongue(session.date_debut, session.date_fin) === formatDateLongue(session.date_debut) ? 'le ' + formatDateLongue(session.date_debut) : formatPlageDatesLongue(session.date_debut, session.date_fin)} pour une durée de ${f?.duree_heures || ''} heures`,
    y, { apres: 8 });

  y = paragraphe(doc,
    "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver " +
    "l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans " +
    "à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens la durée de " +
    'conservation est étendue conformément aux obligations conventionnelles spécifiques.',
    y, { taille: 9.5, apres: 12 });

  doc.text(`Fait à : ${S.organisation.ville || ''}`, MARGE, y);
  doc.text('Cachet et signature', 195, y, { align: 'right' }); y += 5;
  doc.text(`Le : ${formatDateLongue(new Date().toISOString().slice(0, 10))}`, MARGE, y);
  doc.text('du responsable du dispensateur de formation', 195, y, { align: 'right' });
  ajouterSignatureEtTampon(doc, 195, y + 3);
  y += 30;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  y = paragraphe(doc,
    "1 Lorsque l'action est mise en œuvre dans le cadre d'un projet de transition professionnelle, le certificat de " +
    'réalisation doit être transmis mensuellement.', y, { taille: 7.5 });

  return telechargerOuOuvrir(doc, nomFichierDoc('Certificat de realisation', session, st, client?.raison_sociale), sansTelechargement);
}

function client_ville_txt(client) {
  return client.ville ? ' à ' + client.ville : '';
}

// ============================================================================
// CONVENTION DE FORMATION PROFESSIONNELLE — un document PAR CLIENT de la
// session (une session peut réunir plusieurs entreprises clientes, chacune
// avec son propre tarif et sa propre Convention — voir session_clients).
// clientEntry : ligne de session_clients ({ client_id, clients:{raison_
// sociale, ville}, prix_unitaire, numero_devis }) pour laquelle générer la
// Convention. Si absent (compatibilité), on retombe sur l'ancien modèle à
// client unique (session.clients / session.prix_unitaire) et tous les
// participants.
// ============================================================================
function genererConvention(session, participants, sansTelechargement, clientEntry) {
  const doc = new jsPDF();
  ajouterLogoEnTete(doc);
  const f = session.formations_catalogue;
  const client = clientEntry ? clientEntry.clients : session.clients;
  const prixClient = clientEntry ? clientEntry.prix_unitaire : session.prix_unitaire;
  const participantsClient = clientEntry
    ? (participants || []).filter(p => p.client_id === clientEntry.client_id)
    : (participants || []);
  let y = 18;

  y = titre(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE', y);
  y = sousTitre(doc, 'Article L.6353-1 du Code du travail', y);

  y = paragraphe(doc, 'Entre les soussignés :', y, { apres: 4 });
  y = paragraphe(doc,
    `La ${S.organisation.raison_sociale}, domiciliée à ${S.organisation.ville || ''}, enregistrée sous le numéro de ` +
    `déclaration d'activité ${S.organisation.numero_declaration_activite || ''} auprès de la préfecture compétente,`, y, { apres: 3 });
  y = paragraphe(doc, 'et', y, { apres: 3 });
  y = paragraphe(doc,
    `${client?.raison_sociale || '[Client à préciser]'} domiciliée à ${client?.ville || ''} est conclue la convention suivante, ` +
    "en application des dispositions du Livre III de la Sixième partie du code du travail portant organisation de la formation professionnelle continue.",
    y, { apres: 6 });

  y = paragraphe(doc, 'Article 1er : Objet de la convention', y, { gras: true, apres: 2 });
  y = paragraphe(doc, `L'organisme ${S.organisation.raison_sociale} organisera l'action de formation suivante :`, y, { apres: 4 });

  y = paragraphe(doc, `- Intitulé : ${f?.denomination || ''}`, y, { apres: 3 });
  y = paragraphe(doc, '- Objectifs :', y, { apres: 1 });
  y = paragraphe(doc, f?.objectifs || '', y, { apres: 3 });
  y = paragraphe(doc, '- Programme, méthodes :', y, { apres: 1 });
  y = paragraphe(doc, f?.programme_methode || '', y, { apres: 3 });
  y = paragraphe(doc, `- Évaluation : ${f?.evaluation || ''}`, y, { apres: 3 });
  y = paragraphe(doc, "- Type d'action de formation (article L.6313-1 du code du travail) :", y, { apres: 1 });
  y = paragraphe(doc, "formation faisant l'objet d'une attestation dont le titulaire peut se prévaloir.", y, { apres: 4 });
  y = paragraphe(doc, `- Date(s) : ${formatPlageDatesLongue(session.date_debut, session.date_fin)}`, y, { apres: 4 });
  y = paragraphe(doc, `- Durée : ${f?.duree_heures || ''} heures`, y, { apres: 4 });

  const horaires = (session.horaires && session.horaires[0]) || {};
  const adresse = [session.lieu, session.adresse, [session.code_postal, session.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  y = paragraphe(doc, `- Horaires : ${horaires.debut || '—'} à ${horaires.pause_debut || '—'} et de ${horaires.pause_fin || '—'} à ${horaires.fin || '—'}     - Lieu : ${adresse}`, y, { apres: 4 });

  if (f?.conditions_realisation?.length) {
    y = paragraphe(doc, '- Condition de réalisation :', y, { apres: 1 });
    f.conditions_realisation.forEach(c => { y = paragraphe(doc, '- ' + c, y, { apres: 1 }); });
  }

  y += 4;
  y = paragraphe(doc, 'Article 2 : Effectif formé', y, { gras: true, apres: 2 });
  y = paragraphe(doc, `L'organisme ${S.organisation.raison_sociale} formera les personnes suivantes : voir liste en annexe`, y, { apres: 6 });

  y = paragraphe(doc, 'Article 3 : Dispositions financières', y, { gras: true, apres: 2 });
  y = paragraphe(doc, `En contrepartie de cette action de formation, l'employeur s'acquittera des coûts suivants :`, y, { apres: 3 });
  y = paragraphe(doc, `Coût total TTC : ${prixClient != null ? prixClient + ' €' : 'à préciser'} Net de taxe (TVA non applicable)`, y, { apres: 6 });

  y = paragraphe(doc, 'Article 4 : Modalités de règlement', y, { gras: true, apres: 2 });
  y = paragraphe(doc, 'Le paiement sera dû à réception de la facture.', y, { apres: 6 });

  doc.addPage(); y = 20;
  y = paragraphe(doc, 'Article 5 : Dédit ou abandon', y, { gras: true, apres: 2 });
  y = paragraphe(doc,
    "En cas de dédit par l'entreprise à moins de 30 jours francs avant le début de l'action mentionnée à l'article 1, " +
    "ou d'abandon, en cours de formation par un ou plusieurs stagiaires, une facture sera adressée représentant 100% de la convention.",
    y, { apres: 6 });

  y = paragraphe(doc, 'Article 6 : Différends éventuels', y, { gras: true, apres: 2 });
  y = paragraphe(doc,
    "Si une contestation ou un différend ne peuvent être réglés à l'amiable, le tribunal compétent du ressort de " +
    `${S.organisation.ville || "l'organisme"} sera seul compétent pour régler le litige.`, y, { apres: 6 });

  y = paragraphe(doc, 'Article 7 : Règlement Intérieur de Formation', y, { gras: true, apres: 2 });
  y = paragraphe(doc,
    `Les stagiaires s'engagent à respecter le Règlement Intérieur de Formation de ${S.organisation.raison_sociale} valable ` +
    "pour la durée de la prestation de formation. Ce règlement ne peut cependant pas se substituer à celui de l'entreprise " +
    'cliente qui prévaut en cas de différend.' + (S.organisation.site_web ? ` Il est consultable à l'adresse : ${S.organisation.site_web}` : ''),
    y, { apres: 6 });

  y = paragraphe(doc, 'Article 8 : Convocation des stagiaires', y, { gras: true, apres: 2 });
  y = paragraphe(doc,
    `L'entreprise s'engage à signifier à ${S.organisation.raison_sociale} les moyens mis en œuvre pour transmettre les convocations aux stagiaires.`,
    y, { apres: 12 });

  y = paragraphe(doc, `Fait en double exemplaire, à ${client?.ville || S.organisation.ville || ''}, le ${formatDateLongue(new Date().toISOString().slice(0, 10))}`, y, { apres: 10 });
  doc.text("Pour l'entreprise", MARGE, y);
  doc.text("Pour l'organisme", 195, y, { align: 'right' }); y += 5;
  doc.setFontSize(8.5);
  doc.text('(nom et qualité du signataire)', MARGE, y);
  doc.text('(nom et qualité du signataire)', 195, y, { align: 'right' });
  ajouterSignatureEtTampon(doc, 195, y + 3);
  y += 30;
  doc.setFontSize(10.5).setFont('helvetica', 'bold');
  doc.text(`${S.organisation.representant_nom || ''}${S.organisation.representant_qualite ? ', ' + S.organisation.representant_qualite : ''}`, 195, y, { align: 'right' });

  // Annexe : liste des stagiaires (uniquement ceux rattachés à ce client)
  if (participantsClient.length) {
    doc.addPage();
    let yy = titre(doc, 'ANNEXE — LISTE DES STAGIAIRES', 20);
    doc.autoTable({
      startY: yy + 4,
      head: [['Nom', 'Prénom', 'Date de naissance']],
      body: participantsClient.map(p => [p.stagiaires?.nom || '', p.stagiaires?.prenom || '', p.stagiaires?.date_naissance ? formatDateLongue(p.stagiaires.date_naissance) : '']),
      headStyles: { fillColor: [10, 92, 138] },
      styles: { fontSize: 10 },
    });
  }

  return telechargerOuOuvrir(doc, nomFichierDoc('Convention', session, null, client?.raison_sociale), sansTelechargement);
}

// ============================================================================
// FEUILLE D'ÉMARGEMENT — un document par session
// ⚠️ Pas d'exemple exploitable dans le classeur (version scannée uniquement) :
// mise en page originale, à valider/ajuster avec Jérémy.
// ============================================================================
function genererFeuillePresence(session, participants, sansTelechargement) {
  const doc = new jsPDF({ orientation: 'landscape' });
  ajouterLogoEnTete(doc);
  const f = session.formations_catalogue;
  let y = 18;

  // Chaque stagiaire affiche sa propre entreprise (une session peut réunir
  // plusieurs clients) ; l'en-tête liste les entreprises distinctes.
  const nomsClients = Array.from(new Set((participants || []).map(p => p.clients?.raison_sociale).filter(Boolean)));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text("FEUILLE D'ÉMARGEMENT", 148, y, { align: 'center' }); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${f?.denomination || ''} — ${formatPlageDatesLongue(session.date_debut, session.date_fin)} — ${session.lieu || ''}${nomsClients.length ? ' — ' + nomsClients.join(', ') : ''}`, 148, y, { align: 'center' });
  y += 10;

  doc.autoTable({
    startY: y,
    head: [['Nom', 'Prénom', 'Entreprise', 'Signature matin', 'Signature après-midi']],
    body: (participants || []).map(p => [p.stagiaires?.nom || '', p.stagiaires?.prenom || '', p.clients?.raison_sociale || '', '', '']),
    styles: { fontSize: 11, cellPadding: 4, minCellHeight: 14 },
    headStyles: { fillColor: [10, 92, 138] },
  });

  return telechargerOuOuvrir(doc, nomFichierDoc('Feuille de presence', session, null), sansTelechargement);
}

// ============================================================================
// RÉCAPITULATIF BPF — aide interne au remplissage du Bilan Pédagogique et
// Financier officiel (CERFA 10443*17, monactiviteformation.emploi.gouv.fr).
// Ce n'est pas le formulaire officiel : une mise en forme propre à l'appli,
// à vérifier avant de reporter les chiffres sur le site du gouvernement.
// Les données (donnees) sont calculées dans bpf.js.
// ============================================================================
function genererDocumentBPF(exercice, donnees) {
  const doc = new jsPDF();
  ajouterLogoEnTete(doc);
  let y = 18;

  y = titre(doc, 'RÉCAPITULATIF — BILAN PÉDAGOGIQUE ET FINANCIER', y);
  y = sousTitre(doc, `Exercice du ${formatDateLongue(exercice.debut)} au ${formatDateLongue(exercice.fin)} — document d'aide, à reporter sur monactiviteformation.emploi.gouv.fr`, y);

  doc.autoTable({
    startY: y + 2,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    body: [
      ['Organisme', S.organisation.raison_sociale || ''],
      ["N° de déclaration d'activité", S.organisation.numero_declaration_activite || ''],
      ['SIRET', S.organisation.siret || ''],
      ['Code NAF', S.organisation.code_naf || ''],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  y = paragraphe(doc, `B. Formation en tout ou partie à distance mise en œuvre sur l'exercice : ${donnees.formationADistance ? 'Oui' : 'Non'}`, y, { gras: true, apres: 6 });

  y = paragraphe(doc, 'C. Produits par origine de financement (hors taxes)', y, { gras: true, apres: 2 });
  doc.autoTable({
    startY: y,
    head: [['Origine', 'Montant']],
    body: Object.entries(donnees.produitsParOrigine).map(([o, m]) => [libelleOrigineFinancement(o), m.toFixed(2) + ' €']),
    foot: [['TOTAL', donnees.totalProduits.toFixed(2) + ' €']],
    styles: { fontSize: 9.5, cellPadding: 2 },
    headStyles: { fillColor: [10, 92, 138] },
    footStyles: { fillColor: [230, 230, 230], textColor: [20, 20, 20], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  if (y > 230) { doc.addPage(); y = 20; }
  y = paragraphe(doc, "D. Charges de l'organisme (hors taxes)", y, { gras: true, apres: 2 });
  doc.autoTable({
    startY: y,
    body: [
      ['Salaires des formateurs (internes)', donnees.salairesFormateurs.toFixed(2) + ' €'],
      ['Achats de prestation de formation et honoraires (externes)', donnees.achatsPrestationFormation.toFixed(2) + ' €'],
      ['Autres charges (saisies manuellement)', donnees.autresCharges.toFixed(2) + ' €'],
    ],
    foot: [['TOTAL DES CHARGES', donnees.totalCharges.toFixed(2) + ' €']],
    styles: { fontSize: 9.5, cellPadding: 2 },
    footStyles: { fillColor: [230, 230, 230], textColor: [20, 20, 20], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  y = paragraphe(doc, 'E. Personnes dispensant des heures de formation', y, { gras: true, apres: 2 });
  doc.autoTable({
    startY: y,
    head: [['', 'Nombre', 'Heures dispensées']],
    body: [
      ["De l'organisme", donnees.formateursInternes, donnees.heuresFormateursInternes],
      ['Extérieures (sous-traitance)', donnees.formateursExternes, donnees.heuresFormateursExternes],
    ],
    styles: { fontSize: 9.5, cellPadding: 2 },
    headStyles: { fillColor: [10, 92, 138] },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 40 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  if (y > 230) { doc.addPage(); y = 20; }

  y = paragraphe(doc, 'F. Stagiaires (hors sous-traitance reçue)', y, { gras: true, apres: 2 });
  doc.autoTable({
    startY: y,
    head: [['Type de stagiaire', 'Stagiaires', 'Heures suivies']],
    body: [
      ["Salariés d'employeurs privés", donnees.f1.a.nb, donnees.f1.a.heures],
      ['Apprentis', donnees.f1.b.nb, donnees.f1.b.heures],
      ["Personnes en recherche d'emploi", donnees.f1.c.nb, donnees.f1.c.heures],
      ['Particuliers à leurs frais', donnees.f1.d.nb, donnees.f1.d.heures],
      ['Autres stagiaires', donnees.f1.e.nb, donnees.f1.e.heures],
    ],
    foot: [['TOTAL', donnees.totalStagiairesF, donnees.totalHeuresF]],
    styles: { fontSize: 9.5, cellPadding: 2 },
    headStyles: { fillColor: [10, 92, 138] },
    footStyles: { fillColor: [230, 230, 230], textColor: [20, 20, 20], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 40 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  const specialites = Object.entries(donnees.specialites).sort((a, b) => b[1].nb - a[1].nb).slice(0, 5);
  if (specialites.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    y = paragraphe(doc, 'Principales spécialités de formation', y, { gras: true, taille: 10, apres: 2 });
    doc.autoTable({
      startY: y,
      head: [['Spécialité', 'Stagiaires', 'Heures']],
      body: specialites.map(([lib, v]) => [lib, v.nb, v.heures]),
      styles: { fontSize: 9.5, cellPadding: 2 },
      headStyles: { fillColor: [10, 92, 138] },
      columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 40 } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  if (y > 250) { doc.addPage(); y = 20; }
  y = paragraphe(doc, 'G. Stagiaires dont la formation a été confiée par un autre organisme', y, { gras: true, apres: 2 });
  y = paragraphe(doc, `${donnees.stagiairesG} stagiaire(s) — ${donnees.heuresG} heure(s) suivies.`, y, { apres: 8 });

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  y = paragraphe(doc,
    "Document généré automatiquement à partir des sessions enregistrées dans l'application. Il ne remplace pas la déclaration officielle du Bilan " +
    "Pédagogique et Financier, à effectuer avant le 30 avril sur monactiviteformation.emploi.gouv.fr. Le cadre D (charges) est calculé à partir des " +
    "heures et des taux horaires renseignés sur les formateurs, complété des \"autres charges\" saisies à la main — à vérifier. La part du chiffre " +
    "d'affaires réalisée en formation professionnelle et les catégories approximées (type de stagiaire, spécialités) restent également à vérifier avant de reporter ces chiffres." +
    (donnees.formateursSansTauxHoraire ? " Au moins un formateur n'a pas de taux horaire renseigné : son coût n'est pas inclus dans le cadre D ci-dessus." : ""),
    y, { taille: 8 });

  telechargerOuOuvrir(doc, `BPF - ${exercice.debut} au ${exercice.fin} - ${S.organisation.raison_sociale}.pdf`.replace(/[/\\?%*:|"<>]+/g, '').replace(/\s+/g, ' '));
}
