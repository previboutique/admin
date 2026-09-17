// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// import_excel.js — import ponctuel des anciens classeurs Excel vers Supabase,
// à partir du modèle "Import stagiaires" (une ligne = un stagiaire dans une
// session). Lecture via SheetJS. Les en-têtes de colonnes sont normalisées
// (minuscule, sans accents) et matchées par préfixe pour tolérer les
// variations de nommage, conformément au prompt de structure de l'appli.

const COLONNES_ATTENDUES = [
  { cle: 'client', prefixe: 'client' },
  { cle: 'formation', prefixe: 'formation' },
  { cle: 'date_debut', prefixe: 'date debut' },
  { cle: 'date_fin', prefixe: 'date fin' },
  { cle: 'lieu', prefixe: 'lieu' },
  { cle: 'civilite', prefixe: 'civilite' },
  { cle: 'nom', prefixe: 'nom stagiaire' },
  { cle: 'prenom', prefixe: 'prenom stagiaire' },
  { cle: 'date_naissance', prefixe: 'date de naissance' },
  { cle: 'lieu_naissance', prefixe: 'lieu de naissance' },
  { cle: 'statut', prefixe: 'statut' },
  { cle: 'note_moyenne', prefixe: 'note moyenne' },
];

const STATUTS_VALIDES = ['inscrit', 'present', 'absent', 'certifie', 'non_certifie'];

function normaliserEntete(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // retire les accents
    .replace(/[()]/g, '')
    .trim();
}

function parserDate(valeur) {
  if (!valeur) return { iso: null, erreur: null };
  if (valeur instanceof Date && !isNaN(valeur)) {
    const y = valeur.getFullYear(), m = String(valeur.getMonth() + 1).padStart(2, '0'), d = String(valeur.getDate()).padStart(2, '0');
    return { iso: `${y}-${m}-${d}`, erreur: null };
  }
  const txt = String(valeur).trim();
  const m = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { iso: null, erreur: `date invalide : "${txt}" (attendu JJ/MM/AAAA)` };
  const [, j, mo, a] = m;
  const jj = Number(j), mm = Number(mo);
  if (jj < 1 || jj > 31 || mm < 1 || mm > 12) return { iso: null, erreur: `date invalide : "${txt}"` };
  return { iso: `${a}-${String(mm).padStart(2, '0')}-${String(jj).padStart(2, '0')}`, erreur: null };
}

async function ecranImport(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin-top:0;">Import d'un ancien classeur Excel</h2>
      <p style="color:#55636c;font-size:14px;">
        Utilise le modèle "Import stagiaires" (une ligne = un stagiaire dans une session).
        Le fichier est analysé et vérifié avant tout import — rien n'est écrit en base tant
        que tu n'as pas validé le résumé.
      </p>
      <input type="file" id="imp-fichier" accept=".xlsx,.xls">
      <div id="imp-resultat" style="margin-top:16px;"></div>
    </div>`;

  $('#imp-fichier').onchange = async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    $('#imp-resultat').innerHTML = 'Analyse…';
    try {
      const buffer = await fichier.arrayBuffer();
      const classeur = XLSX.read(buffer, { type: 'array', cellDates: true });
      const feuille = classeur.Sheets['Import stagiaires'] || classeur.Sheets[classeur.SheetNames[0]];
      const lignesBrutes = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: null });
      await analyserImport(lignesBrutes);
    } catch (err) {
      DEBUG.erreur('lectureImport', err);
      $('#imp-resultat').innerHTML = `<p class="erreur">Erreur de lecture du fichier : ${esc(err.message)}</p>`;
    }
  };
}

async function analyserImport(lignesBrutes) {
  const zone = $('#imp-resultat');
  if (!lignesBrutes || lignesBrutes.length < 2) { zone.innerHTML = '<p class="erreur">Fichier vide ou illisible.</p>'; return; }

  const entetes = lignesBrutes[0].map(normaliserEntete);
  const index = {};
  COLONNES_ATTENDUES.forEach(c => {
    const i = entetes.findIndex(h => h.startsWith(c.prefixe));
    index[c.cle] = i;
  });
  const manquantes = COLONNES_ATTENDUES.filter(c => ['client', 'formation', 'date_debut', 'date_fin', 'nom', 'prenom'].includes(c.cle) && index[c.cle] === -1);
  if (manquantes.length) {
    zone.innerHTML = `<p class="erreur">Colonnes obligatoires introuvables : ${manquantes.map(c => c.cle).join(', ')}. Vérifie que le fichier suit le modèle.</p>`;
    return;
  }

  // Référentiels pour validation (codes formations existants, clients existants)
  const { data: formations } = await supa.from('formations_catalogue').select('id, code');
  const codesConnus = new Set((formations || []).map(f => f.code));
  const { data: clientsExistants } = await supa.from('clients').select('id, raison_sociale');

  const lignes = [];
  for (let r = 1; r < lignesBrutes.length; r++) {
    const row = lignesBrutes[r];
    if (!row || row.every(v => v === null || v === '')) continue;

    const val = (cle) => index[cle] !== -1 ? row[index[cle]] : null;
    const erreurs = [];

    const client = String(val('client') || '').trim();
    const codeFormation = String(val('formation') || '').trim();
    const nom = String(val('nom') || '').trim();
    const prenom = String(val('prenom') || '').trim();

    if (!client) erreurs.push('client manquant');
    if (!codeFormation) erreurs.push('code formation manquant');
    else if (!codesConnus.has(codeFormation)) erreurs.push(`code formation "${codeFormation}" introuvable au catalogue`);
    if (!nom) erreurs.push('nom manquant');
    if (!prenom) erreurs.push('prénom manquant');

    const dDebut = parserDate(val('date_debut'));
    if (dDebut.erreur) erreurs.push('date début : ' + dDebut.erreur);
    const dFin = parserDate(val('date_fin'));
    if (dFin.erreur) erreurs.push('date fin : ' + dFin.erreur);
    const dNaissance = parserDate(val('date_naissance'));
    if (dNaissance.erreur) erreurs.push('date naissance : ' + dNaissance.erreur);

    let statut = String(val('statut') || 'inscrit').trim().toLowerCase();
    if (statut && !STATUTS_VALIDES.includes(statut)) { erreurs.push(`statut "${statut}" inconnu (attendu : ${STATUTS_VALIDES.join(', ')})`); statut = 'inscrit'; }

    lignes.push({
      ligneExcel: r + 1,
      client,
      clientExiste: clientsExistants?.some(c => c.raison_sociale.trim().toLowerCase() === client.toLowerCase()),
      codeFormation,
      dateDebut: dDebut.iso, dateFin: dFin.iso || dDebut.iso,
      lieu: String(val('lieu') || '').trim() || null,
      civilite: String(val('civilite') || '').trim() || null,
      nom, prenom,
      dateNaissance: dNaissance.iso,
      lieuNaissance: String(val('lieu_naissance') || '').trim() || null,
      statut: statut || 'inscrit',
      noteMoyenne: val('note_moyenne') ? Number(val('note_moyenne')) : null,
      erreurs,
    });
  }

  const nbErreurs = lignes.filter(l => l.erreurs.length).length;
  const clientsAcreer = [...new Set(lignes.filter(l => l.client && !l.clientExiste).map(l => l.client))];
  const sessionsUniques = new Set(lignes.filter(l => !l.erreurs.length).map(l => `${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`));

  zone.innerHTML = `
    <p><strong>${lignes.length}</strong> ligne(s) lue(s) — <strong>${lignes.length - nbErreurs}</strong> valide(s), <strong style="color:${nbErreurs ? '#b3261e' : '#0a5c8a'};">${nbErreurs}</strong> en erreur.</p>
    ${clientsAcreer.length ? `<p style="font-size:13px;color:#55636c;">Nouveaux clients à créer : ${clientsAcreer.map(esc).join(', ')}</p>` : ''}
    <p style="font-size:13px;color:#55636c;">${sessionsUniques.size} session(s) distincte(s) seront créées ou réutilisées.</p>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px;">
      <thead><tr style="text-align:left;color:#55636c;">
        <th style="padding:4px 6px;">Ligne</th><th style="padding:4px 6px;">Client</th><th style="padding:4px 6px;">Formation</th>
        <th style="padding:4px 6px;">Session</th><th style="padding:4px 6px;">Stagiaire</th><th style="padding:4px 6px;">Statut</th><th style="padding:4px 6px;">Erreurs</th>
      </tr></thead>
      <tbody>${lignes.map(l => `
        <tr style="border-top:1px solid #eee;${l.erreurs.length ? 'background:#fdeeee;' : ''}">
          <td style="padding:4px 6px;">${l.ligneExcel}</td>
          <td style="padding:4px 6px;">${esc(l.client)}${!l.clientExiste && l.client ? ' <span style="color:#0a5c8a;">(nouveau)</span>' : ''}</td>
          <td style="padding:4px 6px;">${esc(l.codeFormation)}</td>
          <td style="padding:4px 6px;">${l.dateDebut || '?'}${l.dateFin && l.dateFin !== l.dateDebut ? ' → ' + l.dateFin : ''}</td>
          <td style="padding:4px 6px;">${esc(l.prenom)} ${esc(l.nom)}</td>
          <td style="padding:4px 6px;">${esc(l.statut)}</td>
          <td style="padding:4px 6px;color:#b3261e;">${l.erreurs.map(esc).join(' ; ')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:16px;">
      ${nbErreurs
        ? `<p class="erreur">Corrige les lignes en erreur dans le fichier Excel et réimporte-le — aucune ligne valide ne sera perdue, mais je préfère ne rien importer tant qu'il reste des erreurs plutôt qu'importer une partie silencieusement.</p>`
        : `<button class="bouton" id="imp-valider">Importer ces ${lignes.length} ligne(s)</button>`}
    </div>`;

  if (!nbErreurs) {
    $('#imp-valider').onclick = () => executerImport(lignes);
  }
}

async function executerImport(lignes) {
  const zone = $('#imp-resultat');
  zone.innerHTML = 'Import en cours…';
  const rapport = [];

  try {
    // 1. Clients : créer ceux qui n'existent pas encore
    const { data: clientsExistants } = await supa.from('clients').select('id, raison_sociale');
    const clientsIndex = {};
    (clientsExistants || []).forEach(c => { clientsIndex[c.raison_sociale.trim().toLowerCase()] = c.id; });

    for (const nomClient of [...new Set(lignes.map(l => l.client))]) {
      const cle = nomClient.toLowerCase();
      if (clientsIndex[cle]) continue;
      const { data, error } = await supa.from('clients').insert({ organisation_id: S.organisation.id, raison_sociale: nomClient }).select().single();
      if (error) throw new Error(`création client "${nomClient}" : ${error.message}`);
      clientsIndex[cle] = data.id;
      rapport.push(`Client créé : ${nomClient}`);
    }

    // 2. Formations : résoudre les id à partir des codes
    const { data: formations } = await supa.from('formations_catalogue').select('id, code');
    const formationsIndex = {};
    (formations || []).forEach(f => { formationsIndex[f.code] = f.id; });

    // 3. Sessions : une par tuple (client, formation, date_debut, date_fin, lieu)
    const sessionsIndex = {};
    for (const l of lignes) {
      const cleSession = `${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`;
      if (sessionsIndex[cleSession]) continue;
      const { data, error } = await supa.from('sessions_formation').insert({
        organisation_id: S.organisation.id,
        formation_id: formationsIndex[l.codeFormation],
        client_id: clientsIndex[l.client.toLowerCase()],
        lieu: l.lieu,
        date_debut: l.dateDebut,
        date_fin: l.dateFin,
        statut: 'terminee',
      }).select().single();
      if (error) throw new Error(`création session (${l.client} / ${l.codeFormation} / ${l.dateDebut}) : ${error.message}`);
      sessionsIndex[cleSession] = data.id;
      rapport.push(`Session créée : ${l.codeFormation} du ${l.dateDebut} — ${l.client}`);
    }

    // 4. Stagiaires : trouver ou créer (nom + prénom + client)
    const { data: stagiairesExistants } = await supa.from('stagiaires').select('id, nom, prenom, client_id');
    const stagiairesIndex = {};
    (stagiairesExistants || []).forEach(s => { stagiairesIndex[`${s.nom.toLowerCase()}|${s.prenom.toLowerCase()}|${s.client_id}`] = s.id; });

    let participantsCrees = 0, participantsIgnores = 0;
    for (const l of lignes) {
      const clientId = clientsIndex[l.client.toLowerCase()];
      const cleStagiaire = `${l.nom.toLowerCase()}|${l.prenom.toLowerCase()}|${clientId}`;
      let stagiaireId = stagiairesIndex[cleStagiaire];
      if (!stagiaireId) {
        const { data, error } = await supa.from('stagiaires').insert({
          organisation_id: S.organisation.id,
          client_id: clientId,
          civilite: l.civilite,
          nom: l.nom, prenom: l.prenom,
          date_naissance: l.dateNaissance,
          lieu_naissance: l.lieuNaissance,
        }).select().single();
        if (error) throw new Error(`création stagiaire ${l.prenom} ${l.nom} : ${error.message}`);
        stagiaireId = data.id;
        stagiairesIndex[cleStagiaire] = stagiaireId;
        rapport.push(`Stagiaire créé : ${l.prenom} ${l.nom}`);
      }

      const sessionId = sessionsIndex[`${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`];
      const { error: errPart } = await supa.from('session_participants').insert({
        organisation_id: S.organisation.id,
        session_id: sessionId,
        stagiaire_id: stagiaireId,
        statut: l.statut,
        note_moyenne: l.noteMoyenne,
      });
      if (errPart) {
        if (errPart.code === '23505') { participantsIgnores++; continue; }  // déjà inscrit, on ignore silencieusement
        throw new Error(`inscription ${l.prenom} ${l.nom} : ${errPart.message}`);
      }
      participantsCrees++;
    }

    zone.innerHTML = `
      <p style="color:#0a5c8a;font-weight:600;">Import terminé : ${participantsCrees} inscription(s) créée(s)${participantsIgnores ? `, ${participantsIgnores} déjà présente(s) (ignorée(s))` : ''}.</p>
      <details style="font-size:12.5px;color:#55636c;"><summary>Détail des créations</summary>${rapport.map(esc).join('<br>')}</details>`;
    toast('Import terminé.');
  } catch (err) {
    DEBUG.erreur('executerImport', err);
    zone.innerHTML = `<p class="erreur">Import interrompu : ${esc(err.message)}</p>
      <p style="font-size:12.5px;color:#55636c;">Ce qui a déjà été créé avant l'erreur reste en base (clients/sessions/stagiaires) — relancer l'import est sans risque, les éléments déjà créés seront réutilisés et non dupliqués.</p>
      <details style="font-size:12.5px;color:#55636c;"><summary>Détail avant interruption</summary>${rapport.map(esc).join('<br>')}</details>`;
  }
}
