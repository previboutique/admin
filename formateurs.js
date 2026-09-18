// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// formateurs.js — écran Formateurs : liste et fiche des comptes internes
// (nom, coordonnées, taux horaire, interne/externe), et création de nouveaux
// comptes de connexion via l'Edge Function "creer-compte-formateur" (une clé
// service_role est nécessaire pour créer un compte, elle ne peut donc pas
// être appelée directement depuis le navigateur).

async function ecranFormateurs(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Formateurs</h2>
      <button class="bouton" onclick="ouvrirFicheFormateur(null)">+ Nouveau formateur</button>
    </div>
    <div class="carte">
      <div id="formateurs-liste">Chargement…</div>
    </div>
    <div id="formateur-fiche"></div>`;

  const { data, error } = await supa.from('profils').select('*').order('nom');
  if (error) { DEBUG.erreur('ecranFormateurs', error); $('#formateurs-liste').textContent = 'Erreur de chargement.'; return; }
  rendreListeFormateurs(data || []);
}

function rendreListeFormateurs(liste) {
  const zone = $('#formateurs-liste');
  if (!liste.length) { zone.innerHTML = '<p style="color:#55636c;">Aucun formateur.</p>'; return; }
  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tbody>${liste.map(p => `
      <tr style="border-top:1px solid #eee;cursor:pointer;${p.actif ? '' : 'opacity:.5;'}" onclick="ouvrirFicheFormateur('${p.id}')">
        <td style="padding:6px 8px;">${esc(p.prenom)} ${esc(p.nom)}</td>
        <td style="padding:6px 8px;color:#55636c;">${esc(p.email || '')}</td>
        <td style="padding:6px 8px;color:#55636c;">${{ admin: 'Admin', gestionnaire: 'Gestionnaire', formateur: 'Formateur', super_admin: 'Super admin' }[p.role] || p.role}</td>
        <td style="padding:6px 8px;color:#55636c;">${p.formateur_externe ? 'Externe' : 'Interne'}</td>
        <td style="padding:6px 8px;color:#55636c;">${p.taux_horaire != null ? p.taux_horaire + ' €/h' : ''}</td>
        <td style="padding:6px 8px;">${p.actif ? '' : '<span style="color:#b3261e;">inactif</span>'}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function ouvrirFicheFormateur(id) {
  const zone = $('#formateur-fiche');
  zone.innerHTML = '<div class="carte">Chargement…</div>';
  zone.scrollIntoView({ behavior: 'smooth' });

  let formateur = null;
  if (id) {
    const { data } = await supa.from('profils').select('*').eq('id', id).single();
    formateur = data;
  }

  zone.innerHTML = `
    <div class="carte" style="max-width:560px;">
      <h3 style="margin-top:0;">${formateur ? 'Modifier' : 'Nouveau'} formateur</h3>
      ${!formateur ? `<p style="font-size:12px;color:#55636c;margin-top:-6px;">Crée un nouveau compte de connexion. Un mot de passe provisoire est généré — le formateur devra utiliser "Mot de passe oublié" à sa première connexion pour en choisir un.</p>` : ''}
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label for="fo-prenom">Prénom</label><input id="fo-prenom" value="${formateur ? esc(formateur.prenom) : ''}"></div>
        <div style="flex:1;"><label for="fo-nom">Nom</label><input id="fo-nom" value="${formateur ? esc(formateur.nom) : ''}"></div>
      </div>
      <label for="fo-email">Email</label>
      <input id="fo-email" type="email" value="${formateur ? esc(formateur.email) : ''}" ${formateur ? 'disabled' : ''}>
      ${formateur ? '<p style="font-size:11px;color:#55636c;margin:2px 0 0;">L\'email de connexion ne peut pas être modifié ici (voir Supabase → Authentication).</p>' : ''}
      <label for="fo-telephone">Téléphone</label>
      <input id="fo-telephone" value="${formateur ? esc(formateur.telephone) : ''}">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="fo-role">Rôle</label>
          <select id="fo-role">
            <option value="formateur" ${!formateur || formateur.role === 'formateur' ? 'selected' : ''}>Formateur</option>
            <option value="gestionnaire" ${formateur?.role === 'gestionnaire' ? 'selected' : ''}>Gestionnaire</option>
            <option value="admin" ${formateur?.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div style="flex:1;"><label for="fo-taux">Taux horaire (€/h)</label><input id="fo-taux" type="number" step="0.01" value="${formateur?.taux_horaire ?? ''}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
        <input type="checkbox" id="fo-externe" style="width:auto;" ${formateur?.formateur_externe ? 'checked' : ''}>
        <span>Formateur externe (sous-traitant, hors effectif de l'organisme — cadre E du BPF)</span>
      </label>
      ${formateur ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <input type="checkbox" id="fo-actif" style="width:auto;" ${formateur.actif ? 'checked' : ''}>
        <span>Compte actif</span>
      </label>` : ''}
      <div style="margin-top:14px;">
        <button class="bouton" id="fo-valider">${formateur ? 'Enregistrer' : 'Créer le compte'}</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#formateur-fiche').innerHTML=''">Fermer</button>
      </div>
      <div class="erreur" id="fo-erreur"></div>
      <div id="fo-resultat"></div>
    </div>`;

  $('#fo-valider').onclick = async () => {
    const payload = {
      nom: $('#fo-nom').value.trim(),
      prenom: $('#fo-prenom').value.trim(),
      telephone: $('#fo-telephone').value.trim() || null,
      role: $('#fo-role').value,
      taux_horaire: $('#fo-taux').value ? Number($('#fo-taux').value) : null,
      formateur_externe: $('#fo-externe').checked,
    };
    if (!payload.nom || !payload.prenom) { $('#fo-erreur').textContent = 'Nom et prénom obligatoires.'; return; }

    const bouton = $('#fo-valider');
    bouton.disabled = true;
    $('#fo-erreur').textContent = '';

    if (formateur) {
      payload.actif = $('#fo-actif').checked;
      const { error } = await supa.from('profils').update(payload).eq('id', formateur.id);
      bouton.disabled = false;
      if (error) { DEBUG.erreur('enregistrerFormateur', error); $('#fo-erreur').textContent = 'Erreur : ' + error.message; return; }
      toast('Formateur enregistré.');
      ecranFormateurs($('#vue'));
      return;
    }

    const email = $('#fo-email').value.trim();
    if (!email) { bouton.disabled = false; $('#fo-erreur').textContent = 'Email obligatoire.'; return; }

    try {
      const { data: { session } } = await supa.auth.getSession();
      const reponse = await fetch(`${SUPABASE_URL}/functions/v1/creer-compte-formateur`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...payload, email }),
      });
      const resultat = await reponse.json();
      bouton.disabled = false;
      if (!reponse.ok || resultat.error) throw new Error(resultat.error || 'Erreur inconnue.');

      $('#fo-resultat').innerHTML = `
        <div class="carte" style="background:#eef6fb;border-color:#0a5c8a;margin-top:10px;">
          <p style="margin:0;font-size:13px;">Compte créé. Mot de passe provisoire : <strong>${esc(resultat.mot_de_passe_provisoire)}</strong></p>
          <p style="margin:6px 0 0;font-size:12px;color:#55636c;">Transmets-le au formateur, ou dis-lui d'utiliser "Mot de passe oublié" à la connexion pour en choisir un lui-même.</p>
        </div>`;
      toast('Compte formateur créé.');
      ecranFormateurs($('#vue'));
    } catch (e) {
      bouton.disabled = false;
      DEBUG.erreur('creerCompteFormateur', e);
      $('#fo-erreur').textContent = 'Erreur : ' + e.message;
    }
  };
}
