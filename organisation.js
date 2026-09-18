// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// organisation.js — écran Organisme : coordonnées, exercice comptable, SMTP,
// et identité visuelle (logo, signature, tampon — bucket Storage public
// "identite-visuelle"). Le logo/la signature/le tampon sont utilisés à la
// fois dans l'appli (en-tête) et sur les documents PDF générés (pdf.js lit
// S.organisation.logo_url / signature_url / tampon_url, préchargés en base64
// par chargerImagesIdentite() dans core.js).

async function ecranOrganisation(vue) {
  const org = S.organisation;
  vue.innerHTML = `
    <div class="carte"><h2 style="margin:0;">Organisme</h2></div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Identité visuelle</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 10px;">Utilisés dans l'appli et automatiquement insérés sur les documents PDF (Convention, Convocation, Certificat…).</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        ${blocImage('logo', 'Logo', org.logo_url)}
        ${blocImage('signature', 'Signature du représentant', org.signature_url)}
        ${blocImage('tampon', 'Tampon / cachet', org.tampon_url)}
      </div>
    </div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Coordonnées</h3>
      <label for="og-raison">Raison sociale</label>
      <input id="og-raison" value="${esc(org.raison_sociale)}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-forme">Forme juridique</label><input id="og-forme" value="${esc(org.forme_juridique)}"></div>
        <div style="flex:1;"><label for="og-siret">SIRET</label><input id="og-siret" value="${esc(org.siret)}"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-naf">Code NAF</label><input id="og-naf" value="${esc(org.code_naf)}"></div>
        <div style="flex:1;"><label for="og-decl">N° de déclaration d'activité</label><input id="og-decl" value="${esc(org.numero_declaration_activite)}"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-rcs">RCS</label><input id="og-rcs" value="${esc(org.rcs)}"></div>
        <div style="flex:1;"><label for="og-tva">N° TVA intracommunautaire</label><input id="og-tva" value="${esc(org.tva_intracommunautaire)}"></div>
      </div>
      <label for="og-adresse">Adresse</label>
      <input id="og-adresse" value="${esc(org.adresse)}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-cp">Code postal</label><input id="og-cp" value="${esc(org.code_postal)}"></div>
        <div style="flex:2;"><label for="og-ville">Ville</label><input id="og-ville" value="${esc(org.ville)}"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-tel">Téléphone</label><input id="og-tel" value="${esc(org.telephone)}"></div>
        <div style="flex:1;"><label for="og-email">Email de contact</label><input id="og-email" value="${esc(org.email_contact)}"></div>
      </div>
      <label for="og-site">Site web</label>
      <input id="og-site" value="${esc(org.site_web)}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-repnom">Nom du représentant (signataire)</label><input id="og-repnom" value="${esc(org.representant_nom)}"></div>
        <div style="flex:1;"><label for="og-repqual">Qualité</label><input id="og-repqual" value="${esc(org.representant_qualite)}"></div>
      </div>
      <label for="og-pied">Texte du pied de page des documents PDF (facultatif, sinon généré automatiquement)</label>
      <textarea id="og-pied" rows="2">${esc(org.pied_de_page_documents)}</textarea>
      <button class="bouton" style="margin-top:12px;" id="og-valider-coordonnees">Enregistrer</button>
      <div class="erreur" id="og-erreur-coordonnees"></div>
    </div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Exercice comptable (pour le BPF et le numéro de session)</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 10px;">Date de début de l'exercice — 1er janvier par défaut. Ex. Prévisecours : 1er avril.</p>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-exjour">Jour</label><input id="og-exjour" type="number" min="1" max="31" value="${org.exercice_jour_debut}"></div>
        <div style="flex:1;"><label for="og-exmois">Mois</label><input id="og-exmois" type="number" min="1" max="12" value="${org.exercice_mois_debut}"></div>
      </div>
      <button class="bouton" style="margin-top:12px;" id="og-valider-exercice">Enregistrer</button>
      <div class="erreur" id="og-erreur-exercice"></div>
    </div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Outils</h3>
      <label style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="og-assignation-rapide" style="width:auto;" ${org.assignation_rapide_formateur_active !== false ? 'checked' : ''}>
        <span>Afficher l'assignation rapide de formateur sur l'écran Sessions</span>
      </label>
      <p style="font-size:12px;color:#55636c;margin:6px 0 0;">Barre qui permet d'assigner un formateur en une fois à toutes les sessions qui n'en ont pas (avec filtre de dates optionnel) — utile pour rattraper un import, à désactiver une fois le rattrapage terminé.</p>
      <button class="bouton" style="margin-top:12px;" id="og-valider-outils">Enregistrer</button>
      <div class="erreur" id="og-erreur-outils"></div>
    </div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Envoi d'email (SMTP)</h3>
      <p style="font-size:12px;color:#55636c;margin:0 0 10px;">Utilisé pour l'envoi des documents au client depuis le détail d'une session.</p>
      <div style="display:flex;gap:10px;">
        <div style="flex:2;"><label for="og-smtp-host">Serveur SMTP</label><input id="og-smtp-host" value="${esc(org.smtp_host)}"></div>
        <div style="flex:1;"><label for="og-smtp-port">Port</label><input id="og-smtp-port" type="number" value="${org.smtp_port ?? 587}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="og-smtp-secure" style="width:auto;" ${org.smtp_secure !== false ? 'checked' : ''}>
        <span>Connexion sécurisée (TLS)</span>
      </label>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-smtp-user">Identifiant</label><input id="og-smtp-user" value="${esc(org.smtp_user)}"></div>
        <div style="flex:1;"><label for="og-smtp-pass">Mot de passe</label><input id="og-smtp-pass" type="password" value="${esc(org.smtp_password)}"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="og-smtp-fromemail">Email d'expédition</label><input id="og-smtp-fromemail" value="${esc(org.smtp_from_email)}"></div>
        <div style="flex:1;"><label for="og-smtp-fromnom">Nom d'expédition</label><input id="og-smtp-fromnom" value="${esc(org.smtp_from_name)}"></div>
      </div>
      <button class="bouton" style="margin-top:12px;" id="og-valider-smtp">Enregistrer</button>
      <div class="erreur" id="og-erreur-smtp"></div>
    </div>`;

  ['logo', 'signature', 'tampon'].forEach(cle => {
    const input = $('#og-fichier-' + cle);
    if (input) input.onchange = (e) => televerserImageIdentite(cle, e.target.files[0]);
  });

  $('#og-valider-coordonnees').onclick = () => enregistrerOrganisation({
    raison_sociale: $('#og-raison').value.trim(),
    forme_juridique: $('#og-forme').value.trim() || null,
    siret: $('#og-siret').value.trim() || null,
    code_naf: $('#og-naf').value.trim() || null,
    numero_declaration_activite: $('#og-decl').value.trim() || null,
    rcs: $('#og-rcs').value.trim() || null,
    tva_intracommunautaire: $('#og-tva').value.trim() || null,
    adresse: $('#og-adresse').value.trim() || null,
    code_postal: $('#og-cp').value.trim() || null,
    ville: $('#og-ville').value.trim() || null,
    telephone: $('#og-tel').value.trim() || null,
    email_contact: $('#og-email').value.trim() || null,
    site_web: $('#og-site').value.trim() || null,
    representant_nom: $('#og-repnom').value.trim() || null,
    representant_qualite: $('#og-repqual').value.trim() || null,
    pied_de_page_documents: $('#og-pied').value.trim() || null,
  }, 'og-erreur-coordonnees');

  $('#og-valider-exercice').onclick = () => enregistrerOrganisation({
    exercice_jour_debut: Number($('#og-exjour').value) || 1,
    exercice_mois_debut: Number($('#og-exmois').value) || 1,
  }, 'og-erreur-exercice');

  $('#og-valider-outils').onclick = () => enregistrerOrganisation({
    assignation_rapide_formateur_active: $('#og-assignation-rapide').checked,
  }, 'og-erreur-outils');

  $('#og-valider-smtp').onclick = () => enregistrerOrganisation({
    smtp_host: $('#og-smtp-host').value.trim() || null,
    smtp_port: Number($('#og-smtp-port').value) || 587,
    smtp_secure: $('#og-smtp-secure').checked,
    smtp_user: $('#og-smtp-user').value.trim() || null,
    smtp_password: $('#og-smtp-pass').value || null,
    smtp_from_email: $('#og-smtp-fromemail').value.trim() || null,
    smtp_from_name: $('#og-smtp-fromnom').value.trim() || null,
  }, 'og-erreur-smtp');
}

function blocImage(cle, libelle, url) {
  return `
    <div style="text-align:center;">
      <p style="font-size:12px;color:#55636c;margin:0 0 6px;">${esc(libelle)}</p>
      <div style="width:140px;height:100px;border:1px solid #d7dee3;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#fafbfc;overflow:hidden;">
        ${url ? `<img src="${esc(url)}" style="max-width:100%;max-height:100%;">` : '<span style="font-size:11px;color:#aaa;">Aucune image</span>'}
      </div>
      <label class="bouton" style="display:inline-block;margin-top:6px;padding:5px 10px;font-size:12px;background:#eee;color:#333;cursor:pointer;">
        Choisir un fichier
        <input type="file" id="og-fichier-${cle}" accept="image/png,image/jpeg" style="display:none;">
      </label>
    </div>`;
}

async function televerserImageIdentite(cle, fichier) {
  if (!fichier) return;
  const extension = (fichier.name.split('.').pop() || 'png').toLowerCase();
  const chemin = `${S.organisation.id}/${cle}.${extension}`;

  const { error: uploadErr } = await supa.storage.from('identite-visuelle').upload(chemin, fichier, { upsert: true });
  if (uploadErr) { DEBUG.erreur('televerserImageIdentite', uploadErr); toast('Erreur : ' + uploadErr.message, 'erreur'); return; }

  const { data: urlPublique } = supa.storage.from('identite-visuelle').getPublicUrl(chemin);
  const colonne = { logo: 'logo_url', signature: 'signature_url', tampon: 'tampon_url' }[cle];
  const { error: majErr } = await supa.from('organisations').update({ [colonne]: urlPublique.publicUrl }).eq('id', S.organisation.id);
  if (majErr) { DEBUG.erreur('majImageIdentite', majErr); toast('Erreur : ' + majErr.message, 'erreur'); return; }

  S.organisation[colonne] = urlPublique.publicUrl;
  toast('Image mise à jour.');
  if (typeof chargerImagesIdentite === 'function') await chargerImagesIdentite();
  if (typeof appliquerIdentiteVisuelle === 'function') appliquerIdentiteVisuelle();
  ecranOrganisation($('#vue'));
}

async function enregistrerOrganisation(payload, idErreur) {
  $('#' + idErreur).textContent = '';
  const { error } = await supa.from('organisations').update(payload).eq('id', S.organisation.id);
  if (error) { DEBUG.erreur('enregistrerOrganisation', error); $('#' + idErreur).textContent = 'Erreur : ' + error.message; return; }
  Object.assign(S.organisation, payload);
  toast('Organisme mis à jour.');
}
