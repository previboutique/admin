// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// clients.js — écran Clients : liste, fiche (infos + contacts + statistiques
// AT/MP/jours ITT par année, reprises de l'onglet "Renseignement" du classeur
// Excel d'origine).

// typeFiltre : null (tous, écran "Clients") ou 'organisme_formation'
// (écran "Organismes sous-traitants" — voir ecranSousTraitants ci-dessous).
async function ecranClients(vue, typeFiltre) {
  window.__clientsTypeFiltre = typeFiltre || null;
  const estSousTraitants = typeFiltre === 'organisme_formation';

  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">${estSousTraitants ? 'Organismes sous-traitants' : 'Clients'}</h2>
      <div>
        ${!estSousTraitants ? `
        <button class="bouton" style="background:#eee;color:#333;" onclick="exporterClientsExcel()">Exporter (Excel)</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:6px;" onclick="$('#cl-import-fichier').click()">Importer les mises à jour (Excel)</button>
        <input type="file" id="cl-import-fichier" accept=".xlsx,.xls" style="display:none;">` : ''}
        <button class="bouton" style="margin-left:6px;" onclick="ouvrirFicheClient(null)">+ Nouveau ${estSousTraitants ? 'organisme' : 'client'}</button>
      </div>
    </div>
    ${estSousTraitants ? `
    <p style="font-size:12px;color:#55636c;margin:-6px 0 0;">
      Un organisme sous-traitant est un autre organisme de formation qui confie des sessions à réaliser (sous-traitance reçue — cadre G du BPF). Les sessions pour ces organismes se créent normalement dans l'onglet Sessions, avec cet organisme comme client.
    </p>` : `
    <p style="font-size:12px;color:#55636c;margin:-6px 0 0;">
      "Exporter" télécharge la fiche de tous les clients (utile après un import de sessions qui n'a créé que la raison sociale, pour compléter adresse/SIRET/etc. dans le fichier). "Importer les mises à jour" relit ce même fichier une fois complété : seules les cases remplies mettent à jour la fiche existante, une case vide ne remplace jamais une valeur déjà en base.
    </p>`}
    <div id="cl-import-resultat"></div>
    <div class="carte">
      <input id="cl-recherche" placeholder="Rechercher ${estSousTraitants ? 'un organisme' : 'un client'}…" style="margin-bottom:10px;">
      <div id="clients-liste">Chargement…</div>
    </div>
    <div id="client-fiche"></div>`;

  let requete = supa.from('clients').select('id, raison_sociale, ville, actif, type_client').order('raison_sociale');
  if (typeFiltre) requete = requete.eq('type_client', typeFiltre);
  const { data, error } = await requete;
  if (error) { DEBUG.erreur('ecranClients', error); $('#clients-liste').textContent = 'Erreur de chargement.'; return; }
  window.__clientsCourant = data || [];
  rendreListeClients(window.__clientsCourant);

  $('#cl-recherche').oninput = (e) => {
    const t = e.target.value.trim().toLowerCase();
    rendreListeClients(window.__clientsCourant.filter(c => c.raison_sociale.toLowerCase().includes(t)));
  };

  const inputImport = $('#cl-import-fichier');
  if (inputImport) {
    inputImport.onchange = async (e) => {
      const fichier = e.target.files[0];
      e.target.value = '';
      if (!fichier) return;
      await importerMiseAJourClients(fichier);
    };
  }
}

// Filtre dédié pour l'onglet "Organismes sous-traitants" (clients.type_client
// = 'organisme_formation') — voir patch_2026-09-18a.
function ecranSousTraitants(vue) {
  return ecranClients(vue, 'organisme_formation');
}

// ---------------------------------------------------------------------------
// Export / import de la fiche client (compléter en masse adresse, SIRET,
// code APE… notamment après un import de sessions qui ne crée le client
// qu'avec sa raison sociale).
// ---------------------------------------------------------------------------
const COLONNES_EXPORT_CLIENTS = ['Raison sociale', 'SIRET', 'Code APE', 'Adresse', 'Code postal', 'Ville', "Secteur d'activité", 'Notes', 'Actif', 'Champs manquants'];

async function exporterClientsExcel() {
  const { data: clients, error } = await supa.from('clients').select('*').order('raison_sociale');
  if (error) { DEBUG.erreur('exporterClientsExcel', error); toast('Erreur : ' + error.message, 'erreur'); return; }

  const lignes = (clients || []).map(c => {
    const manquants = [];
    if (!c.siret) manquants.push('SIRET');
    if (!c.code_ape) manquants.push('Code APE');
    if (!c.adresse) manquants.push('Adresse');
    if (!c.code_postal) manquants.push('Code postal');
    if (!c.ville) manquants.push('Ville');
    if (!c.secteur_activite) manquants.push("Secteur d'activité");
    return [
      c.raison_sociale, c.siret || '', c.code_ape || '', c.adresse || '',
      c.code_postal || '', c.ville || '', c.secteur_activite || '', c.notes || '',
      c.actif ? 'oui' : 'non', manquants.join(', '),
    ];
  });

  const feuille = XLSX.utils.aoa_to_sheet([COLONNES_EXPORT_CLIENTS, ...lignes]);
  feuille['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 6 }, { wch: 30 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Clients');
  XLSX.writeFile(classeur, `Clients - fiches a completer - ${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast(`${lignes.length} client(s) exporté(s).`);
}

async function importerMiseAJourClients(fichier) {
  const zone = $('#cl-import-resultat');
  zone.innerHTML = '<div class="carte">Analyse…</div>';

  let lignesBrutes;
  try {
    const buffer = await fichier.arrayBuffer();
    const classeur = XLSX.read(buffer, { type: 'array' });
    const feuille = classeur.Sheets['Clients'] || classeur.Sheets[classeur.SheetNames[0]];
    lignesBrutes = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: null });
  } catch (err) {
    DEBUG.erreur('lectureImportClients', err);
    zone.innerHTML = `<div class="carte"><p class="erreur">Erreur de lecture du fichier : ${esc(err.message)}</p></div>`;
    return;
  }

  if (!lignesBrutes || lignesBrutes.length < 2) { zone.innerHTML = '<div class="carte"><p class="erreur">Fichier vide ou illisible.</p></div>'; return; }

  const entetes = lignesBrutes[0].map(normaliserEntete);
  const colonnes = {
    raison_sociale: entetes.findIndex(h => h.startsWith('raison sociale')),
    siret: entetes.findIndex(h => h.startsWith('siret')),
    code_ape: entetes.findIndex(h => h.startsWith('code ape')),
    adresse: entetes.findIndex(h => h.startsWith('adresse')),
    code_postal: entetes.findIndex(h => h.startsWith('code postal')),
    ville: entetes.findIndex(h => h.startsWith('ville')),
    secteur_activite: entetes.findIndex(h => h.startsWith('secteur')),
    notes: entetes.findIndex(h => h.startsWith('notes')),
  };
  if (colonnes.raison_sociale === -1) {
    zone.innerHTML = '<div class="carte"><p class="erreur">Colonne "Raison sociale" introuvable — utilise le fichier généré par "Exporter (Excel)".</p></div>';
    return;
  }

  const { data: clientsExistants } = await supa.from('clients').select('id, raison_sociale');
  const index = {};
  (clientsExistants || []).forEach(c => { index[c.raison_sociale.trim().toLowerCase()] = c.id; });

  let misAJour = 0, inchanges = 0;
  const introuvables = [];
  const echecs = [];

  for (let r = 1; r < lignesBrutes.length; r++) {
    const row = lignesBrutes[r];
    if (!row || row.every(v => v === null || v === '')) continue;
    const val = (cle) => colonnes[cle] !== -1 && colonnes[cle] != null ? row[colonnes[cle]] : null;
    const raisonSociale = String(val('raison_sociale') || '').trim();
    if (!raisonSociale) continue;

    const clientId = index[raisonSociale.toLowerCase()];
    if (!clientId) { introuvables.push(raisonSociale); continue; }

    // Ne met à jour que les cases remplies : une case vide dans le fichier
    // ne doit jamais effacer une valeur déjà enregistrée.
    const payload = {};
    ['siret', 'code_ape', 'adresse', 'code_postal', 'ville', 'secteur_activite', 'notes'].forEach(cle => {
      const v = val(cle);
      if (v !== null && String(v).trim() !== '') payload[cle] = String(v).trim();
    });

    if (!Object.keys(payload).length) { inchanges++; continue; }

    const { error } = await supa.from('clients').update(payload).eq('id', clientId);
    if (error) { echecs.push(`${raisonSociale} : ${error.message}`); continue; }
    misAJour++;
  }

  zone.innerHTML = `
    <div class="carte">
      <p style="color:#0a5c8a;font-weight:600;">${misAJour} client(s) mis à jour${inchanges ? `, ${inchanges} sans changement (rien de nouveau dans le fichier)` : ''}.</p>
      ${introuvables.length ? `<p class="erreur">${introuvables.length} raison(s) sociale(s) introuvable(s) en base (vérifie l'orthographe exacte) : ${introuvables.map(esc).join(', ')}</p>` : ''}
      ${echecs.length ? `<p class="erreur">${echecs.length} échec(s) : ${echecs.map(esc).join(' ; ')}</p>` : ''}
    </div>`;
  toast('Import des mises à jour clients terminé.');
  ecranClients($('#vue'), window.__clientsTypeFiltre);
}

function rendreListeClients(liste) {
  const zone = $('#clients-liste');
  if (!liste.length) { zone.innerHTML = '<p style="color:#55636c;">Aucun client.</p>'; return; }
  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${liste.map(c => `
      <tr style="border-top:1px solid #eee;cursor:pointer;${c.actif ? '' : 'opacity:.5;'}" onclick="ouvrirFicheClient('${c.id}')">
        <td style="padding:6px 8px;">${esc(c.raison_sociale)}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(c.ville || '')}</td>
        <td style="padding:6px 8px;color:#55636c;">${c.type_client === 'organisme_formation' ? 'Organisme de formation' : ''}</td>
        <td style="padding:6px 8px;">${c.actif ? '' : '<span style="color:#b3261e;">inactif</span>'}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function ouvrirFicheClient(id) {
  const zone = $('#client-fiche');
  zone.innerHTML = '<div class="carte">Chargement…</div>';
  zone.scrollIntoView({ behavior: 'smooth' });

  let client = null, contacts = [], stats = [];
  if (id) {
    const [{ data: c }, { data: ct }, { data: st }] = await Promise.all([
      supa.from('clients').select('*').eq('id', id).single(),
      supa.from('contacts_client').select('*').eq('client_id', id).order('contact_principal', { ascending: false }),
      supa.from('statistiques_client').select('*').eq('client_id', id).order('annee', { ascending: false }),
    ]);
    client = c; contacts = ct || []; stats = st || [];
  }

  zone.innerHTML = `
    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">${client ? 'Modifier' : 'Nouveau'} client</h3>
      <label for="ci-raison">Raison sociale</label>
      <input id="ci-raison" value="${client ? esc(client.raison_sociale) : ''}">
      <label for="ci-type">Type</label>
      <select id="ci-type">
        <option value="entreprise" ${!client || client.type_client === 'entreprise' ? 'selected' : ''}>Entreprise cliente</option>
        <option value="organisme_formation" ${client?.type_client === 'organisme_formation' || window.__clientsTypeFiltre === 'organisme_formation' ? 'selected' : ''}>Organisme de formation (sous-traitance)</option>
      </select>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="ci-siret">SIRET</label><input id="ci-siret" value="${client ? esc(client.siret) : ''}"></div>
        <div style="flex:1;"><label for="ci-ape">Code APE</label><input id="ci-ape" value="${client ? esc(client.code_ape) : ''}"></div>
      </div>
      <label for="ci-adresse">Adresse</label>
      <input id="ci-adresse" value="${client ? esc(client.adresse) : ''}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="ci-cp">Code postal</label><input id="ci-cp" value="${client ? esc(client.code_postal) : ''}"></div>
        <div style="flex:2;"><label for="ci-ville">Ville</label><input id="ci-ville" value="${client ? esc(client.ville) : ''}"></div>
      </div>
      <label for="ci-secteur">Secteur d'activité</label>
      <input id="ci-secteur" value="${client ? esc(client.secteur_activite) : ''}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="ci-financement">Type de financement</label>
          <select id="ci-financement">
            <option value="" ${!client || !client.type_financement ? 'selected' : ''}>— Non renseigné —</option>
            <option value="entreprise" ${client?.type_financement === 'entreprise' ? 'selected' : ''}>Entreprise (règle elle-même)</option>
            <option value="opco" ${client?.type_financement === 'opco' ? 'selected' : ''}>OPCO</option>
            <option value="autre" ${client?.type_financement === 'autre' ? 'selected' : ''}>Autre (CPF, France Travail, Conseil régional…)</option>
          </select>
        </div>
        <div style="flex:1;" id="ci-opco-zone">
          <label for="ci-opco-nom">Nom de l'OPCO</label>
          <input id="ci-opco-nom" value="${client ? esc(client.opco_nom) : ''}" placeholder="ex. Constructys, AKTO…" list="ci-opco-liste">
          <datalist id="ci-opco-liste">
            <option value="AFDAS"><option value="AKTO"><option value="ATLAS"><option value="Constructys">
            <option value="EP+"><option value="OCAPIAT"><option value="OPCO 2i"><option value="OPCO Mobilités">
            <option value="OPCO Santé"><option value="Opcommerce"><option value="Uniformation">
          </datalist>
        </div>
      </div>
      <label for="ci-notes">Notes</label>
      <textarea id="ci-notes" rows="2">${client ? esc(client.notes) : ''}</textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <input type="checkbox" id="ci-actif" style="width:auto;" ${!client || client.actif ? 'checked' : ''}>
        <span>Client actif</span>
      </label>
      <div style="margin-top:14px;">
        <button class="bouton" id="ci-valider">Enregistrer</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#client-fiche').innerHTML=''">Fermer</button>
      </div>
      <div class="erreur" id="ci-erreur"></div>
    </div>

    ${client ? `
    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Contacts</h3>
      <div id="contacts-liste">${rendreContacts(contacts)}</div>
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;" onclick="ouvrirFormContact('${client.id}', null)">+ Ajouter un contact</button>
      <div id="contact-form"></div>
    </div>

    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">Statistiques AT / MP / jours ITT</h3>
      <div id="stats-liste">${rendreStats(stats)}</div>
      <button class="bouton" style="margin-top:10px;padding:6px 12px;font-size:13px;" onclick="ouvrirFormStat('${client.id}', null)">+ Ajouter une année</button>
      <div id="stat-form"></div>
    </div>` : ''}`;

  const majZoneOpco = () => {
    const zone = $('#ci-opco-zone');
    if (zone) zone.style.display = $('#ci-financement').value === 'opco' ? '' : 'none';
  };
  majZoneOpco();
  $('#ci-financement').onchange = majZoneOpco;

  $('#ci-valider').onclick = async () => {
    const typeFinancement = $('#ci-financement').value || null;
    const payload = {
      organisation_id: S.organisation.id,
      raison_sociale: $('#ci-raison').value.trim(),
      type_client: $('#ci-type').value,
      siret: $('#ci-siret').value.trim() || null,
      code_ape: $('#ci-ape').value.trim() || null,
      adresse: $('#ci-adresse').value.trim() || null,
      code_postal: $('#ci-cp').value.trim() || null,
      ville: $('#ci-ville').value.trim() || null,
      secteur_activite: $('#ci-secteur').value.trim() || null,
      type_financement: typeFinancement,
      opco_nom: typeFinancement === 'opco' ? ($('#ci-opco-nom').value.trim() || null) : null,
      notes: $('#ci-notes').value.trim() || null,
      actif: $('#ci-actif').checked,
    };
    if (!payload.raison_sociale) { $('#ci-erreur').textContent = 'La raison sociale est obligatoire.'; return; }

    const req = client ? supa.from('clients').update(payload).eq('id', client.id) : supa.from('clients').insert(payload).select().single();
    const { data, error } = await req;
    if (error) { DEBUG.erreur('enregistrerClient', error); $('#ci-erreur').textContent = 'Erreur : ' + error.message; return; }
    toast('Client enregistré.');
    if (!client) { ouvrirFicheClient(data.id); ecranClients($('#vue'), window.__clientsTypeFiltre); }
    else { ecranClients($('#vue'), window.__clientsTypeFiltre); }
  };
}

// ---------------------------------------------------------------------------
// Contacts (avec fonction : Responsable HSE, CSE, Médecine du travail, etc.)
// ---------------------------------------------------------------------------
function rendreContacts(contacts) {
  if (!contacts.length) return '<p style="color:#55636c;font-size:13px;">Aucun contact.</p>';
  return contacts.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid #eee;font-size:13px;">
      <span>
        <strong>${esc(c.prenom || '')} ${esc(c.nom || '')}</strong>
        ${c.fonction ? ' — ' + esc(c.fonction) : ''}
        ${c.contact_principal ? ' <span style="color:#0a5c8a;">(principal)</span>' : ''}
        ${c.email ? '<br><span style="color:#55636c;">' + esc(c.email) + '</span>' : ''}
        ${c.telephone ? ' <span style="color:#55636c;">' + esc(c.telephone) + '</span>' : ''}
      </span>
      <span>
        <button class="bouton" style="padding:3px 8px;font-size:11px;" onclick="ouvrirFormContact('${c.client_id}', '${c.id}')">Modifier</button>
        <button class="bouton" style="padding:3px 8px;font-size:11px;background:#fdeeee;color:#b3261e;" onclick="supprimerContact('${c.id}', '${c.client_id}')">Suppr.</button>
      </span>
    </div>`).join('');
}

async function ouvrirFormContact(clientId, contactId) {
  let contact = null;
  if (contactId) { const { data } = await supa.from('contacts_client').select('*').eq('id', contactId).single(); contact = data; }

  $('#contact-form').innerHTML = `
    <div class="carte" style="background:#fafbfc;margin-top:10px;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="co-civilite">Civilité</label><input id="co-civilite" value="${contact ? esc(contact.civilite) : ''}"></div>
        <div style="flex:2;"><label for="co-nom">Nom</label><input id="co-nom" value="${contact ? esc(contact.nom) : ''}"></div>
        <div style="flex:2;"><label for="co-prenom">Prénom</label><input id="co-prenom" value="${contact ? esc(contact.prenom) : ''}"></div>
      </div>
      <label for="co-fonction">Fonction (ex. Responsable HSE, CSE, Médecine du travail…)</label>
      <input id="co-fonction" value="${contact ? esc(contact.fonction) : ''}" list="co-fonctions-liste">
      <datalist id="co-fonctions-liste">
        <option value="Responsable HSE"><option value="CSE"><option value="Médecine du travail"><option value="Contact principal">
      </datalist>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="co-email">Email</label><input id="co-email" type="email" value="${contact ? esc(contact.email) : ''}"></div>
        <div style="flex:1;"><label for="co-tel">Téléphone</label><input id="co-tel" value="${contact ? esc(contact.telephone) : ''}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <input type="checkbox" id="co-principal" style="width:auto;" ${contact && contact.contact_principal ? 'checked' : ''}>
        <span>Contact principal</span>
      </label>
      <div style="margin-top:10px;">
        <button class="bouton" style="padding:6px 12px;font-size:13px;" id="co-valider">Enregistrer</button>
        <button class="bouton" style="padding:6px 12px;font-size:13px;background:#eee;color:#333;margin-left:6px;" onclick="$('#contact-form').innerHTML=''">Annuler</button>
      </div>
    </div>`;

  $('#co-valider').onclick = async () => {
    const payload = {
      organisation_id: S.organisation.id,
      client_id: clientId,
      civilite: $('#co-civilite').value.trim() || null,
      nom: $('#co-nom').value.trim() || null,
      prenom: $('#co-prenom').value.trim() || null,
      fonction: $('#co-fonction').value.trim() || null,
      email: $('#co-email').value.trim() || null,
      telephone: $('#co-tel').value.trim() || null,
      contact_principal: $('#co-principal').checked,
    };
    const req = contact ? supa.from('contacts_client').update(payload).eq('id', contact.id) : supa.from('contacts_client').insert(payload);
    const { error } = await req;
    if (error) { DEBUG.erreur('enregistrerContact', error); toast('Erreur : ' + error.message, 'erreur'); return; }
    toast('Contact enregistré.');
    $('#contact-form').innerHTML = '';
    ouvrirFicheClient(clientId);
  };
}

async function supprimerContact(contactId, clientId) {
  const { error } = await supa.from('contacts_client').delete().eq('id', contactId);
  if (error) { DEBUG.erreur('supprimerContact', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Contact supprimé.');
  ouvrirFicheClient(clientId);
}

// ---------------------------------------------------------------------------
// Statistiques AT / MP / jours ITT par année
// ---------------------------------------------------------------------------
function rendreStats(stats) {
  if (!stats.length) return '<p style="color:#55636c;font-size:13px;">Aucune donnée renseignée.</p>';
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr style="text-align:left;color:#55636c;"><th style="padding:4px 6px;">Année</th><th style="padding:4px 6px;">AT</th><th style="padding:4px 6px;">MP</th><th style="padding:4px 6px;">Jours ITT</th><th></th></tr></thead>
    <tbody>${stats.map(s => `
      <tr style="border-top:1px solid #eee;">
        <td style="padding:4px 6px;">${s.annee}</td>
        <td style="padding:4px 6px;">${s.accidents_travail ?? '—'}</td>
        <td style="padding:4px 6px;">${s.maladies_professionnelles ?? '—'}</td>
        <td style="padding:4px 6px;">${s.jours_itt ?? '—'}</td>
        <td style="padding:4px 6px;text-align:right;">
          <button class="bouton" style="padding:3px 8px;font-size:11px;" onclick="ouvrirFormStat('${s.client_id}', '${s.id}')">Modifier</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function ouvrirFormStat(clientId, statId) {
  let stat = null;
  if (statId) { const { data } = await supa.from('statistiques_client').select('*').eq('id', statId).single(); stat = data; }

  $('#stat-form').innerHTML = `
    <div class="carte" style="background:#fafbfc;margin-top:10px;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="st-annee">Année</label><input id="st-annee" type="number" value="${stat ? stat.annee : new Date().getFullYear() - 1}"></div>
        <div style="flex:1;"><label for="st-at">AT (accidents du travail)</label><input id="st-at" type="number" value="${stat && stat.accidents_travail != null ? stat.accidents_travail : ''}"></div>
        <div style="flex:1;"><label for="st-mp">MP (maladies pro.)</label><input id="st-mp" type="number" value="${stat && stat.maladies_professionnelles != null ? stat.maladies_professionnelles : ''}"></div>
        <div style="flex:1;"><label for="st-itt">Jours ITT</label><input id="st-itt" type="number" value="${stat && stat.jours_itt != null ? stat.jours_itt : ''}"></div>
      </div>
      <div style="margin-top:10px;">
        <button class="bouton" style="padding:6px 12px;font-size:13px;" id="st-valider">Enregistrer</button>
        <button class="bouton" style="padding:6px 12px;font-size:13px;background:#eee;color:#333;margin-left:6px;" onclick="$('#stat-form').innerHTML=''">Annuler</button>
      </div>
      <div class="erreur" id="st-erreur"></div>
    </div>`;

  $('#st-valider').onclick = async () => {
    const payload = {
      organisation_id: S.organisation.id,
      client_id: clientId,
      annee: Number($('#st-annee').value),
      accidents_travail: $('#st-at').value ? Number($('#st-at').value) : null,
      maladies_professionnelles: $('#st-mp').value ? Number($('#st-mp').value) : null,
      jours_itt: $('#st-itt').value ? Number($('#st-itt').value) : null,
    };
    if (!payload.annee) { $('#st-erreur').textContent = "L'année est obligatoire."; return; }

    const req = stat ? supa.from('statistiques_client').update(payload).eq('id', stat.id) : supa.from('statistiques_client').insert(payload);
    const { error } = await req;
    if (error) {
      DEBUG.erreur('enregistrerStat', error);
      $('#st-erreur').textContent = error.code === '23505' ? 'Une donnée existe déjà pour cette année.' : 'Erreur : ' + error.message;
      return;
    }
    toast('Statistique enregistrée.');
    $('#stat-form').innerHTML = '';
    ouvrirFicheClient(clientId);
  };
}
