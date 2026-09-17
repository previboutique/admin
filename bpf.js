// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// bpf.js — Bilan Pédagogique et Financier (BPF) : calcul automatique des
// totaux (stagiaires, heures, produits par origine de financement) à partir
// des sessions de l'exercice comptable, pour servir d'aide au remplissage de
// la déclaration officielle annuelle (CERFA 10443*17, à déposer avant le 30
// avril sur monactiviteformation.emploi.gouv.fr). Ce n'est PAS le formulaire
// officiel : un récapitulatif propre à l'appli, à vérifier avant de reporter
// les chiffres sur le site du gouvernement — notamment le total des charges
// et la part du chiffre d'affaires en formation professionnelle, que
// l'appli ne suit pas, ainsi que les catégories de stagiaires et les
// spécialités de formation, approximées automatiquement.

// Calcule les bornes [début, fin] de l'exercice comptable de l'organisation
// qui contient dateReference (aujourd'hui par défaut). L'exercice est
// paramétrable par organisme (organisations.exercice_jour_debut / _mois_debut).
function calculerBornesExercice(dateReference) {
  const jourDebut = S.organisation.exercice_jour_debut || 1;
  const moisDebut = S.organisation.exercice_mois_debut || 1;
  const ref = dateReference || new Date();
  let anneeDebut = ref.getFullYear();
  const debutCetteAnnee = new Date(anneeDebut, moisDebut - 1, jourDebut);
  if (ref < debutCetteAnnee) anneeDebut -= 1;
  const debut = new Date(anneeDebut, moisDebut - 1, jourDebut);
  const fin = new Date(anneeDebut + 1, moisDebut - 1, jourDebut - 1);
  return { debut: isoDateLocale(debut), fin: isoDateLocale(fin) };
}

function isoDateLocale(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function decalerExerciceBPF(dateDebutIso, delta) {
  const jourDebut = S.organisation.exercice_jour_debut || 1;
  const moisDebut = S.organisation.exercice_mois_debut || 1;
  const anneeActuelle = Number(dateDebutIso.slice(0, 4));
  const nouvelleAnnee = anneeActuelle + delta;
  const debut = new Date(nouvelleAnnee, moisDebut - 1, jourDebut);
  const fin = new Date(nouvelleAnnee + 1, moisDebut - 1, jourDebut - 1);
  return { debut: isoDateLocale(debut), fin: isoDateLocale(fin) };
}

async function ecranBPF(vue) {
  vue.innerHTML = `
    <div class="carte" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h2 style="margin:0;">Bilan Pédagogique et Financier (BPF)</h2>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="bouton" style="background:#eee;color:#333;padding:6px 12px;font-size:13px;" onclick="naviguerExerciceBPF(-1)">← Exercice précédent</button>
        <span id="bpf-libelle-exercice" style="font-size:13px;color:#55636c;"></span>
        <button class="bouton" style="background:#eee;color:#333;padding:6px 12px;font-size:13px;" onclick="naviguerExerciceBPF(1)">Exercice suivant →</button>
      </div>
    </div>
    <p style="font-size:13px;color:#55636c;margin:-4px 0 12px;">
      Ce récapitulatif calcule automatiquement les totaux à partir des sessions enregistrées sur l'exercice. Il ne remplace pas la déclaration officielle sur
      <a href="https://www.monactiviteformation.emploi.gouv.fr" target="_blank" rel="noopener">monactiviteformation.emploi.gouv.fr</a> —
      vérifie les chiffres avant de les reporter, notamment les catégories approximées automatiquement (type de stagiaire, spécialités).
    </p>
    <div id="bpf-contenu">Chargement…</div>`;

  window.__bpfExercice = calculerBornesExercice();
  await chargerEtAfficherBPF();
}

async function naviguerExerciceBPF(delta) {
  window.__bpfExercice = decalerExerciceBPF(window.__bpfExercice.debut, delta);
  await chargerEtAfficherBPF();
}

async function chargerEtAfficherBPF() {
  const { debut, fin } = window.__bpfExercice;
  $('#bpf-libelle-exercice').textContent = `Exercice du ${formatDateFr(debut)} au ${formatDateFr(fin)}`;
  const zone = $('#bpf-contenu');
  zone.innerHTML = 'Calcul en cours…';

  const { data: sessions, error } = await supa
    .from('sessions_formation')
    .select('id, date_debut, date_fin, prix_unitaire, origine_financement, sous_traitance_recue, formateur_id, formations_catalogue(denomination, categorie, duree_heures), profils:formateur_id(nom, prenom, formateur_externe)')
    .gte('date_debut', debut)
    .lte('date_debut', fin);

  if (error) { DEBUG.erreur('chargerBPF', error); zone.innerHTML = '<p class="erreur">Erreur de chargement.</p>'; return; }

  const sessionIds = (sessions || []).map(s => s.id);
  let participants = [];
  if (sessionIds.length) {
    const { data } = await supa.from('session_participants').select('session_id, statut, stagiaire_id').in('session_id', sessionIds);
    participants = data || [];
  }

  const donnees = calculerDonneesBPF(sessions || [], participants);
  window.__bpfDonnees = donnees;
  rendreBPF(donnees);
}

// Répartit approximativement le type de stagiaire (cadre F-1 du BPF) à
// partir de l'origine de financement de la session — l'appli ne distingue
// pas autrement un salarié d'un demandeur d'emploi ou d'un particulier.
const CATEGORIE_STAGIAIRE_PAR_ORIGINE = {
  entreprise: 'a',
  apprentissage: 'b',
  recherche_emploi: 'c',
  particulier: 'd',
};

function calculerDonneesBPF(sessions, participants) {
  const parSession = {};
  sessions.forEach(s => { parSession[s.id] = s; });

  // C. Produits par origine de financement
  const produitsParOrigine = {};
  let totalProduits = 0;
  sessions.forEach(s => {
    const montant = Number(s.prix_unitaire) || 0;
    produitsParOrigine[s.origine_financement] = (produitsParOrigine[s.origine_financement] || 0) + montant;
    totalProduits += montant;
  });

  // E. Personnes dispensant des heures de formation (formateurs distincts, internes/externes)
  const formateurs = {};
  sessions.forEach(s => {
    if (!s.formateur_id) return;
    const heures = Number(s.formations_catalogue?.duree_heures) || 0;
    if (!formateurs[s.formateur_id]) formateurs[s.formateur_id] = { externe: !!s.profils?.formateur_externe, heures: 0 };
    formateurs[s.formateur_id].heures += heures;
  });
  const formateursInternes = Object.values(formateurs).filter(f => !f.externe);
  const formateursExternes = Object.values(formateurs).filter(f => f.externe);

  // F. Stagiaires (hors sous-traitance reçue — celle-ci va au cadre G)
  const f1 = { a: { nb: 0, heures: 0 }, b: { nb: 0, heures: 0 }, c: { nb: 0, heures: 0 }, d: { nb: 0, heures: 0 }, e: { nb: 0, heures: 0 } };
  const specialites = {};
  let totalStagiairesF = 0, totalHeuresF = 0;

  participants.forEach(p => {
    const s = parSession[p.session_id];
    if (!s || s.sous_traitance_recue) return;
    const heures = Number(s.formations_catalogue?.duree_heures) || 0;
    const cat = CATEGORIE_STAGIAIRE_PAR_ORIGINE[s.origine_financement] || 'e';
    f1[cat].nb += 1; f1[cat].heures += heures;
    totalStagiairesF += 1; totalHeuresF += heures;

    const specLibelle = s.formations_catalogue?.categorie || 'Non renseignée';
    if (!specialites[specLibelle]) specialites[specLibelle] = { nb: 0, heures: 0 };
    specialites[specLibelle].nb += 1;
    specialites[specLibelle].heures += heures;
  });

  // G. Sous-traitance reçue (formation confiée par un autre organisme)
  let stagiairesG = 0, heuresG = 0;
  participants.forEach(p => {
    const s = parSession[p.session_id];
    if (!s || !s.sous_traitance_recue) return;
    stagiairesG += 1;
    heuresG += Number(s.formations_catalogue?.duree_heures) || 0;
  });

  return {
    totalProduits, produitsParOrigine,
    formateursInternes: formateursInternes.length,
    heuresFormateursInternes: formateursInternes.reduce((a, f) => a + f.heures, 0),
    formateursExternes: formateursExternes.length,
    heuresFormateursExternes: formateursExternes.reduce((a, f) => a + f.heures, 0),
    f1, totalStagiairesF, totalHeuresF,
    specialites,
    stagiairesG, heuresG,
    nbSessions: sessions.length,
  };
}

function rendreBPF(d) {
  const zone = $('#bpf-contenu');

  const lignesOrigine = Object.entries(d.produitsParOrigine)
    .sort((a, b) => b[1] - a[1])
    .map(([o, montant]) => `<tr><td style="padding:4px 6px;">${esc(libelleOrigineFinancement(o))}</td><td style="padding:4px 6px;text-align:right;">${montant.toFixed(2)} €</td></tr>`).join('');

  const specialitesTriees = Object.entries(d.specialites).sort((a, b) => b[1].nb - a[1].nb).slice(0, 5);
  const lignesSpecialites = specialitesTriees
    .map(([lib, v]) => `<tr><td style="padding:4px 6px;">${esc(lib)}</td><td style="padding:4px 6px;text-align:right;">${v.nb}</td><td style="padding:4px 6px;text-align:right;">${v.heures}</td></tr>`).join('');

  zone.innerHTML = `
    <div class="carte">
      <h3 style="margin-top:0;">C. Produits par origine de financement (hors taxes)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tbody>${lignesOrigine || '<tr><td style="padding:4px 6px;color:#55636c;">Aucune session sur cet exercice.</td></tr>'}</tbody>
        <tfoot><tr style="border-top:2px solid #ddd;font-weight:600;"><td style="padding:6px;">Total</td><td style="padding:6px;text-align:right;">${d.totalProduits.toFixed(2)} €</td></tr></tfoot>
      </table>
      <p style="font-size:12px;color:#55636c;margin-top:8px;">Le total des charges et la part du chiffre d'affaires global réalisée en formation professionnelle ne sont pas suivis dans l'appli — à compléter à la main lors de la déclaration.</p>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">E. Personnes dispensant des heures de formation</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#55636c;text-align:left;"><th style="padding:4px 6px;"></th><th style="padding:4px 6px;text-align:right;">Nombre</th><th style="padding:4px 6px;text-align:right;">Heures dispensées</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 6px;">De l'organisme</td><td style="padding:4px 6px;text-align:right;">${d.formateursInternes}</td><td style="padding:4px 6px;text-align:right;">${d.heuresFormateursInternes}</td></tr>
          <tr><td style="padding:4px 6px;">Extérieures (sous-traitance)</td><td style="padding:4px 6px;text-align:right;">${d.formateursExternes}</td><td style="padding:4px 6px;text-align:right;">${d.heuresFormateursExternes}</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#55636c;margin-top:8px;">Un formateur est marqué "extérieur" sur son profil (colonne <code>profils.formateur_externe</code>, à cocher via Supabase pour l'instant) — à vérifier si le total ne correspond pas.</p>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">F. Stagiaires (hors sous-traitance reçue)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#55636c;text-align:left;"><th style="padding:4px 6px;"></th><th style="padding:4px 6px;text-align:right;">Stagiaires</th><th style="padding:4px 6px;text-align:right;">Heures suivies</th></tr></thead>
        <tbody>
          <tr><td style="padding:4px 6px;">Salariés d'employeurs privés</td><td style="padding:4px 6px;text-align:right;">${d.f1.a.nb}</td><td style="padding:4px 6px;text-align:right;">${d.f1.a.heures}</td></tr>
          <tr><td style="padding:4px 6px;">Apprentis</td><td style="padding:4px 6px;text-align:right;">${d.f1.b.nb}</td><td style="padding:4px 6px;text-align:right;">${d.f1.b.heures}</td></tr>
          <tr><td style="padding:4px 6px;">Personnes en recherche d'emploi</td><td style="padding:4px 6px;text-align:right;">${d.f1.c.nb}</td><td style="padding:4px 6px;text-align:right;">${d.f1.c.heures}</td></tr>
          <tr><td style="padding:4px 6px;">Particuliers à leurs frais</td><td style="padding:4px 6px;text-align:right;">${d.f1.d.nb}</td><td style="padding:4px 6px;text-align:right;">${d.f1.d.heures}</td></tr>
          <tr><td style="padding:4px 6px;">Autres stagiaires</td><td style="padding:4px 6px;text-align:right;">${d.f1.e.nb}</td><td style="padding:4px 6px;text-align:right;">${d.f1.e.heures}</td></tr>
        </tbody>
        <tfoot><tr style="border-top:2px solid #ddd;font-weight:600;"><td style="padding:6px;">Total</td><td style="padding:6px;text-align:right;">${d.totalStagiairesF}</td><td style="padding:6px;text-align:right;">${d.totalHeuresF}</td></tr></tfoot>
      </table>

      <h4 style="margin:14px 0 6px;font-size:13px;">Principales spécialités de formation</h4>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#55636c;text-align:left;"><th style="padding:4px 6px;">Spécialité (catégorie du catalogue)</th><th style="padding:4px 6px;text-align:right;">Stagiaires</th><th style="padding:4px 6px;text-align:right;">Heures</th></tr></thead>
        <tbody>${lignesSpecialites || '<tr><td style="padding:4px 6px;color:#55636c;">—</td></tr>'}</tbody>
      </table>
      <p style="font-size:12px;color:#55636c;margin-top:8px;">La répartition "type de stagiaire" est approximée à partir de l'origine de financement de chaque session — à vérifier avant déclaration. Le Formacode officiel n'est pas encore rattaché aux spécialités.</p>
    </div>

    <div class="carte">
      <h3 style="margin-top:0;">G. Stagiaires dont la formation a été confiée par un autre organisme (sous-traitance reçue)</h3>
      <p style="font-size:13px;">${d.stagiairesG} stagiaire(s) — ${d.heuresG} heure(s) suivies.</p>
    </div>

    <div class="carte">
      <button class="bouton" onclick="genererRecapBPF()">Générer le récapitulatif PDF</button>
      <p style="font-size:12px;color:#55636c;margin:8px 0 0;">Ce PDF est une aide interne, pas le formulaire officiel — reporte les chiffres sur monactiviteformation.emploi.gouv.fr avant le 30 avril.</p>
    </div>`;
}

function genererRecapBPF() {
  genererDocumentBPF(window.__bpfExercice, window.__bpfDonnees);
}
