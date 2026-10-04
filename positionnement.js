// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// positionnement.js — écran « Positionnement » (Activité formation) : base de questions du questionnaire de
// positionnement (par thème, QCM à choix unique ou multiple, bonnes réponses), règlement intérieur de l'organisme,
// et résultats par session (carte dans la fiche session). Le stagiaire répond via positionnement.html, ouvert par le
// QR code PERSONNEL de sa convocation (patch_2026-10-05g_positionnement_reglement.sql).

const PQ = { questions: [], formations: [], ouvert: null };

function pqPeutModifier() { return ['admin', 'super_admin'].includes(S.profil?.role); }

async function ecranPositionnement(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div>
        <h2 style="margin:0;">Questionnaire de positionnement</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#55636c;">Chaque formation du catalogue est reliée à un <strong>thème</strong> (champ « Thème de positionnement » de la fiche catalogue). Le stagiaire répond aux questions de ce thème en scannant le QR code de sa convocation. Les questions sans bonne réponse définie ne sont pas notées.</p>
      </div>
      ${pqPeutModifier() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="bouton" style="background:#eee;color:#333;" onclick="pqImporterDepart()">Importer les questions de départ</button>
        <button class="bouton" onclick="pqOuvrirForm(null)">+ Nouvelle question</button>
      </div>` : ''}
    </div>
    <div id="pq-form"></div>
    <div id="pq-liste"><div class="carte">Chargement…</div></div>`;
  await pqCharger();
}

async function pqCharger() {
  const [{ data: qs, error }, { data: fs }] = await Promise.all([
    supa.from('positionnement_questions').select('*').order('theme').order('ordre').order('created_at'),
    supa.from('formations_catalogue').select('id, denomination, theme_positionnement, actif').order('denomination'),
  ]);
  if (error) { DEBUG.erreur('pqCharger', error); $('#pq-liste').innerHTML = `<div class="carte" style="color:#b3261e;">Erreur : ${esc(error.message)}. Le patch SQL « positionnement » a-t-il été exécuté dans Supabase ?</div>`; return; }
  PQ.questions = qs || []; PQ.formations = fs || [];
  pqAfficher();
}

function pqThemes() {
  const t = new Set(PQ.questions.map(q => q.theme));
  PQ.formations.forEach(f => { if (f.theme_positionnement) t.add(f.theme_positionnement); });
  return [...t].sort((a, b) => a.localeCompare(b, 'fr'));
}

function pqAfficher() {
  const themes = pqThemes();
  if (!themes.length) {
    $('#pq-liste').innerHTML = `<div class="carte"><p>Aucune question pour le moment.${pqPeutModifier() ? ' Clique sur « Importer les questions de départ » pour reprendre les 55 questions de ton formulaire (Secourisme, Incendie, Gestes et Postures, Habilitation électrique).' : ''}</p></div>`;
    return;
  }
  const modif = pqPeutModifier();
  const sansTheme = PQ.formations.filter(f => f.actif !== false && !f.theme_positionnement);
  $('#pq-liste').innerHTML = themes.map(th => {
    const qs = PQ.questions.filter(q => q.theme === th);
    const nbSansBonne = qs.filter(q => q.actif && !(q.options || []).some(o => o.correct)).length;
    const formations = PQ.formations.filter(f => f.theme_positionnement === th);
    return `
      <div class="carte">
        <h3 style="margin:0 0 4px;">${esc(th)} <span style="font-weight:normal;color:#55636c;font-size:13px;">— ${qs.filter(q => q.actif).length} question(s) active(s)</span></h3>
        <p style="margin:0 0 10px;font-size:12px;color:#55636c;">Formations concernées : ${formations.length ? formations.map(f => esc(f.denomination)).join(', ') : '<em>aucune (à relier dans la fiche catalogue)</em>'}.
          ${nbSansBonne ? `<span style="color:#8a5a00;"> ${nbSansBonne} question(s) sans bonne réponse définie : non notée(s).</span>` : ''}</p>
        ${qs.length ? qs.map((q, i) => pqLigne(q, i, qs.length, modif)).join('') : '<p style="color:#55636c;font-size:13px;">Aucune question dans ce thème.</p>'}
      </div>`;
  }).join('') + (sansTheme.length ? `<div class="carte" style="font-size:13px;color:#8a5a00;">Formations sans thème de positionnement (pas de questionnaire pour leurs stagiaires) : ${sansTheme.map(f => esc(f.denomination)).join(', ')}.</div>` : '');
}

function pqLigne(q, i, n, modif) {
  const bonne = (q.options || []).some(o => o.correct);
  return `
    <div style="border-top:1px solid #eee;padding:8px 0;${q.actif ? '' : 'opacity:.55;'}">
      <div style="display:flex;gap:8px;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <strong>${i + 1}. ${esc(q.libelle)}</strong>
          <span style="font-size:11px;background:#eef2f5;border-radius:4px;padding:1px 6px;margin-left:6px;">${q.type === 'multiple' ? 'choix multiple' : 'choix unique'}</span>
          ${bonne ? '' : '<span style="font-size:11px;background:#fff3d6;color:#8a5a00;border-radius:4px;padding:1px 6px;margin-left:4px;">bonne réponse à définir</span>'}
          ${q.actif ? '' : '<span style="font-size:11px;background:#eee;border-radius:4px;padding:1px 6px;margin-left:4px;">désactivée</span>'}
          <div style="font-size:13px;margin-top:4px;">
            ${(q.options || []).map(o => `<div style="color:${o.correct ? '#1b6e3c' : '#44525c'};">${o.correct ? '✔' : '○'} ${esc(o.texte)}</div>`).join('')}
          </div>
        </div>
        ${modif ? `<div style="white-space:nowrap;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:230px;">
          <button class="bouton" style="padding:3px 8px;font-size:12px;background:#eee;color:#333;" ${i === 0 ? 'disabled' : ''} onclick="pqDeplacer('${q.id}',-1)">▲</button>
          <button class="bouton" style="padding:3px 8px;font-size:12px;background:#eee;color:#333;" ${i === n - 1 ? 'disabled' : ''} onclick="pqDeplacer('${q.id}',1)">▼</button>
          <button class="bouton" style="padding:3px 8px;font-size:12px;" onclick="pqOuvrirForm('${q.id}')">Modifier</button>
          <button class="bouton" style="padding:3px 8px;font-size:12px;background:#eee;color:#333;" onclick="pqBasculerActif('${q.id}')">${q.actif ? 'Désactiver' : 'Activer'}</button>
          <button class="bouton" style="padding:3px 8px;font-size:12px;background:#fdeeee;color:#b3261e;" onclick="pqSupprimer('${q.id}')">Supprimer</button>
        </div>` : ''}
      </div>
    </div>`;
}

// ---------- Formulaire question ----------
function pqOuvrirForm(id) {
  const q = id ? PQ.questions.find(x => x.id === id) : null;
  PQ.ouvert = q || { id: null, theme: '', libelle: '', type: 'unique', options: [{ texte: '', correct: false }, { texte: '', correct: false }], actif: true };
  const o = PQ.ouvert;
  $('#pq-form').innerHTML = `
    <div class="carte">
      <h3 style="margin-top:0;">${q ? 'Modifier la question' : 'Nouvelle question'}</h3>
      <label for="pq-theme">Thème</label>
      <input id="pq-theme" list="pq-themes" value="${esc(o.theme)}" placeholder="ex. Secourisme">
      <datalist id="pq-themes">${pqThemes().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <label for="pq-libelle">Question</label>
      <textarea id="pq-libelle" rows="2">${esc(o.libelle)}</textarea>
      <label for="pq-type">Type de réponse</label>
      <select id="pq-type" onchange="pqSynchroType()">
        <option value="unique" ${o.type === 'unique' ? 'selected' : ''}>Choix unique (une seule bonne réponse)</option>
        <option value="multiple" ${o.type === 'multiple' ? 'selected' : ''}>Choix multiple (plusieurs bonnes réponses possibles)</option>
      </select>
      <label>Réponses proposées — coche la ou les bonnes réponses</label>
      <div id="pq-options"></div>
      <button class="bouton" style="background:#eee;color:#333;margin-top:6px;" onclick="pqAjouterOption()">+ Ajouter une réponse</button>
      <p style="font-size:12px;color:#55636c;margin:6px 0 0;">Sans bonne réponse cochée, la question est posée mais n'est pas notée.</p>
      <div style="margin-top:12px;">
        <button class="bouton" id="pq-valider" onclick="pqEnregistrer()">Enregistrer</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#pq-form').innerHTML=''">Annuler</button>
        <span id="pq-erreur" style="color:#b3261e;margin-left:10px;font-size:13px;"></span>
      </div>
    </div>`;
  pqAfficherOptions();
  $('#pq-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pqAfficherOptions() {
  const unique = $('#pq-type').value === 'unique';
  $('#pq-options').innerHTML = PQ.ouvert.options.map((op, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
      <input type="${unique ? 'radio' : 'checkbox'}" name="pq-bonne" style="width:auto;flex:none;" ${op.correct ? 'checked' : ''} onchange="pqCocher(${i}, this.checked)" title="Bonne réponse">
      <input value="${esc(op.texte)}" style="flex:1;" placeholder="Texte de la réponse" oninput="PQ.ouvert.options[${i}].texte=this.value">
      <button class="bouton" style="padding:3px 8px;font-size:12px;background:#fdeeee;color:#b3261e;" onclick="pqRetirerOption(${i})">✕</button>
    </div>`).join('');
}
function pqCocher(i, coche) {
  const unique = $('#pq-type').value === 'unique';
  if (unique && coche) PQ.ouvert.options.forEach((o, k) => { o.correct = k === i; });
  else PQ.ouvert.options[i].correct = coche;
}
function pqAjouterOption() { PQ.ouvert.options.push({ texte: '', correct: false }); pqAfficherOptions(); }
function pqRetirerOption(i) { PQ.ouvert.options.splice(i, 1); pqAfficherOptions(); }
function pqSynchroType() {
  if ($('#pq-type').value === 'unique') { let vu = false; PQ.ouvert.options.forEach(o => { if (o.correct) { if (vu) o.correct = false; vu = true; } }); }
  pqAfficherOptions();
}

async function pqEnregistrer() {
  const o = PQ.ouvert;
  const theme = $('#pq-theme').value.trim(), libelle = $('#pq-libelle').value.trim(), type = $('#pq-type').value;
  const options = o.options.map(x => ({ texte: String(x.texte || '').trim(), correct: !!x.correct })).filter(x => x.texte);
  if (!theme || !libelle) { $('#pq-erreur').textContent = 'Le thème et la question sont obligatoires.'; return; }
  if (options.length < 2) { $('#pq-erreur').textContent = 'Il faut au moins deux réponses proposées.'; return; }
  if (type === 'unique' && options.filter(x => x.correct).length > 1) { $('#pq-erreur').textContent = 'Un choix unique ne peut avoir qu\'une bonne réponse.'; return; }
  const charge = { theme, libelle, type, options };
  let res;
  if (o.id) res = await supa.from('positionnement_questions').update(charge).eq('id', o.id);
  else {
    const dansTheme = PQ.questions.filter(q => q.theme === theme);
    charge.organisation_id = S.organisation.id;
    charge.ordre = (dansTheme.reduce((m, q) => Math.max(m, q.ordre || 0), 0)) + 10;
    res = await supa.from('positionnement_questions').insert(charge);
  }
  if (res.error) { DEBUG.erreur('pqEnregistrer', res.error); $('#pq-erreur').textContent = res.error.message; return; }
  toast('Question enregistrée.');
  $('#pq-form').innerHTML = '';
  await pqCharger();
}

async function pqBasculerActif(id) {
  const q = PQ.questions.find(x => x.id === id); if (!q) return;
  const { error } = await supa.from('positionnement_questions').update({ actif: !q.actif }).eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'erreur'); return; }
  await pqCharger();
}

async function pqSupprimer(id) {
  const q = PQ.questions.find(x => x.id === id); if (!q) return;
  if (!confirm(`Supprimer définitivement cette question ?\n\n${q.libelle}\n\nLes réponses déjà données par des stagiaires sont conservées. Pour simplement ne plus la poser, utilise « Désactiver ».`)) return;
  const { error } = await supa.from('positionnement_questions').delete().eq('id', id);
  if (error) { toast('Erreur : ' + error.message, 'erreur'); return; }
  await pqCharger();
}

async function pqDeplacer(id, sens) {
  const q = PQ.questions.find(x => x.id === id); if (!q) return;
  const liste = PQ.questions.filter(x => x.theme === q.theme);
  const i = liste.findIndex(x => x.id === id), j = i + sens;
  if (j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  const maj = liste.map((x, k) => ({ id: x.id, ordre: (k + 1) * 10 }));
  const resultats = await Promise.all(maj.map(x => supa.from('positionnement_questions').update({ ordre: x.ordre }).eq('id', x.id)));
  const err = resultats.find(r => r.error);
  if (err) { toast('Erreur : ' + err.error.message, 'erreur'); return; }
  await pqCharger();
}

async function pqImporterDepart() {
  if (typeof POSITIONNEMENT_DONNEES === 'undefined') { toast('Fichier des questions de départ introuvable (positionnement_donnees.js).', 'erreur'); return; }
  const existantes = new Set(PQ.questions.map(q => q.theme + '||' + q.libelle));
  const lignes = [];
  POSITIONNEMENT_DONNEES.forEach(t => t.questions.forEach((q, i) => {
    if (existantes.has(t.theme + '||' + q.libelle)) return;
    lignes.push({ organisation_id: S.organisation.id, theme: t.theme, libelle: q.libelle, type: q.type, options: q.options, ordre: (i + 1) * 10 });
  }));
  if (!lignes.length) { toast('Toutes les questions de départ sont déjà présentes.'); return; }
  if (!confirm(`Importer ${lignes.length} question(s) de départ (reprises de ton formulaire) ? Les questions déjà présentes ne sont pas dupliquées.`)) return;
  const { error } = await supa.from('positionnement_questions').insert(lignes);
  if (error) { DEBUG.erreur('pqImporterDepart', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast(`${lignes.length} question(s) importée(s). Vérifie les bonnes réponses signalées « à définir ».`);
  await pqCharger();
}

// ---------- URLs des QR codes personnels (utilisées par la convocation) ----------
function urlPositionnement(participant) {
  return new URL('positionnement.html', location.href).href.split('?')[0] + '?t=' + participant.token_acces;
}
function urlReglement(participant) {
  return new URL('reglement.html', location.href).href.split('?')[0] + '?t=' + participant.token_acces;
}

// ---------- Carte « Positionnement et règlement » dans la fiche session ----------
function rendrePositionnementSession() {
  const zone = $('#positionnement-session');
  if (!zone) return;
  const s = window.__sessionCourante, participants = window.__participantsCourants || [];
  const theme = s?.formations_catalogue?.theme_positionnement;
  if (participants.length && participants[0].token_acces === undefined) {
    zone.innerHTML = '<h3 style="margin-top:0;">Positionnement et règlement intérieur</h3><p style="color:#55636c;font-size:13px;">Indisponible : le patch SQL « positionnement / règlement » n\'a pas encore été exécuté dans Supabase.</p>';
    return;
  }
  const repondus = participants.filter(p => p.positionnement_le);
  const reglOk = participants.filter(p => p.reglement_accepte_le);
  // synthèse par question (taux de bonnes réponses), à partir des détails enregistrés
  const parQ = new Map();
  repondus.forEach(p => (p.positionnement || []).forEach(d => {
    const e = parQ.get(d.question_id) || { libelle: d.libelle, ok: 0, notees: 0, n: 0 };
    e.n++; if (d.correct !== null && d.correct !== undefined) { e.notees++; if (d.correct) e.ok++; }
    parQ.set(d.question_id, e);
  }));
  const synth = [...parQ.values()];
  const ligne = (p) => {
    const nom = esc(`${p.stagiaires?.nom || ''} ${p.stagiaires?.prenom || ''}`.trim());
    const pos = p.positionnement_le
      ? `<strong>${p.positionnement_total ? p.positionnement_score + ' / ' + p.positionnement_total : 'non noté'}</strong> <span style="color:#55636c;font-size:12px;">le ${new Date(p.positionnement_le).toLocaleDateString('fr-FR')}</span> <a href="#" onclick="pqDetailParticipant('${p.id}');return false;">détail</a>`
      : '<span style="color:#8a5a00;">pas encore répondu</span>';
    const reg = p.reglement_accepte_le ? `✔ ${new Date(p.reglement_accepte_le).toLocaleDateString('fr-FR')}` : '<span style="color:#8a5a00;">—</span>';
    return `<tr><td style="padding:4px 8px;">${nom}</td><td style="padding:4px 8px;">${pos}</td><td style="padding:4px 8px;">${reg}</td></tr>`;
  };
  zone.innerHTML = `
    <h3 style="margin-top:0;">Positionnement et règlement intérieur</h3>
    <p style="font-size:13px;color:#55636c;margin:0 0 8px;">Thème : <strong>${esc(theme || 'aucun (à définir dans la fiche catalogue)')}</strong> —
      positionnement : ${repondus.length} / ${participants.length} réponse(s) — règlement : ${reglOk.length} / ${participants.length} prise(s) de connaissance.
      Chaque stagiaire scanne le QR code personnel de <em>sa</em> convocation.</p>
    ${participants.length ? `<table style="border-collapse:collapse;font-size:13px;width:100%;max-width:720px;">
      <tr style="text-align:left;border-bottom:1px solid #ddd;"><th style="padding:4px 8px;">Stagiaire</th><th style="padding:4px 8px;">Positionnement</th><th style="padding:4px 8px;">Règlement lu</th></tr>
      ${participants.map(ligne).join('')}</table>` : '<p style="color:#55636c;font-size:13px;">Aucun stagiaire inscrit.</p>'}
    ${synth.length ? `<h4 style="margin:14px 0 6px;">Questions les moins réussies (pour adapter la formation)</h4>
      <div style="font-size:13px;">${synth.filter(e => e.notees).sort((a, b) => (a.ok / a.notees) - (b.ok / b.notees)).slice(0, 8).map(e => {
        const pct = Math.round(100 * e.ok / e.notees);
        return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;"><span style="width:44px;text-align:right;color:${pct < 50 ? '#b3261e' : '#1b6e3c'};font-weight:600;">${pct} %</span><span>${esc(e.libelle)} <span style="color:#55636c;">(${e.ok}/${e.notees})</span></span></div>`;
      }).join('')}</div>` : ''}
    <div id="pq-detail"></div>`;
}

function pqDetailParticipant(id) {
  const p = (window.__participantsCourants || []).find(x => x.id === id); if (!p) return;
  const nom = esc(`${p.stagiaires?.prenom || ''} ${p.stagiaires?.nom || ''}`.trim());
  $('#pq-detail').innerHTML = `
    <div style="border:1px solid #d7dee3;border-radius:8px;padding:10px 12px;margin-top:12px;background:#fcfcfd;">
      <div style="display:flex;justify-content:space-between;"><strong>Réponses de ${nom}</strong><a href="#" onclick="$('#pq-detail').innerHTML='';return false;">fermer</a></div>
      ${(p.positionnement || []).map((d, i) => `
        <div style="font-size:13px;margin-top:6px;">
          <span style="color:${d.correct === true ? '#1b6e3c' : d.correct === false ? '#b3261e' : '#55636c'};font-weight:700;">${d.correct === true ? '✔' : d.correct === false ? '✘' : '•'}</span>
          ${i + 1}. ${esc(d.libelle)}<br><span style="color:#55636c;margin-left:18px;">→ ${(d.reponses || []).map(esc).join(' ; ')}</span>
        </div>`).join('')}
    </div>`;
}

// ---------- Règlement intérieur de l'organisme (carte dans l'écran Organisme) ----------
function carteReglementInterieur(org) {
  return `
    <div class="carte" id="og-reglement-carte">
      <h3 style="margin-top:0;">Règlement intérieur</h3>
      <p style="font-size:13px;color:#55636c;margin:0 0 8px;">Texte présenté aux stagiaires quand ils scannent le QR code « règlement » de leur convocation. Leur prise de connaissance est enregistrée (date, heure, empreinte du texte accepté). Si tu modifies le texte, les prochaines confirmations porteront sur la nouvelle version.</p>
      <textarea id="og-reglement" rows="14" placeholder="Colle ici le texte de ton règlement intérieur…">${esc(org.reglement_interieur || '')}</textarea>
      <button class="bouton" style="margin-top:8px;" onclick="enregistrerReglementInterieur()">Enregistrer le règlement</button>
      <span id="og-reglement-erreur" style="color:#b3261e;margin-left:10px;font-size:13px;"></span>
    </div>`;
}

async function enregistrerReglementInterieur() {
  const texte = $('#og-reglement').value.trim() || null;
  const { error } = await supa.from('organisations').update({ reglement_interieur: texte }).eq('id', S.organisation.id);
  if (error) { DEBUG.erreur('enregistrerReglementInterieur', error); $('#og-reglement-erreur').textContent = error.message; return; }
  S.organisation.reglement_interieur = texte;
  $('#og-reglement-erreur').textContent = '';
  toast('Règlement intérieur enregistré.');
}
