// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// clients.js — écran Clients : liste, fiche (infos + contacts + statistiques
// AT/MP/jours ITT par année, reprises de l'onglet "Renseignement" du classeur
// Excel d'origine).

async function ecranClients(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Clients</h2>
      <button class="bouton" onclick="ouvrirFicheClient(null)">+ Nouveau client</button>
    </div>
    <div class="carte">
      <input id="cl-recherche" placeholder="Rechercher un client…" style="margin-bottom:10px;">
      <div id="clients-liste">Chargement…</div>
    </div>
    <div id="client-fiche"></div>`;

  const { data, error } = await supa.from('clients').select('id, raison_sociale, ville, actif').order('raison_sociale');
  if (error) { DEBUG.erreur('ecranClients', error); $('#clients-liste').textContent = 'Erreur de chargement.'; return; }
  window.__clientsCourant = data || [];
  rendreListeClients(window.__clientsCourant);

  $('#cl-recherche').oninput = (e) => {
    const t = e.target.value.trim().toLowerCase();
    rendreListeClients(window.__clientsCourant.filter(c => c.raison_sociale.toLowerCase().includes(t)));
  };
}

function rendreListeClients(liste) {
  const zone = $('#clients-liste');
  if (!liste.length) { zone.innerHTML = '<p style="color:#55636c;">Aucun client.</p>'; return; }
  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${liste.map(c => `
      <tr style="border-top:1px solid #eee;cursor:pointer;${c.actif ? '' : 'opacity:.5;'}" onclick="ouvrirFicheClient('${c.id}')">
        <td style="padding:6px 8px;">${esc(c.raison_sociale)}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(c.ville || '')}</td>
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

  $('#ci-valider').onclick = async () => {
    const payload = {
      organisation_id: S.organisation.id,
      raison_sociale: $('#ci-raison').value.trim(),
      siret: $('#ci-siret').value.trim() || null,
      code_ape: $('#ci-ape').value.trim() || null,
      adresse: $('#ci-adresse').value.trim() || null,
      code_postal: $('#ci-cp').value.trim() || null,
      ville: $('#ci-ville').value.trim() || null,
      secteur_activite: $('#ci-secteur').value.trim() || null,
      notes: $('#ci-notes').value.trim() || null,
      actif: $('#ci-actif').checked,
    };
    if (!payload.raison_sociale) { $('#ci-erreur').textContent = 'La raison sociale est obligatoire.'; return; }

    const req = client ? supa.from('clients').update(payload).eq('id', client.id) : supa.from('clients').insert(payload).select().single();
    const { data, error } = await req;
    if (error) { DEBUG.erreur('enregistrerClient', error); $('#ci-erreur').textContent = 'Erreur : ' + error.message; return; }
    toast('Client enregistré.');
    if (!client) { ouvrirFicheClient(data.id); ecranClients($('#vue')); }
    else { ecranClients($('#vue')); }
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
