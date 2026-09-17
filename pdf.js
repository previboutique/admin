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

function telechargerOuOuvrir(doc, nomFichier) {
  ajouterPiedDePage(doc);
  doc.save(nomFichier);
}

function nomFichierDoc(prefixe, session, stagiaire) {
  const date = session.date_debut;
  const client = (session.clients?.raison_sociale || '').replace(/[^\w-]+/g, '');
  const nom = stagiaire ? (stagiaire.prenom + ' ' + stagiaire.nom).replace(/[^\w-]+/g, '') : '';
  return `${date} - ${prefixe}${nom ? ' - ' + nom : ''}${client ? ' - ' + client : ''}.pdf`.replace(/\s+/g, ' ');
}

// ============================================================================
// CONVOCATION — un document par stagiaire
// ============================================================================
function genererConvocation(session, participant) {
  const doc = new jsPDF();
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

  telechargerOuOuvrir(doc, nomFichierDoc('Convocation', session, st));
}

// ============================================================================
// ATTESTATION DE FIN DE FORMATION (AFF) — un document par stagiaire
// ============================================================================
function genererAFF(session, participant) {
  const doc = new jsPDF();
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

  telechargerOuOuvrir(doc, nomFichierDoc('AFF', session, st));
}

// ============================================================================
// CERTIFICAT DE RÉALISATION — un document par stagiaire
// ============================================================================
function genererCertificatRealisation(session, participant) {
  const doc = new jsPDF();
  const f = session.formations_catalogue;
  const st = participant.stagiaires;
  const client = session.clients;
  let y = 20;

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
  doc.text('du responsable du dispensateur de formation', 195, y, { align: 'right' }); y += 15;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  y = paragraphe(doc,
    "1 Lorsque l'action est mise en œuvre dans le cadre d'un projet de transition professionnelle, le certificat de " +
    'réalisation doit être transmis mensuellement.', y, { taille: 7.5 });

  telechargerOuOuvrir(doc, nomFichierDoc('Certificat de realisation', session, st));
}

function client_ville_txt(client) {
  return client.ville ? ' à ' + client.ville : '';
}

// ============================================================================
// CONVENTION DE FORMATION PROFESSIONNELLE — un document par session
// ============================================================================
function genererConvention(session, participants) {
  const doc = new jsPDF();
  const f = session.formations_catalogue;
  const client = session.clients;
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
  y = paragraphe(doc, `Coût total TTC : ${session.prix_unitaire != null ? session.prix_unitaire + ' €' : 'à préciser'} Net de taxe (TVA non applicable)`, y, { apres: 6 });

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
  doc.text('(nom et qualité du signataire)', 195, y, { align: 'right' }); y += 15;
  doc.setFontSize(10.5).setFont('helvetica', 'bold');
  doc.text(`${S.organisation.representant_nom || ''}${S.organisation.representant_qualite ? ', ' + S.organisation.representant_qualite : ''}`, 195, y, { align: 'right' });

  // Annexe : liste des stagiaires
  if (participants && participants.length) {
    doc.addPage();
    let yy = titre(doc, 'ANNEXE — LISTE DES STAGIAIRES', 20);
    doc.autoTable({
      startY: yy + 4,
      head: [['Nom', 'Prénom', 'Date de naissance']],
      body: participants.map(p => [p.stagiaires?.nom || '', p.stagiaires?.prenom || '', p.stagiaires?.date_naissance ? formatDateLongue(p.stagiaires.date_naissance) : '']),
      headStyles: { fillColor: [10, 92, 138] },
      styles: { fontSize: 10 },
    });
  }

  telechargerOuOuvrir(doc, nomFichierDoc('Convention', session, null));
}

// ============================================================================
// FEUILLE D'ÉMARGEMENT — un document par session
// ⚠️ Pas d'exemple exploitable dans le classeur (version scannée uniquement) :
// mise en page originale, à valider/ajuster avec Jérémy.
// ============================================================================
function genererFeuillePresence(session, participants) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const f = session.formations_catalogue;
  let y = 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text("FEUILLE D'ÉMARGEMENT", 148, y, { align: 'center' }); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${f?.denomination || ''} — ${formatPlageDatesLongue(session.date_debut, session.date_fin)} — ${session.lieu || ''}${session.clients ? ' — ' + session.clients.raison_sociale : ''}`, 148, y, { align: 'center' });
  y += 10;

  doc.autoTable({
    startY: y,
    head: [['Nom', 'Prénom', 'Entreprise', 'Signature matin', 'Signature après-midi']],
    body: (participants || []).map(p => [p.stagiaires?.nom || '', p.stagiaires?.prenom || '', session.clients?.raison_sociale || '', '', '']),
    styles: { fontSize: 11, cellPadding: 4, minCellHeight: 14 },
    headStyles: { fillColor: [10, 92, 138] },
  });

  telechargerOuOuvrir(doc, nomFichierDoc('Feuille de presence', session, null));
}
