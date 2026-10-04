// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// catalogue.js — écran Catalogue : CRUD des formations (formations_catalogue).
// Réservé à admin/gestionnaire (RLS : write réservée à admin sur cette table
// via la policy générique organisation_id — pas de restriction par rôle ici,
// contrairement à sessions_formation).

function lignesVersJsonb(texte) {
  return (texte || '').split('\n').map(l => l.trim()).filter(Boolean);
}
function jsonbVersLignes(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map(v => (typeof v === 'object' && v !== null) ? (v.libelle || '') : v).filter(Boolean).join('\n');
}
function lignesVersCompetences(texte) {
  return lignesVersJsonb(texte).map(libelle => ({ libelle }));
}

async function ecranCatalogue(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Catalogue de formations</h2>
      <button class="bouton" onclick="ouvrirFormFormation(null)">+ Nouvelle formation</button>
    </div>
    <div class="carte"><div id="catalogue-liste">Chargement…</div></div>
    <div id="catalogue-form"></div>`;

  await chargerCatalogue();
}

async function chargerCatalogue() {
  const zone = $('#catalogue-liste');
  const { data, error } = await supa
    .from('formations_catalogue')
    .select('*')
    .order('categorie')
    .order('denomination');

  if (error) { DEBUG.erreur('chargerCatalogue', error); zone.textContent = 'Erreur de chargement.'; return; }
  window.__catalogueCourant = data || [];
  const { data: fam } = await supa.from('familles_formation').select('id, nom, fiabilite').eq('actif', true).order('nom');
  window.__famillesCatalogue = fam || [];
  const { data: themesPos } = await supa.from('positionnement_questions').select('theme');
  window.__themesPositionnement = [...new Set((themesPos || []).map(x => x.theme))].sort((a, b) => a.localeCompare(b, 'fr'));

  if (!data || data.length === 0) { zone.innerHTML = '<p style="color:#55636c;">Aucune formation au catalogue.</p>'; return; }

  const parCategorie = {};
  data.forEach(f => { (parCategorie[f.categorie] = parCategorie[f.categorie] || []).push(f); });

  zone.innerHTML = Object.entries(parCategorie).map(([cat, formations]) => `
    <h3 style="font-size:14px;color:#55636c;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.03em;">${esc(cat)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:6px;">
      <tbody>${formations.map(f => `
        <tr style="border-top:1px solid #eee;${f.actif ? '' : 'opacity:.5;'}">
          <td style="padding:6px 8px;width:90px;color:#55636c;">${esc(f.code)}</td>
          <td style="padding:6px 8px;">${esc(f.denomination)}
            ${f.famille_id ? `<div style="font-size:11px;color:#55636c;margin-top:2px;">Codes Passeport : ${esc((window.__famillesCatalogue.find(g => g.id === f.famille_id) || {}).nom || '—')}</div>` : (window.__famillesCatalogue.length ? '<div style="font-size:11px;color:#8a5a00;margin-top:2px;">Aucune famille de codes Passeport</div>' : '')}
            ${f.type_formation === 'recyclage'
              ? `<span style="font-size:11px;background:#e3f6ee;color:#1a7f3c;border-radius:10px;padding:1px 8px;margin-left:6px;">Recyclage${f.formation_initiale_id ? ' de ' + esc((data.find(x => x.id === f.formation_initiale_id) || {}).denomination || '?') : ' — initiale à définir'}</span>`
              : '<span style="font-size:11px;background:#e8f0fb;color:#2a78d6;border-radius:10px;padding:1px 8px;margin-left:6px;">Initiale</span>'}
          </td>
          <td style="padding:6px 8px;width:120px;">${(f.prix_individuel != null || f.prix_groupe != null)
            ? `Ind. ${f.prix_individuel != null ? f.prix_individuel + ' €' : '—'} / Grp ${f.prix_groupe != null ? f.prix_groupe + ' €' : '—'}`
            : (f.prix != null ? f.prix + ' €' : '—')}</td>
          <td style="padding:6px 8px;width:70px;">${f.duree_heures != null ? f.duree_heures + ' h' : '—'}</td>
          <td style="padding:6px 8px;width:110px;">${f.cycle_mois ? 'recyclage ' + f.cycle_mois + ' mois' : '—'}</td>
          <td style="padding:6px 8px;width:60px;">${f.actif ? '' : '<span style="color:#b3261e;">inactif</span>'}</td>
          <td style="padding:6px 8px;width:70px;text-align:right;">
            <button class="bouton" style="padding:4px 10px;font-size:12px;" onclick="ouvrirFormFormation('${f.id}')">Modifier</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`).join('');
}

// Recopie le contenu pédagogique d'une autre formation du catalogue dans le
// formulaire en cours (ne touche ni code, ni catégorie, ni dénomination, ni
// tarifs, ni durée — un recyclage a souvent une durée différente de sa
// formation initiale même quand les compétences visées sont identiques).
// Purement côté formulaire : rien n'est enregistré tant que l'utilisateur ne
// clique pas sur "Enregistrer".
function copierContenuPedagogique() {
  const id = $('#cf-copier-source').value;
  if (!id) return;
  const source = (window.__catalogueCourant || []).find(x => x.id === id);
  if (!source) return;

  $('#cf-objectifs').value = source.objectifs || '';
  $('#cf-programme').value = source.programme_methode || '';
  $('#cf-evaluation').value = source.evaluation || '';
  $('#cf-consignes').value = source.consignes_convocation || '';
  $('#cf-conditions').value = jsonbVersLignes(source.conditions_realisation);
  $('#cf-rappel-competences').value = source.rappel_competences || '';
  $('#cf-competences').value = jsonbVersLignes(source.competences);
  $('#cf-pedagogie').value = jsonbVersLignes(source.pedagogie);
  $('#cf-materiel').value = jsonbVersLignes(source.materiel);

  toast('Contenu pédagogique copié — vérifie puis clique sur Enregistrer.');
}

function ouvrirFormFormation(id) {
  const f = id ? window.__catalogueCourant.find(x => x.id === id) : null;
  const autres = window.__catalogueCourant.filter(x => x.id !== id);

  const zone = $('#catalogue-form');
  zone.innerHTML = `
    <div class="carte" style="max-width:640px;">
      <h3 style="margin-top:0;">${f ? 'Modifier' : 'Nouvelle'} formation</h3>

      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="cf-code">Code</label>
          <input id="cf-code" value="${f ? esc(f.code) : ''}" placeholder="ex. SSTi">
        </div>
        <div style="flex:2;">
          <label for="cf-categorie">Catégorie</label>
          <input id="cf-categorie" value="${f ? esc(f.categorie) : ''}" placeholder="ex. Secourisme" list="cf-categories">
          <datalist id="cf-categories">${[...new Set(window.__catalogueCourant.map(x => x.categorie))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        </div>
      </div>

      <label for="cf-denomination">Dénomination</label>
      <input id="cf-denomination" value="${f ? esc(f.denomination) : ''}">

      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="cf-prix">Prix (€) — tarif unique</label>
          <input id="cf-prix" type="number" step="0.01" value="${f && f.prix != null ? f.prix : ''}">
        </div>
        <div style="flex:1;">
          <label for="cf-duree">Durée (heures)</label>
          <input id="cf-duree" type="number" step="0.5" value="${f && f.duree_heures != null ? f.duree_heures : ''}">
        </div>
        <div style="flex:1;">
          <label for="cf-cycle">Cycle recyclage (mois)</label>
          <input id="cf-cycle" type="number" value="${f && f.cycle_mois != null ? f.cycle_mois : ''}" placeholder="vide = pas de recyclage">
        </div>
      </div>

      <p style="font-size:12px;color:#55636c;margin:10px 0 2px;">Si cette formation se propose à la fois en individuel et en groupe (tarifs différents), renseigne les deux prix ci-dessous — ils remplacent alors le "Prix" unique ci-dessus pour la création d'une session.</p>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label for="cf-prix-individuel">Prix individuel (€)</label>
          <input id="cf-prix-individuel" type="number" step="0.01" value="${f && f.prix_individuel != null ? f.prix_individuel : ''}">
        </div>
        <div style="flex:1;">
          <label for="cf-prix-groupe">Prix groupe (€)</label>
          <input id="cf-prix-groupe" type="number" step="0.01" value="${f && f.prix_groupe != null ? f.prix_groupe : ''}">
        </div>
      </div>

      <div style="margin-top:12px;padding:10px 12px;background:#f6f8fa;border-radius:8px;">
        <strong style="font-size:13px;">Type de formation</strong>
        <div style="display:flex;gap:20px;margin-top:6px;">
          <label style="display:flex;align-items:center;gap:6px;font-weight:normal;margin:0;color:inherit;">
            <input type="radio" name="cf-type" id="cf-type-initiale" value="initiale" style="width:auto;" ${!f || f.type_formation !== 'recyclage' ? 'checked' : ''}> Formation initiale
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:normal;margin:0;color:inherit;">
            <input type="radio" name="cf-type" id="cf-type-recyclage" value="recyclage" style="width:auto;" ${f && f.type_formation === 'recyclage' ? 'checked' : ''}> Recyclage
          </label>
        </div>
        <div id="cf-initiale-bloc" style="display:${f && f.type_formation === 'recyclage' ? 'block' : 'none'};">
          <label for="cf-initiale">Recyclage de la formation initiale</label>
          <select id="cf-initiale">
            <option value="">— choisir la formation initiale —</option>
            ${autres.filter(a => a.type_formation !== 'recyclage').map(a => `<option value="${a.id}" ${f && f.formation_initiale_id === a.id ? 'selected' : ''}>${esc(a.denomination)} (${esc(a.code)})</option>`).join('')}
          </select>
        </div>
        <p style="font-size:12px;color:#55636c;margin:6px 0 0;">Sert à la Synthèse de session (résultats initiaux / recyclage) et regroupe un recyclage avec sa formation initiale.</p>
      </div>

      <label for="cf-recyclage">Formation à programmer au recyclage</label>
      <select id="cf-recyclage">
        <option value="">— elle-même / non défini —</option>
        ${autres.map(a => `<option value="${a.id}" ${f && f.formation_recyclage_id === a.id ? 'selected' : ''}>${esc(a.denomination)} (${esc(a.code)})</option>`).join('')}
      </select>

      <label style="display:flex;align-items:center;gap:8px;font-weight:normal;margin-top:12px;">
        <input type="checkbox" id="cf-forprev" style="width:auto;" ${f && f.declaration_forprev ? 'checked' : ''}> Déclaration ForePrev (SST, MAC SST…)
      </label>
      <p style="font-size:12px;color:#55636c;margin:2px 0 0;">Si coché, les champs « n° de session ForePrev » et « date de déclaration » apparaissent dans les sessions de cette formation.</p>

      <label for="cf-theme-pos">Thème du questionnaire de positionnement (QR code de la convocation)</label>
      <input id="cf-theme-pos" list="cf-themes-pos" value="${f ? esc(f.theme_positionnement || '') : ''}" placeholder="— aucun questionnaire —">
      <datalist id="cf-themes-pos">${(window.__themesPositionnement || []).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <p style="font-size:12px;color:#55636c;margin:2px 0 0;">Les questions de ce thème se gèrent dans l'onglet « Positionnement ». Laisser vide = pas de questionnaire pour cette formation.</p>

      ${(window.__famillesCatalogue || []).length ? `
      <label for="cf-famille">Famille de codes Passeport de prévention (NSF, Formacode, ROME, RS)</label>
      <select id="cf-famille">
        <option value="">— aucune famille —</option>
        ${window.__famillesCatalogue.map(g => `<option value="${g.id}" ${f && f.famille_id === g.id ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}
      </select>
      <p style="font-size:12px;color:#55636c;margin:2px 0 0;">Une formation et son recyclage (ex. SST et MAC SST) partagent la même famille : les codes se gèrent dans l'onglet « Familles &amp; codes ».</p>` : ''}

      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid #eee;">
        <div style="flex:1;">
          <label for="cf-copier-source">Copier le contenu pédagogique depuis une autre formation</label>
          <select id="cf-copier-source">
            <option value="">— Choisir une formation —</option>
            ${autres.map(a => `<option value="${a.id}">${esc(a.denomination)} (${esc(a.code)})</option>`).join('')}
          </select>
        </div>
        <button class="bouton" type="button" style="background:#eee;color:#333;padding:8px 14px;" onclick="copierContenuPedagogique()">Copier</button>
      </div>
      <p style="font-size:12px;color:#55636c;margin:2px 0 12px;">Remplit Objectifs, Programme, Évaluation, Consignes, Conditions, Rappel des compétences, Compétences visées, Moyens pédagogiques et Matériel depuis la formation choisie (utile pour un recyclage qui reprend les mêmes compétences que sa formation initiale) — relis avant d'Enregistrer, rien n'est copié tant que tu n'as pas cliqué.</p>

      <label for="cf-objectifs">Objectifs</label>
      <textarea id="cf-objectifs" rows="3">${f ? esc(f.objectifs) : ''}</textarea>

      <label for="cf-programme">Programme / méthode</label>
      <textarea id="cf-programme" rows="3">${f ? esc(f.programme_methode) : ''}</textarea>

      <label for="cf-evaluation">Évaluation</label>
      <textarea id="cf-evaluation" rows="2">${f ? esc(f.evaluation) : ''}</textarea>

      <label for="cf-consignes">Consignes de convocation (une par ligne)</label>
      <textarea id="cf-consignes" rows="2">${f ? esc(f.consignes_convocation) : ''}</textarea>

      <label for="cf-conditions">Conditions de réalisation (une par ligne)</label>
      <textarea id="cf-conditions" rows="2">${f ? esc(jsonbVersLignes(f.conditions_realisation)) : ''}</textarea>

      <label for="cf-rappel-competences">Rappel des compétences (paragraphe affiché sur l'Attestation de fin de formation)</label>
      <textarea id="cf-rappel-competences" rows="3">${f ? esc(f.rappel_competences) : ''}</textarea>

      <label for="cf-competences">Compétences visées / FISE (une par ligne)</label>
      <textarea id="cf-competences" rows="4">${f ? esc(jsonbVersLignes(f.competences)) : ''}</textarea>

      <label for="cf-pedagogie">Moyens pédagogiques (un par ligne)</label>
      <textarea id="cf-pedagogie" rows="2">${f ? esc(jsonbVersLignes(f.pedagogie)) : ''}</textarea>

      <label for="cf-materiel">Matériel nécessaire (un par ligne)</label>
      <textarea id="cf-materiel" rows="2">${f ? esc(jsonbVersLignes(f.materiel)) : ''}</textarea>

      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;">
        <input type="checkbox" id="cf-actif" style="width:auto;" ${!f || f.actif ? 'checked' : ''}>
        <span>Formation active (proposable pour une nouvelle session)</span>
      </label>

      <div style="margin-top:16px;">
        <button class="bouton" id="cf-valider">Enregistrer</button>
        <button class="bouton" style="background:#eee;color:#333;margin-left:8px;" onclick="$('#catalogue-form').innerHTML=''">Annuler</button>
      </div>
      <div class="erreur" id="cf-erreur"></div>
    </div>`;

  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.querySelectorAll('input[name="cf-type"]').forEach(r => {
    r.onchange = () => { $('#cf-initiale-bloc').style.display = $('#cf-type-recyclage').checked ? 'block' : 'none'; };
  });

  $('#cf-valider').onclick = async () => {
    const payload = {
      organisation_id: S.organisation.id,
      code: $('#cf-code').value.trim(),
      categorie: $('#cf-categorie').value.trim(),
      denomination: $('#cf-denomination').value.trim(),
      prix: $('#cf-prix').value ? Number($('#cf-prix').value) : null,
      prix_individuel: $('#cf-prix-individuel').value ? Number($('#cf-prix-individuel').value) : null,
      prix_groupe: $('#cf-prix-groupe').value ? Number($('#cf-prix-groupe').value) : null,
      duree_heures: $('#cf-duree').value ? Number($('#cf-duree').value) : null,
      cycle_mois: $('#cf-cycle').value ? Number($('#cf-cycle').value) : null,
      formation_recyclage_id: $('#cf-recyclage').value || null,
      type_formation: $('#cf-type-recyclage').checked ? 'recyclage' : 'initiale',
      formation_initiale_id: $('#cf-type-recyclage').checked ? ($('#cf-initiale').value || null) : null,
      objectifs: $('#cf-objectifs').value.trim() || null,
      programme_methode: $('#cf-programme').value.trim() || null,
      evaluation: $('#cf-evaluation').value.trim() || null,
      consignes_convocation: $('#cf-consignes').value.trim() || null,
      rappel_competences: $('#cf-rappel-competences').value.trim() || null,
      conditions_realisation: lignesVersJsonb($('#cf-conditions').value),
      competences: lignesVersCompetences($('#cf-competences').value),
      pedagogie: lignesVersJsonb($('#cf-pedagogie').value),
      materiel: lignesVersJsonb($('#cf-materiel').value),
      actif: $('#cf-actif').checked,
    };

    if ($('#cf-famille')) payload.famille_id = $('#cf-famille').value || null;
    // n'écrit le thème que si la colonne existe (patch SQL exécuté), pour ne jamais bloquer l'enregistrement d'une fiche
    if ((window.__catalogueCourant || []).length && 'declaration_forprev' in window.__catalogueCourant[0]) payload.declaration_forprev = $('#cf-forprev').checked;
    if ((window.__catalogueCourant || []).length && 'theme_positionnement' in window.__catalogueCourant[0]) payload.theme_positionnement = $('#cf-theme-pos').value.trim() || null;

    if (!payload.code || !payload.categorie || !payload.denomination) {
      $('#cf-erreur').textContent = 'Code, catégorie et dénomination sont obligatoires.';
      return;
    }

    if (payload.type_formation === 'recyclage' && !payload.formation_initiale_id) {
      $('#cf-erreur').textContent = 'Pour un recyclage, choisis sa formation initiale.';
      return;
    }

    const req = f
      ? supa.from('formations_catalogue').update(payload).eq('id', f.id).select('id').single()
      : supa.from('formations_catalogue').insert(payload).select('id').single();

    const { data: enregistree, error } = await req;
    if (error) {
      DEBUG.erreur('enregistrerFormation', error);
      $('#cf-erreur').textContent = error.code === '23505'
        ? 'Ce code existe déjà dans le catalogue.'
        : 'Erreur : ' + error.message;
      return;
    }
    // Un recyclage devient aussi "la formation à programmer au recyclage" de sa
    // formation initiale, si celle-ci n'en a pas encore (alimente la liste des
    // recyclages à programmer).
    if (payload.type_formation === 'recyclage' && payload.formation_initiale_id && enregistree?.id) {
      const initiale = window.__catalogueCourant.find(x => x.id === payload.formation_initiale_id);
      if (initiale && (!initiale.formation_recyclage_id || initiale.formation_recyclage_id === initiale.id)) {
        await supa.from('formations_catalogue').update({ formation_recyclage_id: enregistree.id }).eq('id', initiale.id);
      }
    }
    toast('Formation enregistrée.');
    $('#catalogue-form').innerHTML = '';
    chargerCatalogue();
  };
}
