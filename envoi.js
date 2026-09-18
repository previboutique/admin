// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// envoi.js — sélection de documents dans le détail d'une session, pour un
// téléchargement groupé (ZIP, via JSZip) ou un envoi par email au client
// (Edge Function Supabase "envoyer-documents", SMTP propre à l'organisation).
// S'appuie sur les fonctions de génération PDF de pdf.js (appelées avec
// sansTelechargement=true pour ne pas déclencher de téléchargement individuel).

// Construit la liste des documents disponibles pour la session courante :
// les documents "collectifs" (Convention, Feuille d'émargement) puis, pour
// chaque stagiaire inscrit, ses documents individuels (Convocation, AFF,
// Certificat de réalisation).
function documentsDisponibles(session, participants) {
  const liste = [
    { cle: 'convention', libelle: 'Convention de formation', type: 'convention', participant: null,
      genere: (sans) => genererConvention(session, participants, sans) },
    { cle: 'feuille_presence', libelle: "Feuille d'émargement", type: 'feuille_presence', participant: null,
      genere: (sans) => genererFeuillePresence(session, participants, sans) },
  ];

  (participants || []).forEach(p => {
    const nomStagiaire = `${p.stagiaires?.prenom || ''} ${p.stagiaires?.nom || ''}`.trim();
    liste.push(
      { cle: `convocation:${p.id}`, libelle: `Convocation — ${nomStagiaire}`, type: 'convocation', participant: p,
        genere: (sans) => genererConvocation(session, p, sans) },
      { cle: `aff:${p.id}`, libelle: `AFF — ${nomStagiaire}`, type: 'attestation_fin_formation', participant: p,
        genere: (sans) => genererAFF(session, p, sans) },
      { cle: `certificat:${p.id}`, libelle: `Certificat de réalisation — ${nomStagiaire}`, type: 'certificat_realisation', participant: p,
        genere: (sans) => genererCertificatRealisation(session, p, sans) },
    );
  });

  return liste;
}

// Affiche la carte de sélection (checkboxes + boutons ZIP / Envoyer) dans le
// détail de la session. Appelée depuis ouvrirSession() une fois les
// participants chargés.
function rendreSelectionDocuments(session, participants) {
  const zone = $('#selection-documents');
  if (!zone) return;

  const docs = documentsDisponibles(session, participants);
  const collectifs = docs.filter(d => !d.participant);
  const individuels = docs.filter(d => d.participant);

  const ligne = (d) => `
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;margin:4px 0;">
      <input type="checkbox" class="doc-checkbox" value="${d.cle}" style="width:auto;">
      ${esc(d.libelle)}
    </label>`;

  zone.innerHTML = `
    <div style="margin-bottom:10px;">
      <strong style="font-size:13px;color:#55636c;">Documents de la session</strong>
      ${collectifs.map(ligne).join('')}
    </div>
    <div style="margin-bottom:10px;">
      <strong style="font-size:13px;color:#55636c;">Documents par stagiaire</strong>
      ${individuels.length ? individuels.map(ligne).join('') : '<p style="font-size:13px;color:#55636c;">Aucun stagiaire inscrit.</p>'}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px solid #eee;padding-top:10px;">
      <button class="bouton" style="background:#eee;color:#333;font-size:13px;" onclick="toutCocherDocuments(true)">Tout cocher</button>
      <button class="bouton" style="background:#eee;color:#333;font-size:13px;" onclick="toutCocherDocuments(false)">Tout décocher</button>
      <span style="flex:1;"></span>
      <button class="bouton" style="font-size:13px;" onclick="telechargerSelectionZip()">Télécharger la sélection (ZIP)</button>
      ${PEUT_GERER_SESSIONS() ? '<button class="bouton" style="font-size:13px;" onclick="ouvrirPanneauEnvoi()">Envoyer au client</button>' : ''}
    </div>
    <div id="envoi-zone" style="margin-top:12px;"></div>`;
}

function toutCocherDocuments(coche) {
  document.querySelectorAll('.doc-checkbox').forEach(c => { c.checked = coche; });
}

// Lit les cases cochées et renvoie les descripteurs correspondants (parmi
// ceux construits pour la session courante).
function documentsSelectionnes() {
  const cles = Array.from(document.querySelectorAll('.doc-checkbox:checked')).map(c => c.value);
  const docs = documentsDisponibles(window.__sessionCourante, window.__participantsCourants);
  return docs.filter(d => cles.includes(d.cle));
}

// ============================================================================
// TÉLÉCHARGEMENT GROUPÉ (ZIP)
// ============================================================================
async function telechargerSelectionZip() {
  const selection = documentsSelectionnes();
  if (!selection.length) { toast('Sélectionne au moins un document.', 'erreur'); return; }
  if (typeof JSZip === 'undefined') { toast('Bibliothèque ZIP non chargée (JSZip manquant dans index.html).', 'erreur'); return; }

  const zip = new JSZip();
  selection.forEach(desc => {
    const { doc, nomFichier } = desc.genere(true);
    zip.file(nomFichier, doc.output('blob'));
  });

  const contenu = await zip.generateAsync({ type: 'blob' });
  const session = window.__sessionCourante;
  const nomZip = `Documents - ${session.formations_catalogue?.denomination || 'session'} - ${session.date_debut}.zip`.replace(/[/\\?%*:|"<>]+/g, '');

  const url = URL.createObjectURL(contenu);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomZip;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  toast(`${selection.length} document(s) téléchargé(s) dans le ZIP.`);
}

// ============================================================================
// ENVOI AU CLIENT (Storage + Edge Function "envoyer-documents")
// ============================================================================
async function ouvrirPanneauEnvoi() {
  const selection = documentsSelectionnes();
  if (!selection.length) { toast('Sélectionne au moins un document à envoyer.', 'erreur'); return; }

  const session = window.__sessionCourante;
  const { data: contacts } = await supa
    .from('contacts_client')
    .select('*')
    .eq('client_id', session.client_id)
    .order('contact_principal', { ascending: false });

  const zone = $('#envoi-zone');
  zone.innerHTML = `
    <div class="carte" style="border-color:#0a5c8a;background:#eef6fb;margin-bottom:0;">
      <h3 style="margin-top:0;">Envoyer ${selection.length} document(s) au client</h3>
      <label for="envoi-destinataire">Destinataire (email)</label>
      <input id="envoi-destinataire" list="envoi-contacts-liste" placeholder="email du destinataire">
      <datalist id="envoi-contacts-liste">
        ${(contacts || []).filter(c => c.email).map(c => `<option value="${esc(c.email)}">${esc(c.prenom || '')} ${esc(c.nom || '')}${c.fonction ? ' — ' + esc(c.fonction) : ''}</option>`).join('')}
      </datalist>

      <label for="envoi-destinataire-nom">Nom du destinataire (facultatif)</label>
      <input id="envoi-destinataire-nom" placeholder="ex. Responsable HSE">

      <label for="envoi-objet">Objet</label>
      <input id="envoi-objet" value="Documents de formation — ${esc(session.formations_catalogue?.denomination || '')}">

      <label for="envoi-corps">Message</label>
      <textarea id="envoi-corps" rows="5">Bonjour,

Veuillez trouver ci-joint les documents de la formation ${session.formations_catalogue?.denomination || ''} du ${formatDateFr(session.date_debut)}.

Cordialement,
${S.organisation.raison_sociale}</textarea>

      <div style="margin-top:10px;">
        <button class="bouton" id="envoi-valider">Envoyer</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#envoi-zone').innerHTML=''">Annuler</button>
      </div>
      <div class="erreur" id="envoi-erreur"></div>
    </div>`;

  $('#envoi-valider').onclick = () => envoyerDocumentsClient(selection);
}

async function envoyerDocumentsClient(selection) {
  const destinataire = $('#envoi-destinataire').value.trim();
  if (!destinataire) { $('#envoi-erreur').textContent = 'Indique un email destinataire.'; return; }

  const bouton = $('#envoi-valider');
  bouton.disabled = true;
  const texteInitial = bouton.textContent;
  bouton.textContent = 'Envoi en cours…';
  $('#envoi-erreur').textContent = '';

  const session = window.__sessionCourante;

  try {
    const documentIds = [];
    for (const desc of selection) {
      const { doc, nomFichier } = desc.genere(true);
      const blob = doc.output('blob');
      const chemin = `${S.organisation.id}/${session.id}/${Date.now()}_${nomFichier}`;

      const { error: uploadErr } = await supa.storage.from('documents').upload(chemin, blob, { contentType: 'application/pdf', upsert: true });
      if (uploadErr) throw new Error(`Envoi du fichier "${nomFichier}" : ${uploadErr.message}`);

      const { data: docRow, error: docErr } = await supa.from('documents_generes').insert({
        organisation_id: S.organisation.id,
        session_id: session.id,
        stagiaire_id: desc.participant ? desc.participant.stagiaire_id : null,
        client_id: session.client_id,
        type: desc.type,
        storage_path: chemin,
        genere_par: S.profil.id,
      }).select('id').single();
      if (docErr) throw new Error(`Traçabilité du document "${nomFichier}" : ${docErr.message}`);

      documentIds.push(docRow.id);
    }

    const { data: resultat, error: fnError } = await supa.functions.invoke('envoyer-documents', {
      body: {
        session_id: session.id,
        destinataire_email: destinataire,
        destinataire_nom: $('#envoi-destinataire-nom').value.trim() || null,
        objet: $('#envoi-objet').value,
        corps: $('#envoi-corps').value,
        document_ids: documentIds,
      },
    });

    if (fnError || resultat?.error) throw new Error(resultat?.error || fnError.message);

    toast('Documents envoyés au client.');
    $('#envoi-zone').innerHTML = '';
  } catch (e) {
    DEBUG.erreur('envoyerDocumentsClient', e);
    $('#envoi-erreur').textContent = 'Erreur : ' + e.message;
  } finally {
    bouton.disabled = false;
    bouton.textContent = texteInitial;
  }
}
