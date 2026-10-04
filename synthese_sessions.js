// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// synthese_sessions.js — onglet "Synthèse de session" de la catégorie
// "Activité formation" : statistiques générales (stagiaires, réussite / échec,
// satisfaction), puis le même tableau par formation du catalogue, en 3
// colonnes : Mixte (initial + recyclage), Initial, Recyclage.
//
// Règles :
//  - sessions annulées (dont reportées) exclues ;
//  - une fiche catalogue est un "recyclage" si une autre fiche la désigne
//    comme formation_recyclage_id ; sa "formation" est alors celle de la
//    fiche initiale qui la désigne ;
//  - réussite = stagiaire au statut "certifie", échec = "non_certifie" ;
//  - satisfaction = moyenne /4 des moyennes par critère (comme la synthèse
//    d'une session).

async function ecranSyntheseSessions(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin:0 0 4px;">Synthèse de session — Activité formation</h2>
      <p style="margin:0;color:#55636c;font-size:13px;">Stagiaires, réussite / échec et satisfaction, en général puis par formation du catalogue (mixte, initial, recyclage). Sessions annulées ou reportées exclues.</p>
    </div>
    <div class="carte">
      <div style="min-width:140px;max-width:220px;">
        <label for="ss-annee">Année</label>
        <select id="ss-annee" onchange="rafraichirSyntheseSessions()"></select>
      </div>
    </div>
    <div id="ss-contenu"><div class="carte">Chargement…</div></div>`;

  // Chargement paginé (limite de 1000 lignes par requête côté Supabase).
  const sessions = [];
  for (let debut = 0; ; debut += 500) {
    const { data, error } = await supa
      .from('sessions_formation')
      .select('id, date_debut, formation_id, session_participants(statut, evaluation_satisfaction)')
      .neq('statut', 'annulee')
      .order('date_debut', { ascending: true })
      .range(debut, debut + 499);
    if (error) { DEBUG.erreur('ecranSyntheseSessions', error); $('#ss-contenu').innerHTML = '<div class="carte">Erreur de chargement.</div>'; return; }
    sessions.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const { data: formations, error: errF } = await supa.from('formations_catalogue').select('id, denomination, categorie, formation_recyclage_id');
  if (errF) { DEBUG.erreur('ecranSyntheseSessions formations', errF); $('#ss-contenu').innerHTML = '<div class="carte">Erreur de chargement.</div>'; return; }

  window.__ssSessions = sessions.filter(s => s.date_debut);
  window.__ssFormations = formations || [];

  const anneeEnCours = new Date().getFullYear();
  const annees = [...new Set(window.__ssSessions.map(s => Number(s.date_debut.slice(0, 4))))].sort((a, b) => b - a);
  if (!annees.includes(anneeEnCours)) annees.unshift(anneeEnCours);
  $('#ss-annee').innerHTML = `<option value="">Toutes les années</option>` +
    annees.map(a => `<option value="${a}" ${a === anneeEnCours ? 'selected' : ''}>${a}</option>`).join('');

  rafraichirSyntheseSessions();
}

// Agrège un ensemble de sessions (chacune avec ses session_participants).
function ssAgreger(sessions) {
  const participants = sessions.flatMap(s => s.session_participants || []);
  const reussis = participants.filter(p => p.statut === 'certifie').length;
  const echecs = participants.filter(p => p.statut === 'non_certifie').length;
  const repondants = participants.filter(p => p.evaluation_satisfaction && Object.keys(p.evaluation_satisfaction).length);

  const criteres = QUESTIONS_SATISFACTION.map(q => {
    const valeurs = repondants.map(p => Number(p.evaluation_satisfaction[q])).filter(v => v >= 1 && v <= 4);
    return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
  });
  const moyennes = criteres.filter(v => v !== null);

  return {
    sessions: sessions.length,
    stagiaires: participants.length,
    reussis, echecs,
    sansDecision: participants.length - reussis - echecs,
    taux: (reussis + echecs) ? Math.round(100 * reussis / (reussis + echecs)) : null,
    repondants: repondants.length,
    note: moyennes.length ? moyennes.reduce((a, b) => a + b, 0) / moyennes.length : null,
    criteres,
  };
}

// Tableau à 3 colonnes (Mixte / Initial / Recyclage) à partir de 3 agrégats.
function ssTableau(mixte, initial, recyclage) {
  const cols = [mixte, initial, recyclage];
  const fr = n => n === null ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const cell = 'border:1px solid #d7dee3;padding:5px 10px;';
  const ligne = (libelle, f, gras) => `<tr><td style="${cell}${gras ? 'font-weight:600;' : ''}">${libelle}</td>${cols.map(c => `<td style="${cell}text-align:center;${gras ? 'font-weight:600;' : ''}">${f(c)}</td>`).join('')}</tr>`;
  return `
    <table style="border-collapse:collapse;font-size:13px;width:100%;">
      <tr style="background:#eaf3f9;"><td style="${cell}"></td>${['Mixte', 'Initial', 'Recyclage'].map(t => `<td style="${cell}text-align:center;font-weight:600;">${t}</td>`).join('')}</tr>
      ${ligne('Sessions', c => c.sessions)}
      ${ligne('Stagiaires', c => c.stagiaires, true)}
      ${ligne('Réussites', c => c.reussis)}
      ${ligne('Échecs', c => c.echecs)}
      ${ligne('Sans décision', c => c.sansDecision)}
      ${ligne('Taux de réussite', c => c.taux === null ? '—' : c.taux + ' %', true)}
      ${ligne('Stagiaires ayant évalué', c => c.repondants)}
      ${ligne('Satisfaction globale (/4)', c => fr(c.note), true)}
      ${QUESTIONS_SATISFACTION.map((q, i) => ligne(`<span style="color:#55636c;">${esc(q)}</span>`, c => fr(c.criteres[i]))).join('')}
    </table>`;
}

function rafraichirSyntheseSessions() {
  const zone = $('#ss-contenu');
  if (!zone) return;
  const annee = $('#ss-annee')?.value;
  const sessions = (window.__ssSessions || []).filter(s => !annee || s.date_debut.slice(0, 4) === annee);
  const formations = window.__ssFormations || [];
  const parId = Object.fromEntries(formations.map(f => [f.id, f]));

  // Fiche recyclage -> fiche initiale qui la désigne.
  const initialDe = {};
  formations.forEach(f => {
    if (f.formation_recyclage_id && f.formation_recyclage_id !== f.id && !initialDe[f.formation_recyclage_id]) initialDe[f.formation_recyclage_id] = f.id;
  });
  const estRecyclage = id => !!initialDe[id];
  const familleDe = id => initialDe[id] || id;

  const groupes = {};
  sessions.forEach(s => {
    const cle = familleDe(s.formation_id);
    (groupes[cle] = groupes[cle] || { initial: [], recyclage: [] })[estRecyclage(s.formation_id) ? 'recyclage' : 'initial'].push(s);
  });

  const sessionsInitial = sessions.filter(s => !estRecyclage(s.formation_id));
  const sessionsRecyclage = sessions.filter(s => estRecyclage(s.formation_id));

  const famillesTriees = Object.entries(groupes)
    .sort((a, b) => (b[1].initial.length + b[1].recyclage.length) - (a[1].initial.length + a[1].recyclage.length));

  zone.innerHTML = `
    <div class="carte">
      <h3 style="margin-top:0;">Ensemble des formations${annee ? ' — ' + esc(annee) : ''}</h3>
      ${sessions.length ? ssTableau(ssAgreger(sessions), ssAgreger(sessionsInitial), ssAgreger(sessionsRecyclage)) : '<p style="color:#55636c;">Aucune session sur cette période.</p>'}
    </div>
    ${famillesTriees.map(([cle, g]) => {
      const f = parId[cle];
      return `
      <div class="carte">
        <h3 style="margin-top:0;">${esc(f?.denomination || 'Formation inconnue')}
          <span style="font-weight:normal;font-size:12px;color:#55636c;">${esc(f?.categorie || '')}</span></h3>
        ${ssTableau(ssAgreger([...g.initial, ...g.recyclage]), ssAgreger(g.initial), ssAgreger(g.recyclage))}
      </div>`;
    }).join('')}`;
}
