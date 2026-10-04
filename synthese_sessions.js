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

// Couleurs des 3 colonnes / séries : Mixte, Initial, Recyclage.
const SS_COULEURS = ['#2a78d6', '#eb6834', '#1baf7a'];
const SS_FONDS = ['#e8f0fb', '#fdeee6', '#e3f6ee'];
const SS_NOMS = ['Mixte', 'Initial', 'Recyclage'];

// Fond d'une cellule de note /4 : vert (>= 3,5), vert clair (>= 3), orange (>= 2,5), rouge.
function ssFondNote(v) {
  if (v === null) return '';
  return v >= 3.5 ? 'background:#c9efd9;' : v >= 3 ? 'background:#e4f5d3;' : v >= 2.5 ? 'background:#ffe9bf;' : 'background:#f9cfcb;';
}
function ssFondTaux(v) {
  if (v === null) return '';
  return v >= 90 ? 'background:#c9efd9;' : v >= 75 ? 'background:#e4f5d3;' : v >= 50 ? 'background:#ffe9bf;' : 'background:#f9cfcb;';
}

// Radar (toile d'araignée) à plusieurs séries, échelle 0 à 4.
function ssRadar(series) {
  const W = 640, H = 400, cx = W / 2, cy = H / 2 + 4, R = 125, n = QUESTIONS_SATISFACTION.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = r => Array.from({ length: n }, (_, i) => pt(i, r).join(',')).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:640px;height:auto;font-family:Arial,sans-serif;">`;
  for (let k = 1; k <= 4; k++) {
    s += `<polygon points="${poly(R * k / 4)}" fill="${k % 2 ? '#f6f8fa' : '#fff'}" stroke="#c5ced4" stroke-width="0.8"/>`;
    s += `<text x="${cx + 3}" y="${cy - R * k / 4 + 10}" font-size="9" fill="#8a97a0">${k}</text>`;
  }
  QUESTIONS_SATISFACTION.forEach((q, i) => {
    const [x, y] = pt(i, R);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#c5ced4" stroke-width="0.8"/>`;
    const [lx, ly] = pt(i, R + 14);
    const ancre = Math.abs(lx - cx) < 8 ? 'middle' : (lx > cx ? 'start' : 'end');
    let l1 = '', l2 = '';
    q.split(' ').forEach(m => { if ((l1 + ' ' + m).trim().length <= 22 && !l2) l1 = (l1 + ' ' + m).trim(); else l2 = (l2 + ' ' + m).trim(); });
    const dy = ly < cy - R * 0.9 ? -8 : (ly > cy + R * 0.9 ? 8 : 0);
    s += `<text x="${lx}" y="${ly + dy}" font-size="9" text-anchor="${ancre}" fill="#33424c">${esc(l1)}${l2 ? `<tspan x="${lx}" dy="10">${esc(l2)}</tspan>` : ''}</text>`;
  });
  series.forEach(({ couleur, valeurs }) => {
    if (!valeurs.some(v => v !== null)) return;
    const pts = valeurs.map((v, i) => pt(i, R * (v || 0) / 4).join(',')).join(' ');
    s += `<polygon points="${pts}" fill="${couleur}" fill-opacity="0.18" stroke="${couleur}" stroke-width="2.2"/>`;
    valeurs.forEach((v, i) => { if (v !== null) { const [x, y] = pt(i, R * v / 4); s += `<circle cx="${x}" cy="${y}" r="2.6" fill="${couleur}"/>`; } });
  });
  return s + '</svg>';
}

// Bloc complet : tableau coloré (Mixte / Initial / Recyclage) + toile d'araignée.
function ssTableau(mixte, initial, recyclage) {
  const cols = [mixte, initial, recyclage];
  const fr = n => n === null ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const cell = 'border:1px solid #d7dee3;padding:6px 10px;';
  const ligne = (libelle, f, opts = {}) => `<tr>
    <td style="${cell}${opts.gras ? 'font-weight:600;' : ''}${opts.fondLibelle || 'background:#f6f8fa;'}">${libelle}</td>
    ${cols.map((c, k) => `<td style="${cell}text-align:center;${opts.gras ? 'font-weight:600;' : ''}${opts.couleur ? 'color:' + opts.couleur + ';' : ''}${opts.fond ? opts.fond(c) : ''}">${f(c)}</td>`).join('')}</tr>`;
  const titre = txt => `<tr><td colspan="4" style="padding:6px 10px;background:#33424c;color:#fff;font-size:12px;letter-spacing:.3px;">${txt}</td></tr>`;

  const tableau = `
    <table style="border-collapse:collapse;font-size:13px;width:100%;">
      <tr><td style="${cell}"></td>${SS_NOMS.map((n, k) => `<td style="${cell}text-align:center;font-weight:700;color:#fff;background:${SS_COULEURS[k]};">${n}</td>`).join('')}</tr>
      ${titre('ACTIVITÉ')}
      ${ligne('Sessions', c => c.sessions)}
      ${ligne('Stagiaires', c => c.stagiaires, { gras: true })}
      ${titre('RÉUSSITE')}
      ${ligne('Réussites', c => c.reussis, { couleur: '#1a7f3c' })}
      ${ligne('Échecs', c => c.echecs, { couleur: '#b3261e' })}
      ${ligne('Sans décision', c => c.sansDecision, { couleur: '#8a97a0' })}
      ${ligne('Taux de réussite', c => c.taux === null ? '—' : c.taux + ' %', { gras: true, fond: c => ssFondTaux(c.taux) })}
      ${titre('SATISFACTION (note /4)')}
      ${ligne('Stagiaires ayant évalué', c => c.repondants)}
      ${ligne('Satisfaction globale', c => fr(c.note), { gras: true, fond: c => ssFondNote(c.note) })}
      ${QUESTIONS_SATISFACTION.map((q, i) => ligne(`<span style="color:#55636c;">${esc(q)}</span>`, c => fr(c.criteres[i]), { fond: c => ssFondNote(c.criteres[i]) })).join('')}
    </table>`;

  const aDesNotes = cols.some(c => c.note !== null);
  const legende = cols.map((c, k) => c.note !== null
    ? `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;"><span style="width:12px;height:12px;border-radius:3px;background:${SS_COULEURS[k]};display:inline-block;"></span>${SS_NOMS[k]}</span>` : '').join('');
  const radar = aDesNotes
    ? `<div style="font-size:12px;font-weight:600;color:#33424c;margin-bottom:4px;">Satisfaction par critère (échelle 0 à 4)</div>
       <div style="font-size:12px;margin-bottom:4px;">${legende}</div>
       ${ssRadar(cols.map((c, k) => ({ couleur: SS_COULEURS[k], valeurs: c.criteres })))}`
    : '<p style="color:#55636c;font-size:13px;">Pas encore d\'évaluation de satisfaction pour tracer la toile d\'araignée.</p>';

  return `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
    <div style="flex:1 1 380px;min-width:300px;">${tableau}</div>
    <div style="flex:1 1 360px;min-width:300px;">${radar}</div>
  </div>`;
}

// Pastilles de synthèse (colonne Mixte) en haut du bloc "Ensemble".
function ssPastilles(m) {
  const fr = n => n === null ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const p = (valeur, libelle, fond, couleur) => `<div style="flex:1 1 130px;border-radius:10px;padding:12px 14px;background:${fond};">
    <div style="font-size:24px;font-weight:700;color:${couleur};line-height:1.1;">${valeur}</div>
    <div style="font-size:12px;color:#33424c;margin-top:2px;">${libelle}</div></div>`;
  return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
    ${p(m.sessions, 'sessions', '#e8f0fb', '#2a78d6')}
    ${p(m.stagiaires, 'stagiaires', '#e8f0fb', '#2a78d6')}
    ${p(m.taux === null ? '—' : m.taux + ' %', `réussite (${m.reussis} / ${m.echecs} échec${m.echecs > 1 ? 's' : ''})`, m.taux === null ? '#f6f8fa' : m.taux >= 75 ? '#c9efd9' : m.taux >= 50 ? '#ffe9bf' : '#f9cfcb', '#1c2b36')}
    ${p(fr(m.note) + (m.note === null ? '' : ' / 4'), `satisfaction (${m.repondants} réponse${m.repondants > 1 ? 's' : ''})`, m.note === null ? '#f6f8fa' : m.note >= 3.5 ? '#c9efd9' : m.note >= 3 ? '#e4f5d3' : m.note >= 2.5 ? '#ffe9bf' : '#f9cfcb', '#1c2b36')}
  </div>`;
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
      ${sessions.length ? (() => { const m = ssAgreger(sessions); return ssPastilles(m) + ssTableau(m, ssAgreger(sessionsInitial), ssAgreger(sessionsRecyclage)); })() : '<p style="color:#55636c;">Aucune session sur cette période.</p>'}
    </div>
    ${famillesTriees.map(([cle, g]) => {
      const f = parId[cle];
      return `
      <div class="carte">
        <h3 style="margin-top:0;border-left:5px solid #2a78d6;padding-left:10px;">${esc(f?.denomination || 'Formation inconnue')}
          <span style="font-weight:normal;font-size:12px;color:#55636c;">${esc(f?.categorie || '')}</span></h3>
        ${ssTableau(ssAgreger([...g.initial, ...g.recyclage]), ssAgreger(g.initial), ssAgreger(g.recyclage))}
      </div>`;
    }).join('')}`;
}
