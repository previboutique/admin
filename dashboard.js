// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// dashboard.js — écran Accueil : agenda des sessions à venir + recyclages à
// programmer (basé sur formations_catalogue.cycle_mois et les vues SQL
// v_dernieres_realisations / v_recyclages_a_programmer, voir supabase.sql §11).

const HORIZON_RELANCE_JOURS = 90;

function formatDateFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function ecranAccueil(vue) {
  vue.innerHTML = `
    <div class="carte">
      <h2 style="margin-top:0;">Bienvenue, ${esc(S.profil.prenom || '')}</h2>
      <p style="margin:0;color:#55636c;">Organisation : <strong>${esc(S.organisation.raison_sociale)}</strong> — rôle : ${esc(S.profil.role)}</p>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Sessions à venir</h3>
      <div id="db-agenda">Chargement…</div>
    </div>
    <div class="carte">
      <h3 style="margin-top:0;">Recyclages à programmer <span style="font-weight:400;font-size:13px;color:#55636c;">(échéance dans les ${HORIZON_RELANCE_JOURS} jours, ou dépassée)</span></h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
        <div style="flex:1;min-width:200px;">
          <input id="db-recyclages-texte" placeholder="Filtrer par stagiaire, client ou formation…" oninput="filtrerEtAfficherRecyclages()">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-weight:normal;white-space:nowrap;">
          <input type="checkbox" id="db-recyclages-masquer-relances" style="width:auto;" onchange="filtrerEtAfficherRecyclages()">
          Masquer les relances déjà effectuées
        </label>
      </div>
      <div id="db-recyclages">Chargement…</div>
    </div>`;

  chargerAgenda();
  chargerRecyclages();
}

async function chargerAgenda() {
  const zone = $('#db-agenda');
  const { data, error } = await supa
    .from('sessions_formation')
    .select('id, date_debut, date_fin, lieu, statut, formations_catalogue(denomination), clients(raison_sociale)')
    .gte('date_debut', new Date().toISOString().slice(0, 10))
    .neq('statut', 'annulee')
    .order('date_debut', { ascending: true })
    .limit(20);

  if (error) { DEBUG.erreur('chargerAgenda', error); zone.textContent = 'Erreur de chargement.'; return; }
  if (!data || data.length === 0) { zone.innerHTML = '<p style="color:#55636c;">Aucune session à venir.</p>'; return; }

  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
      <th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Formation</th>
      <th style="padding:6px 8px;">Client</th><th style="padding:6px 8px;">Lieu</th><th style="padding:6px 8px;">Statut</th>
    </tr></thead>
    <tbody>${data.map(s => `
      <tr style="border-top:1px solid #eee;cursor:pointer;" onclick="ouvrirSession('${s.id}')">
        <td style="padding:6px 8px;">${formatDateFr(s.date_debut)}${s.date_fin && s.date_fin !== s.date_debut ? ' → ' + formatDateFr(s.date_fin) : ''}</td>
        <td style="padding:6px 8px;">${esc(s.formations_catalogue?.denomination || '')}</td>
        <td style="padding:6px 8px;">${esc(s.clients?.raison_sociale || '—')}</td>
        <td style="padding:6px 8px;">${esc(s.lieu || '—')}</td>
        <td style="padding:6px 8px;">${esc(s.statut)}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

window.__recyclagesTous = [];
window.__recyclagesRelanceIndex = {};

async function chargerRecyclages() {
  const zone = $('#db-recyclages');
  const limite = new Date();
  limite.setDate(limite.getDate() + HORIZON_RELANCE_JOURS);
  const limiteIso = limite.toISOString().slice(0, 10);

  const [{ data, error }, { data: relances }] = await Promise.all([
    supa.from('v_recyclages_a_programmer').select('*').lte('date_echeance', limiteIso).order('date_echeance', { ascending: true }),
    supa.from('relances_recyclage').select('stagiaire_id, formation_id, date_echeance, date_relance'),
  ]);

  if (error) { DEBUG.erreur('chargerRecyclages', error); zone.textContent = 'Erreur de chargement.'; return; }

  // Relances déjà effectuées, pour affichage (pas de suppression de la ligne :
  // on garde la visibilité, mais on indique qu'elle a déjà été relancée).
  const relanceIndex = {};
  (relances || []).forEach(r => { relanceIndex[`${r.stagiaire_id}|${r.formation_id}|${r.date_echeance}`] = r.date_relance; });

  window.__recyclagesTous = data || [];
  window.__recyclagesRelanceIndex = relanceIndex;
  filtrerEtAfficherRecyclages();
}

function filtrerEtAfficherRecyclages() {
  const zone = $('#db-recyclages');
  if (!zone) return;

  const texte = ($('#db-recyclages-texte')?.value || '').trim().toLowerCase();
  const masquerRelances = $('#db-recyclages-masquer-relances')?.checked || false;
  const relanceIndex = window.__recyclagesRelanceIndex || {};
  const today = new Date().toISOString().slice(0, 10);

  const data = (window.__recyclagesTous || []).filter(r => {
    const cle = `${r.stagiaire_id}|${r.formation_a_programmer_id}|${r.date_echeance}`;
    if (masquerRelances && relanceIndex[cle]) return false;
    if (texte) {
      const cible = [r.prenom || '', r.nom || '', r.client_nom || '', r.formation_a_programmer_denomination || ''].join(' ').toLowerCase();
      if (!cible.includes(texte)) return false;
    }
    return true;
  });

  if (data.length === 0) {
    zone.innerHTML = (window.__recyclagesTous || []).length === 0
      ? '<p style="color:#55636c;">Aucun recyclage à programmer d\'ici ' + HORIZON_RELANCE_JOURS + ' jours.</p>'
      : '<p style="color:#55636c;">Aucun recyclage ne correspond à ces critères.</p>';
    return;
  }

  zone.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead><tr style="text-align:left;color:#55636c;font-size:12px;">
      <th style="padding:6px 8px;">Échéance</th><th style="padding:6px 8px;">Stagiaire</th>
      <th style="padding:6px 8px;">Client</th><th style="padding:6px 8px;">Formation à programmer</th><th style="padding:6px 8px;"></th>
    </tr></thead>
    <tbody>${data.map(r => {
      const cle = `${r.stagiaire_id}|${r.formation_a_programmer_id}|${r.date_echeance}`;
      const dejaRelance = relanceIndex[cle];
      const enRetard = r.date_echeance < today;
      return `
      <tr style="border-top:1px solid #eee;">
        <td style="padding:6px 8px;${enRetard ? 'color:#b3261e;font-weight:600;' : ''}">${formatDateFr(r.date_echeance)}${enRetard ? ' (dépassée)' : ''}</td>
        <td style="padding:6px 8px;">${esc(r.prenom)} ${esc(r.nom)}</td>
        <td style="padding:6px 8px;">${esc(r.client_nom || '—')}</td>
        <td style="padding:6px 8px;">${esc(r.formation_a_programmer_denomination)}</td>
        <td style="padding:6px 8px;">${dejaRelance
          ? '<span style="color:#0a5c8a;font-size:12px;">Relancé le ' + formatDateFr(dejaRelance.slice(0, 10)) + '</span>'
          : `<button class="bouton" style="padding:5px 10px;font-size:12px;" onclick="marquerRelance('${r.stagiaire_id}','${r.formation_a_programmer_id}','${r.date_echeance}')">Marquer relancé</button>`}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

async function marquerRelance(stagiaireId, formationId, dateEcheance) {
  const { error } = await supa.from('relances_recyclage').insert({
    organisation_id: S.organisation.id,
    stagiaire_id: stagiaireId,
    formation_id: formationId,
    date_echeance: dateEcheance,
    effectuee_par: S.profil.id,
  });
  if (error) { DEBUG.erreur('marquerRelance', error); toast('Erreur : ' + error.message, 'erreur'); return; }
  toast('Relance enregistrée.');
  chargerRecyclages();
}
