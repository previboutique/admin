// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// import_excel.js — import ponctuel des anciens classeurs Excel vers Supabase,
// à partir du modèle "Import stagiaires" (une ligne = un stagiaire dans une
// session). Lecture via SheetJS. Les en-têtes de colonnes sont normalisées
// (minuscule, sans accents) et matchées par préfixe pour tolérer les
// variations de nommage, conformément au prompt de structure de l'appli.
//
// Règle de validation : une ligne réellement erronée (client/formation/nom/
// prénom manquant, code formation inconnu, date mal formée) n'est jamais
// importée silencieusement — elle est listée. En revanche une ligne dont
// seule la date de session manque n'est plus bloquante pour tout le fichier :
// le client et le stagiaire sont importés tout de suite (dédoublonnés comme
// d'habitude), et la ligne est mise de côté, clairement listée à part, avec
// un export à télécharger pour compléter la date plus tard et réimporter
// seulement ces lignes-là.

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

// valeur absente → pas d'erreur (juste "non renseignée") ; valeur présente
// mais mal formée → erreur. Le distinguo est ce qui permet de traiter une
// date de session manquante comme "à compléter" plutôt que comme un blocage.
function parserDate(valeur) {
  if (!valeur) return { iso: null, erreur: null };
  if (valeur instanceof Date && !isNaN(valeur)) {
    const y = valeur.getFullYear(), m = String(valeur.getMonth() + 1).padStart(2, '0'), d = String(valeur.getDate()).padStart(2, '0');
    return { iso: `${y}-${m}-${d}`, erreur: null };
  }
  const txt = String(valeur).trim();
  if (!txt) return { iso: null, erreur: null };
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
        Utilise le modèle "Import stagiaires" (une ligne = un stagiaire dans une
        session). Le fichier est analysé avant tout import. Une ligne franchement
        erronée (client/formation/nom/prénom manquant, code formation inconnu,
        date mal formée) n'est jamais importée silencieusement — elle est listée.
        Une ligne à qui il ne manque que la date de session n'empêche plus le
        reste du fichier : le client et le stagiaire sont importés tout de
        suite, et la ligne est mise de côté pour que tu complètes la date plus tard.
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
  const manquantes = COLONNES_ATTENDUES.filter(c => ['client', 'formation', 'nom', 'prenom'].includes(c.cle) && index[c.cle] === -1);
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
    const erreurs = [];  // bloquant : la ligne n'est pas importée du tout

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

    // Une date de début absente (pas mal formée, juste vide) n'est plus une
    // erreur bloquante : la ligne est mise de côté (client + stagiaire
    // importés, session à créer plus tard une fois la date connue).
    const dateManquante = !erreurs.length && !dDebut.iso;

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
      dateManquante,
    });
  }

  const bloquantes = lignes.filter(l => l.erreurs.length);
  const aCompleter = lignes.filter(l => !l.erreurs.length && l.dateManquante);
  const pretes = lignes.filter(l => !l.erreurs.length && !l.dateManquante);
  const clientsAcreer = [...new Set(lignes.filter(l => l.client && !l.clientExiste && !l.erreurs.length).map(l => l.client))];
  const sessionsUniques = new Set(pretes.map(l => `${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`));

  const ligneTable = (l) => `
    <tr style="border-top:1px solid #eee;${l.erreurs.length ? 'background:#fdeeee;' : l.dateManquante ? 'background:#fff8e6;' : ''}">
      <td style="padding:4px 6px;">${l.ligneExcel}</td>
      <td style="padding:4px 6px;">${esc(l.client)}${!l.clientExiste && l.client ? ' <span style="color:#0a5c8a;">(nouveau)</span>' : ''}</td>
      <td style="padding:4px 6px;">${esc(l.codeFormation)}</td>
      <td style="padding:4px 6px;">${l.dateDebut || '—'}${l.dateFin && l.dateFin !== l.dateDebut ? ' → ' + l.dateFin : ''}</td>
      <td style="padding:4px 6px;">${esc(l.prenom)} ${esc(l.nom)}</td>
      <td style="padding:4px 6px;">${esc(l.statut)}</td>
      <td style="padding:4px 6px;color:#b3261e;">${l.erreurs.map(esc).join(' ; ')}</td>
    </tr>`;

  zone.innerHTML = `
    <p>
      <strong>${lignes.length}</strong> ligne(s) lue(s) —
      <strong style="color:#0a5c8a;">${pretes.length}</strong> prête(s) (client + stagiaire + session),
      <strong style="color:#a06b00;">${aCompleter.length}</strong> à compléter (date de session manquante),
      <strong style="color:${bloquantes.length ? '#b3261e' : '#55636c'};">${bloquantes.length}</strong> en erreur (non importée(s)).
    </p>
    ${clientsAcreer.length ? `<p style="font-size:13px;color:#55636c;">Nouveaux clients à créer : ${clientsAcreer.map(esc).join(', ')}</p>` : ''}
    <p style="font-size:13px;color:#55636c;">${sessionsUniques.size} session(s) distincte(s) seront créées ou réutilisées pour les lignes prêtes.</p>

    ${aCompleter.length ? `
    <p style="font-size:13px;color:#a06b00;margin-top:12px;"><strong>À compléter :</strong> ces lignes n'ont pas de date de session renseignée. Le client et le stagiaire seront quand même importés (pas la session) ; complète la date dans le fichier et réimporte-le plus tard pour créer la session, ou crée-la à la main dans l'écran Sessions.</p>` : ''}

    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px;">
      <thead><tr style="text-align:left;color:#55636c;">
        <th style="padding:4px 6px;">Ligne</th><th style="padding:4px 6px;">Client</th><th style="padding:4px 6px;">Formation</th>
        <th style="padding:4px 6px;">Session</th><th style="padding:4px 6px;">Stagiaire</th><th style="padding:4px 6px;">Statut</th><th style="padding:4px 6px;">Erreurs</th>
      </tr></thead>
      <tbody>${lignes.map(ligneTable).join('')}</tbody>
    </table>

    <div style="margin-top:16px;">
      ${(pretes.length || aCompleter.length)
        ? `<button class="bouton" id="imp-valider">Importer ${pretes.length + aCompleter.length} ligne(s) (client(s) + stagiaire(s)${pretes.length ? ' + session(s) pour les lignes prêtes' : ''})</button>`
        : `<p class="erreur">Aucune ligne importable — corrige les erreurs dans le fichier Excel et réimporte-le.</p>`}
      ${bloquantes.length ? `<p style="font-size:12.5px;color:#55636c;margin-top:8px;">Les ${bloquantes.length} ligne(s) en erreur ci-dessus ne seront pas importées ; corrige-les dans le fichier et réimporte-le séparément, rien n'est perdu.</p>` : ''}
    </div>`;

  if (pretes.length || aCompleter.length) {
    $('#imp-valider').onclick = () => executerImport(pretes, aCompleter);
  }
}

async function executerImport(pretes, aCompleter) {
  const zone = $('#imp-resultat');
  zone.innerHTML = 'Import en cours…';
  const rapport = [];
  const echecs = [];  // erreurs survenues pendant l'import lui-même (ex. contrainte base) — jamais silencieuses
  const toutesLesLignes = [...pretes, ...aCompleter];

  // 1. Clients : créer ceux qui n'existent pas encore (lignes prêtes ET à compléter)
  const { data: clientsExistants } = await supa.from('clients').select('id, raison_sociale');
  const clientsIndex = {};
  (clientsExistants || []).forEach(c => { clientsIndex[c.raison_sociale.trim().toLowerCase()] = c.id; });

  for (const nomClient of [...new Set(toutesLesLignes.map(l => l.client))]) {
    const cle = nomClient.toLowerCase();
    if (clientsIndex[cle]) continue;
    const { data, error } = await supa.from('clients').insert({ organisation_id: S.organisation.id, raison_sociale: nomClient }).select().single();
    if (error) { echecs.push(`Client "${nomClient}" non créé : ${error.message}`); continue; }
    clientsIndex[cle] = data.id;
    rapport.push(`Client créé : ${nomClient}`);
  }

  // 2. Formations : résoudre les id à partir des codes
  const { data: formations } = await supa.from('formations_catalogue').select('id, code');
  const formationsIndex = {};
  (formations || []).forEach(f => { formationsIndex[f.code] = f.id; });

  // 3. Sessions : une par tuple (client, formation, date_debut, date_fin, lieu) — lignes prêtes uniquement
  const sessionsIndex = {};
  for (const l of pretes) {
    const clientId = clientsIndex[l.client.toLowerCase()];
    if (!clientId) { echecs.push(`Session ${l.codeFormation} du ${l.dateDebut} (${l.client}) non créée : client non disponible.`); continue; }
    const cleSession = `${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`;
    if (sessionsIndex[cleSession]) continue;
    const { data, error } = await supa.from('sessions_formation').insert({
      organisation_id: S.organisation.id,
      formation_id: formationsIndex[l.codeFormation],
      client_id: clientId,
      lieu: l.lieu,
      date_debut: l.dateDebut,
      date_fin: l.dateFin,
      statut: 'terminee',
    }).select().single();
    if (error) { echecs.push(`Session ${l.codeFormation} du ${l.dateDebut} (${l.client}) non créée : ${error.message}`); continue; }
    sessionsIndex[cleSession] = data.id;
    rapport.push(`Session créée : ${l.codeFormation} du ${l.dateDebut} — ${l.client}`);
  }

  // 4. Stagiaires : trouver ou créer (nom + prénom + client) — lignes prêtes ET à compléter
  const { data: stagiairesExistants } = await supa.from('stagiaires').select('id, nom, prenom, client_id');
  const stagiairesIndex = {};
  (stagiairesExistants || []).forEach(s => { stagiairesIndex[`${s.nom.toLowerCase()}|${s.prenom.toLowerCase()}|${s.client_id}`] = s.id; });

  let participantsCrees = 0, participantsIgnores = 0, stagiairesEnEchec = 0;
  for (const l of toutesLesLignes) {
    const clientId = clientsIndex[l.client.toLowerCase()];
    if (!clientId) { stagiairesEnEchec++; continue; }  // déjà signalé ci-dessus (échec création client)
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
      if (error) { echecs.push(`Stagiaire ${l.prenom} ${l.nom} non créé : ${error.message}`); stagiairesEnEchec++; continue; }
      stagiaireId = data.id;
      stagiairesIndex[cleStagiaire] = stagiaireId;
      rapport.push(`Stagiaire créé : ${l.prenom} ${l.nom}`);
    }

    if (l.dateManquante) continue;  // pas de session à ce stade : rien à inscrire

    const sessionId = sessionsIndex[`${l.client}|${l.codeFormation}|${l.dateDebut}|${l.dateFin}|${l.lieu}`];
    if (!sessionId) continue;  // session déjà signalée en échec ci-dessus
    const { error: errPart } = await supa.from('session_participants').insert({
      organisation_id: S.organisation.id,
      session_id: sessionId,
      stagiaire_id: stagiaireId,
      statut: l.statut,
      note_moyenne: l.noteMoyenne,
    });
    if (errPart) {
      if (errPart.code === '23505') { participantsIgnores++; continue; }  // déjà inscrit, on ignore silencieusement
      echecs.push(`Inscription ${l.prenom} ${l.nom} non créée : ${errPart.message}`);
      continue;
    }
    participantsCrees++;
  }

  zone.innerHTML = `
    <p style="color:#0a5c8a;font-weight:600;">
      Import terminé : ${participantsCrees} inscription(s) créée(s)${participantsIgnores ? `, ${participantsIgnores} déjà présente(s) (ignorée(s))` : ''}.
    </p>
    ${aCompleter.length ? `<p style="color:#a06b00;font-weight:600;">${aCompleter.length} ligne(s) mise(s) de côté : client et stagiaire importés, session à créer une fois la date connue.</p>
      <button class="bouton" id="imp-telecharger-acompleter" style="background:#eee;color:#333;">Télécharger les lignes à compléter (Excel)</button>` : ''}
    ${echecs.length ? `<p class="erreur" style="margin-top:10px;">${echecs.length} élément(s) non importé(s) pendant l'écriture en base (voir détail ci-dessous) — rien n'a été perdu côté fichier, relancer l'import est sans risque, ce qui est déjà créé sera réutilisé.</p>` : ''}
    <details style="font-size:12.5px;color:#55636c;margin-top:8px;"><summary>Détail des créations</summary>${rapport.map(esc).join('<br>')}</details>
    ${echecs.length ? `<details style="font-size:12.5px;color:#b3261e;margin-top:8px;" open><summary>Détail des échecs</summary>${echecs.map(esc).join('<br>')}</details>` : ''}`;

  if (aCompleter.length) {
    $('#imp-telecharger-acompleter').onclick = () => telechargerLignesACompleter(aCompleter);
  }

  toast(aCompleter.length ? 'Import terminé — des lignes restent à compléter.' : 'Import terminé.');
}

// Réexporte les lignes mises de côté (date de session manquante) dans un
// fichier au même format que le modèle d'import, pour que Jérémy puisse
// compléter la date puis réimporter uniquement ces lignes-là plus tard.
function telechargerLignesACompleter(aCompleter) {
  const entetes = ['Client', 'Formation (code)', 'Date debut', 'Date fin', 'Lieu', 'Civilite', 'Nom stagiaire', 'Prenom stagiaire', 'Date de naissance', 'Lieu de naissance', 'Statut', 'Note moyenne'];
  const lignes = aCompleter.map(l => [
    l.client, l.codeFormation, '', '', l.lieu || '', l.civilite || '',
    l.nom, l.prenom, l.dateNaissance || '', l.lieuNaissance || '', l.statut, l.noteMoyenne ?? '',
  ]);
  const feuille = XLSX.utils.aoa_to_sheet([entetes, ...lignes]);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'À compléter');
  XLSX.writeFile(classeur, 'Import - lignes a completer.xlsx');
}
