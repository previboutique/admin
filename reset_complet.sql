-- ============================================================================
-- ADMIN FORMATION — Script de RESET COMPLET (environnement de développement)
-- Recrée tout le schéma ET injecte des données de démonstration.
-- ⚠️ Ne jamais exécuter sur l'environnement de production : ce script
-- supprime les tables existantes avant de les recréer.
-- ============================================================================

drop table if exists envois_email cascade;
drop table if exists documents_generes cascade;
drop table if exists session_participants cascade;
drop table if exists sessions_formation cascade;
drop table if exists signatures_conventions cascade;
drop table if exists acces_clients cascade;
drop table if exists stagiaires_nir cascade;
drop table if exists journal_acces_nir cascade;
drop table if exists secrets_applicatifs cascade;
drop table if exists stagiaires cascade;
drop table if exists formations_catalogue cascade;
drop table if exists familles_formation cascade;
drop table if exists referentiel_rome cascade;
drop table if exists contacts_client cascade;
drop table if exists clients cascade;
drop table if exists referentiel_certifications_pro cascade;
drop table if exists referentiel_nsf cascade;
drop table if exists referentiel_formacodes cascade;
drop table if exists profils cascade;
drop table if exists organisations cascade;
drop function if exists auth_organisation_id() cascade;
drop function if exists auth_role() cascade;
drop function if exists auth_is_super_admin() cascade;

-- Recréation complète du schéma (contenu identique à supabase.sql, reproduit
-- ici pour permettre un reset en une seule exécution collée dans l'éditeur
-- SQL Supabase — \ir n'y fonctionne pas, ce n'est pas un client psql).

create extension if not exists pgcrypto;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  raison_sociale text not null,
  forme_juridique text,
  siret text,
  numero_declaration_activite text,
  rcs text,
  tva_intracommunautaire text,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email_contact text,
  site_web text,
  logo_url text,
  couleur_primaire text default '#0a5c8a',
  pied_de_page_documents text,
  representant_nom text,
  representant_qualite text default 'Gérant',
  code_naf text,
  exercice_jour_debut smallint not null default 1 check (exercice_jour_debut between 1 and 31),
  exercice_mois_debut smallint not null default 1 check (exercice_mois_debut between 1 and 12),
  smtp_host text,
  smtp_port int default 587,
  smtp_secure boolean default true,
  smtp_user text,
  smtp_password text,
  smtp_from_email text,
  smtp_from_name text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists profils (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  nom text,
  prenom text,
  email text,
  role text not null default 'formateur'
    check (role in ('super_admin','admin','gestionnaire','formateur')),
  formateur_externe boolean not null default false,  -- formateur sous-traitant (extérieur à l'organisme) — cadre E du BPF
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function auth_organisation_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organisation_id from profils where id = auth.uid()
$$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profils where id = auth.uid()
$$;

create or replace function auth_is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'super_admin', false)
$$;

alter table organisations enable row level security;
alter table profils enable row level security;

create policy organisations_select on organisations for select to authenticated
  using (id = auth_organisation_id() or auth_is_super_admin());
create policy organisations_update on organisations for update to authenticated
  using ((id = auth_organisation_id() and auth_role() = 'admin') or auth_is_super_admin());
create policy organisations_insert on organisations for insert to authenticated
  with check (auth_is_super_admin());

create policy profils_select on profils for select to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin());
create policy profils_update_self on profils for update to authenticated
  using (id = auth.uid() or (organisation_id = auth_organisation_id() and auth_role() in ('admin','super_admin')) or auth_is_super_admin());
create policy profils_insert on profils for insert to authenticated
  with check (organisation_id = auth_organisation_id() and auth_role() in ('admin','super_admin') or auth_is_super_admin());

create table if not exists referentiel_formacodes (
  code text primary key,
  libelle text not null
);

create table if not exists referentiel_nsf (
  code text primary key,
  libelle text not null
);

create table if not exists referentiel_certifications_pro (
  code text primary key,
  libelle text not null,
  type text
);

alter table referentiel_formacodes enable row level security;
alter table referentiel_nsf enable row level security;
alter table referentiel_certifications_pro enable row level security;

create policy referentiels_select_all on referentiel_formacodes for select to authenticated, anon using (true);
create policy referentiels_select_all on referentiel_nsf for select to authenticated, anon using (true);
create policy referentiels_select_all on referentiel_certifications_pro for select to authenticated, anon using (true);
create policy referentiels_write on referentiel_formacodes for all to authenticated
  using (auth_is_super_admin()) with check (auth_is_super_admin());
create policy referentiels_write on referentiel_nsf for all to authenticated
  using (auth_is_super_admin()) with check (auth_is_super_admin());
create policy referentiels_write on referentiel_certifications_pro for all to authenticated
  using (auth_is_super_admin()) with check (auth_is_super_admin());

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  raison_sociale text not null,
  siret text,
  code_ape text,
  adresse text,
  code_postal text,
  ville text,
  secteur_activite text,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contacts_client (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  client_id uuid not null references clients(id) on delete cascade,
  civilite text,
  nom text,
  prenom text,
  fonction text,
  email text,
  telephone text,
  contact_principal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table contacts_client enable row level security;

create policy clients_all on clients for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());
create policy contacts_client_all on contacts_client for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

create table if not exists formations_catalogue (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  code text not null,
  categorie text not null,
  denomination text not null,
  prix numeric(10,2),
  duree_heures numeric(5,2),
  objectifs text,
  programme_methode text,
  evaluation text,
  conditions_realisation jsonb not null default '[]'::jsonb,
  consignes_convocation text,
  rappel_competences text,
  competences jsonb not null default '[]'::jsonb,
  pedagogie jsonb not null default '[]'::jsonb,
  materiel jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '[]'::jsonb,
  formacode text references referentiel_formacodes(code),
  code_nsf text references referentiel_nsf(code),
  certification_pro_code text references referentiel_certifications_pro(code),
  cycle_mois integer,
  formation_recyclage_id uuid references formations_catalogue(id),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

alter table formations_catalogue enable row level security;
create policy formations_catalogue_all on formations_catalogue for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

create table if not exists stagiaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  client_id uuid references clients(id),
  civilite text,
  nom text not null,
  prenom text not null,
  date_naissance date,
  lieu_naissance text,
  email text,
  telephone text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stagiaires_nom on stagiaires (organisation_id, nom, prenom);

alter table stagiaires enable row level security;
create policy stagiaires_all on stagiaires for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

create table if not exists sessions_formation (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  formation_id uuid not null references formations_catalogue(id),
  client_id uuid references clients(id),
  formateur_id uuid references profils(id),
  lieu text,
  adresse text,
  code_postal text,
  ville text,
  date_debut date not null,
  date_fin date,
  horaires jsonb not null default '[]'::jsonb,
  prix_unitaire numeric(10,2),
  numero_devis text,
  origine_financement text not null default 'entreprise'
    check (origine_financement in (
      'entreprise', 'apprentissage', 'professionnalisation', 'alternance_pro', 'transition_pro',
      'cpf', 'recherche_emploi', 'tns', 'plan_competences',
      'agents_publics', 'instances_europeennes', 'etat', 'collectivites', 'france_travail', 'autres_publics',
      'particulier', 'autre_organisme', 'autres_produits'
    )),                                               -- origine du financement (cadre C du BPF)
  sous_traitance_recue boolean not null default false,  -- session confiée par un autre organisme de formation (cadre G du BPF)
  conditions_realisation_session text,
  statut text not null default 'planifiee'
    check (statut in ('planifiee','en_cours','terminee','annulee')),
  numero_session text,                                  -- AAAA.MM.NNN, généré automatiquement (voir trigger plus bas)
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_dates on sessions_formation (organisation_id, date_debut);

alter table sessions_formation drop constraint if exists sessions_formation_numero_session_uniq;
alter table sessions_formation
  add constraint sessions_formation_numero_session_uniq unique (organisation_id, numero_session);

-- Compteur de numérotation des sessions (AAAA.MM.NNN — AAAA/MM = année/mois
-- civils de la date de début ; NNN repart de 001 au début de l'EXERCICE
-- COMPTABLE de l'organisme, pas forcément au 1er janvier — voir
-- organisations.exercice_jour_debut / exercice_mois_debut ci-dessus).
-- L'incrémentation "on conflict do update" est atomique côté Postgres : deux
-- créations simultanées ne peuvent pas obtenir le même numéro.
create table if not exists compteurs_numero_session (
  organisation_id uuid not null references organisations(id),
  annee_exercice int not null,
  dernier_numero int not null default 0,
  primary key (organisation_id, annee_exercice)
);

alter table compteurs_numero_session enable row level security;
-- Aucune policy : seule la fonction generer_numero_session() (security definer) y écrit.

create or replace function generer_numero_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_jour_debut smallint;
  v_mois_debut smallint;
  v_annee_civile int := extract(year from new.date_debut);
  v_mois int := extract(month from new.date_debut);
  v_jour int := extract(day from new.date_debut);
  v_annee_exercice int;
  v_numero int;
begin
  if new.numero_session is not null then
    return new;
  end if;

  select exercice_jour_debut, exercice_mois_debut into v_jour_debut, v_mois_debut
  from organisations where id = new.organisation_id;
  v_jour_debut := coalesce(v_jour_debut, 1);
  v_mois_debut := coalesce(v_mois_debut, 1);

  if (v_mois, v_jour) >= (v_mois_debut, v_jour_debut) then
    v_annee_exercice := v_annee_civile;
  else
    v_annee_exercice := v_annee_civile - 1;
  end if;

  insert into compteurs_numero_session (organisation_id, annee_exercice, dernier_numero)
  values (new.organisation_id, v_annee_exercice, 1)
  on conflict (organisation_id, annee_exercice)
  do update set dernier_numero = compteurs_numero_session.dernier_numero + 1
  returning dernier_numero into v_numero;

  new.numero_session := v_annee_civile || '.' || lpad(v_mois::text, 2, '0') || '.' || lpad(v_numero::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_generer_numero_session on sessions_formation;
create trigger trg_generer_numero_session
  before insert on sessions_formation
  for each row execute function generer_numero_session();


-- ==== PATCH 2026-09-18 (a) — formateurs / sous-traitants / identité visuelle / BPF (voir patch_2026-09-18a_formateurs_soustraitants_organisme.sql) ====
-- ============================================================================
-- PATCH 2026-09-18 (a) — Formateurs, organismes sous-traitants, identité
-- visuelle de l'organisme, et compléments BPF (cadres B et D du CERFA)
-- ============================================================================
-- Regroupe plusieurs ajouts demandés ensemble par Jérémy :
--
-- 1. Formateurs : taux horaire (pour le calcul automatique du cadre D du BPF
--    — salaires des formateurs / achats de prestation de formation).
-- 2. Organismes sous-traitants : un "organisme sous-traitant" est un client
--    d'un type particulier (clients.type_client = 'organisme_formation').
--    C'est l'organisme qui confie une session à Prévisecours (sous-traitance
--    REÇUE, déjà modélisée par sessions_formation.sous_traitance_recue et
--    l'origine de financement "autre_organisme" — cadre G et ligne 10 du
--    cadre C du CERFA 10443*17). Aucun nouveau modèle de session n'était
--    nécessaire : les sessions, stagiaires, émargement et évaluations
--    fonctionnent déjà à l'identique, quel que soit le type de client.
-- 3. Identité visuelle de l'organisme : logo, signature et tampon (images),
--    utilisés dans l'appli et en en-tête/pied des documents PDF.
-- 4. Modalité de la session (présentiel/distanciel/mixte), pour répondre
--    automatiquement à la question du cadre B du BPF ("action de formation
--    en tout ou partie à distance ?").
-- 5. Charges de l'organisme (cadre D du BPF) : les salaires des formateurs
--    et les achats de prestation de formation (formateurs externes) sont
--    désormais calculés automatiquement à partir des heures et du taux
--    horaire de chaque formateur. Seules les "autres charges" (loyer,
--    matériel, administratif…) restent à saisir à la main, par exercice —
--    d'où la table bpf_parametres_exercice.
--
-- Idempotent : peut être rejoué sans erreur.
-- ============================================================================

-- 1. Formateurs -------------------------------------------------------------
alter table profils add column if not exists taux_horaire numeric(10,2);
comment on column profils.taux_horaire is 'Taux horaire (€/heure) du formateur — sert au calcul automatique du cadre D du BPF (salaires formateurs internes / achats de prestation pour les externes).';

alter table profils add column if not exists telephone text;

-- 2. Type de client (entreprise / organisme de formation sous-traitant) -----
alter table clients add column if not exists type_client text not null default 'entreprise'
  check (type_client in ('entreprise', 'organisme_formation'));
comment on column clients.type_client is 'entreprise : client classique (salariés formés). organisme_formation : organisme de formation qui confie des sessions à Prévisecours en sous-traitance (cadre G / ligne 10 du BPF).';

-- 3. Identité visuelle de l'organisme ----------------------------------------
alter table organisations add column if not exists logo_url text;
alter table organisations add column if not exists signature_url text;
alter table organisations add column if not exists tampon_url text;
comment on column organisations.logo_url is 'URL publique (Storage, bucket identite-visuelle) du logo de l''organisme — affiché dans l''appli et en en-tête des documents PDF.';
comment on column organisations.signature_url is 'URL publique (Storage) de l''image de signature du représentant — insérée automatiquement sur les documents qui en ont besoin (Convention, Certificat...).';
comment on column organisations.tampon_url is 'URL publique (Storage) de l''image du tampon/cachet de l''organisme.';

-- Bucket public (les logos/signatures/tampons ne sont pas des données
-- sensibles, et doivent être accessibles directement par URL pour être
-- affichés dans l'appli sans passer par une requête authentifiée).
insert into storage.buckets (id, name, public)
values ('identite-visuelle', 'identite-visuelle', true)
on conflict (id) do nothing;

drop policy if exists identite_visuelle_select on storage.objects;
create policy identite_visuelle_select on storage.objects for select
  using (bucket_id = 'identite-visuelle');

drop policy if exists identite_visuelle_insert on storage.objects;
create policy identite_visuelle_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'identite-visuelle'
    and (
      ((storage.foldername(name))[1] = auth_organisation_id()::text and auth_role() in ('admin', 'gestionnaire'))
      or auth_is_super_admin()
    )
  );

drop policy if exists identite_visuelle_update on storage.objects;
create policy identite_visuelle_update on storage.objects for update to authenticated
  using (
    bucket_id = 'identite-visuelle'
    and (
      ((storage.foldername(name))[1] = auth_organisation_id()::text and auth_role() in ('admin', 'gestionnaire'))
      or auth_is_super_admin()
    )
  );

drop policy if exists identite_visuelle_delete on storage.objects;
create policy identite_visuelle_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'identite-visuelle'
    and (
      ((storage.foldername(name))[1] = auth_organisation_id()::text and auth_role() in ('admin', 'gestionnaire'))
      or auth_is_super_admin()
    )
  );

-- 4. Modalité de la session (cadre B du BPF : formation à distance ?) -------
alter table sessions_formation add column if not exists modalite text not null default 'presentiel'
  check (modalite in ('presentiel', 'distanciel', 'mixte'));
comment on column sessions_formation.modalite is 'Présentiel / distanciel / mixte — sert à répondre automatiquement à la question du cadre B du BPF ("action de formation en tout ou partie à distance ?").';

-- 5. Charges de l'organisme non calculables automatiquement (cadre D) -------
create table if not exists bpf_parametres_exercice (
  organisation_id uuid not null references organisations(id),
  annee_exercice int not null,
  autres_charges numeric(12,2) not null default 0,
  primary key (organisation_id, annee_exercice)
);
comment on table bpf_parametres_exercice is 'Saisie manuelle, par exercice, des charges de l''organisme que l''appli ne peut pas calculer seule (loyer, matériel, frais administratifs...) — vient compléter le cadre D du BPF, dont les salaires formateurs et achats de prestation sont eux calculés automatiquement depuis les heures et taux horaires.';

alter table bpf_parametres_exercice enable row level security;

create policy bpf_parametres_exercice_select on bpf_parametres_exercice for select to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin());

create policy bpf_parametres_exercice_insert on bpf_parametres_exercice for insert to authenticated
  with check ((organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire')) or auth_is_super_admin());

create policy bpf_parametres_exercice_update on bpf_parametres_exercice for update to authenticated
  using ((organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire')) or auth_is_super_admin());

-- ============================================================================
-- FIN DU PATCH
-- ============================================================================


-- 6. Réglage : activer/désactiver l'assignation rapide de formateur ------
alter table organisations add column if not exists assignation_rapide_formateur_active boolean not null default true;
comment on column organisations.assignation_rapide_formateur_active is 'Active/désactive l''outil d''assignation rapide de formateur (par lot, avec filtre de dates) sur l''écran Sessions. Réglable depuis l''onglet Organisme.';

alter table sessions_formation enable row level security;

create policy sessions_formation_select on sessions_formation for select to authenticated
  using (
    (organisation_id = auth_organisation_id() and (
      auth_role() in ('admin', 'gestionnaire')
      or (auth_role() = 'formateur' and formateur_id = auth.uid())
    ))
    or auth_is_super_admin()
  );

create policy sessions_formation_insert on sessions_formation for insert to authenticated
  with check (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create policy sessions_formation_update on sessions_formation for update to authenticated
  using (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create policy sessions_formation_delete on sessions_formation for delete to authenticated
  using (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create table if not exists session_clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  session_id uuid not null references sessions_formation(id) on delete cascade,
  client_id uuid not null references clients(id),
  prix_unitaire numeric(10,2),
  numero_devis text,
  created_at timestamptz not null default now(),
  unique (session_id, client_id)
);

alter table session_clients enable row level security;

create policy session_clients_select on session_clients for select to authenticated
  using (
    (organisation_id = auth_organisation_id() and (
      auth_role() in ('admin', 'gestionnaire')
      or (auth_role() = 'formateur' and exists (
        select 1 from sessions_formation sf where sf.id = session_clients.session_id and sf.formateur_id = auth.uid()
      ))
    ))
    or auth_is_super_admin()
  );

create policy session_clients_insert on session_clients for insert to authenticated
  with check (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create policy session_clients_update on session_clients for update to authenticated
  using (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create policy session_clients_delete on session_clients for delete to authenticated
  using (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create table if not exists session_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  session_id uuid not null references sessions_formation(id) on delete cascade,
  stagiaire_id uuid not null references stagiaires(id),
  client_id uuid references clients(id),                -- client de CE stagiaire pour CETTE session (une session peut réunir plusieurs entreprises)
  presence jsonb not null default '[]'::jsonb,
  motif_invalidation text,
  evaluation_satisfaction jsonb,
  grille_certification jsonb,
  note_moyenne numeric(4,2),
  statut text not null default 'inscrit'
    check (statut in ('inscrit','present','absent','certifie','non_certifie')),
  created_at timestamptz not null default now(),
  unique (session_id, stagiaire_id)
);

alter table session_participants enable row level security;

create policy session_participants_select on session_participants for select to authenticated
  using (
    (organisation_id = auth_organisation_id() and (
      auth_role() in ('admin', 'gestionnaire')
      or (auth_role() = 'formateur' and exists (
        select 1 from sessions_formation sf
        where sf.id = session_participants.session_id and sf.formateur_id = auth.uid()
      ))
    ))
    or auth_is_super_admin()
  );

create policy session_participants_update on session_participants for update to authenticated
  using (
    (organisation_id = auth_organisation_id() and (
      auth_role() in ('admin', 'gestionnaire')
      or (auth_role() = 'formateur' and exists (
        select 1 from sessions_formation sf
        where sf.id = session_participants.session_id and sf.formateur_id = auth.uid()
      ))
    ))
    or auth_is_super_admin()
  );

create policy session_participants_insert on session_participants for insert to authenticated
  with check (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create policy session_participants_delete on session_participants for delete to authenticated
  using (
    (organisation_id = auth_organisation_id() and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );

create table if not exists documents_generes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  session_id uuid references sessions_formation(id) on delete set null,
  stagiaire_id uuid references stagiaires(id),
  client_id uuid references clients(id),
  type text not null check (type in (
    'devis','convention','convocation','feuille_presence',
    'attestation_fin_formation','certificat_realisation',
    'certificat_competence','bilan_formation','grille_certification'
  )),
  storage_path text,
  genere_le timestamptz not null default now(),
  genere_par uuid references profils(id)
);

alter table documents_generes enable row level security;
create policy documents_generes_all on documents_generes for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

create table if not exists envois_email (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  document_id uuid references documents_generes(id),
  session_id uuid references sessions_formation(id) on delete set null,
  destinataire_email text not null,
  destinataire_nom text,
  objet text,
  corps text,
  statut text not null default 'en_attente'
    check (statut in ('en_attente','envoye','echec')),
  erreur text,
  envoye_le timestamptz,
  created_at timestamptz not null default now(),
  groupe_envoi_id uuid  -- regroupe les lignes d'un même envoi (plusieurs documents = un email, une ligne de journal par document)
);

alter table envois_email enable row level security;
create policy envois_email_all on envois_email for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

-- Bucket de stockage des documents générés (PDF téléversés avant envoi email
-- ou téléchargement groupé). Privé : jamais accessible publiquement, données
-- personnelles des stagiaires. Chemin = {organisation_id}/{session_id}/fichier.pdf
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_bucket_insert on storage.objects;
create policy documents_bucket_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth_organisation_id()::text
  );

drop policy if exists documents_bucket_select on storage.objects;
create policy documents_bucket_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth_organisation_id()::text or auth_is_super_admin())
  );

drop policy if exists documents_bucket_delete on storage.objects;
create policy documents_bucket_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and ((storage.foldername(name))[1] = auth_organisation_id()::text and auth_role() in ('admin', 'gestionnaire'))
    or auth_is_super_admin()
  );


create table if not exists statistiques_client (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  client_id uuid not null references clients(id) on delete cascade,
  annee integer not null,
  accidents_travail integer,
  maladies_professionnelles integer,
  jours_itt integer,
  notes text,
  unique (client_id, annee)
);

alter table statistiques_client enable row level security;
create policy statistiques_client_all on statistiques_client for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

create or replace view v_dernieres_realisations
with (security_invoker = true) as
select
  sp.organisation_id,
  sp.stagiaire_id,
  sf.formation_id,
  max(sf.date_fin) as derniere_date_fin
from session_participants sp
join sessions_formation sf on sf.id = sp.session_id
where sp.statut in ('certifie', 'present')
group by sp.organisation_id, sp.stagiaire_id, sf.formation_id;

create or replace view v_recyclages_a_programmer
with (security_invoker = true) as
select
  d.organisation_id,
  d.stagiaire_id,
  st.nom,
  st.prenom,
  st.client_id,
  c.raison_sociale as client_nom,
  fc.id as formation_id,
  fc.denomination as formation_denomination,
  coalesce(fc.formation_recyclage_id, fc.id) as formation_a_programmer_id,
  coalesce(fr.denomination, fc.denomination) as formation_a_programmer_denomination,
  d.derniere_date_fin,
  (d.derniere_date_fin + (fc.cycle_mois || ' months')::interval)::date as date_echeance
from v_dernieres_realisations d
join formations_catalogue fc on fc.id = d.formation_id
left join formations_catalogue fr on fr.id = fc.formation_recyclage_id
join stagiaires st on st.id = d.stagiaire_id
left join clients c on c.id = st.client_id
where fc.cycle_mois is not null
  and not exists (
    select 1
    from session_participants sp2
    join sessions_formation sf2 on sf2.id = sp2.session_id
    where sp2.stagiaire_id = d.stagiaire_id
      and sf2.formation_id = coalesce(fc.formation_recyclage_id, fc.id)
      and sf2.date_debut > d.derniere_date_fin
      and sp2.statut in ('inscrit', 'present', 'certifie')
  );

grant select on v_dernieres_realisations to authenticated;
grant select on v_recyclages_a_programmer to authenticated;

create table if not exists relances_recyclage (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  stagiaire_id uuid not null references stagiaires(id),
  formation_id uuid not null references formations_catalogue(id),
  date_echeance date not null,
  date_relance timestamptz not null default now(),
  effectuee_par uuid references profils(id),
  notes text
);

create index if not exists idx_relances_stagiaire on relances_recyclage (organisation_id, stagiaire_id, formation_id, date_echeance);

alter table relances_recyclage enable row level security;
create policy relances_recyclage_all on relances_recyclage for all to authenticated
  using (organisation_id = auth_organisation_id() or auth_is_super_admin())
  with check (organisation_id = auth_organisation_id() or auth_is_super_admin());

-- ==== PATCH 2026-09-18 (d) — fusion de fiches stagiaires en doublon (voir patch_2026-09-18d_fusion_stagiaires.sql) ====

create or replace function fusionner_stagiaires(p_survivant uuid, p_doublons uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_doublon uuid;
begin
  if auth_role() not in ('admin', 'gestionnaire') and not auth_is_super_admin() then
    raise exception 'Fusion de stagiaires réservée aux rôles admin/gestionnaire.';
  end if;

  select organisation_id into v_org from stagiaires where id = p_survivant;
  if v_org is null or (v_org <> auth_organisation_id() and not auth_is_super_admin()) then
    raise exception 'Stagiaire survivant introuvable ou hors organisation.';
  end if;

  foreach v_doublon in array p_doublons loop
    if v_doublon = p_survivant then continue; end if;
    if not exists (select 1 from stagiaires where id = v_doublon and organisation_id = v_org) then
      raise exception 'Fiche doublon % introuvable ou hors organisation.', v_doublon;
    end if;

    -- Réaffecte les inscriptions du doublon, sauf conflit avec une
    -- inscription déjà existante du survivant sur la même session.
    update session_participants sp
    set stagiaire_id = p_survivant
    where sp.stagiaire_id = v_doublon
      and not exists (
        select 1 from session_participants sp2
        where sp2.session_id = sp.session_id and sp2.stagiaire_id = p_survivant
      );

    delete from session_participants where stagiaire_id = v_doublon;

    -- Complète les champs vides du survivant avec ceux du doublon.
    update stagiaires s
    set
      civilite = coalesce(nullif(s.civilite, ''), d.civilite),
      date_naissance = coalesce(s.date_naissance, d.date_naissance),
      lieu_naissance = coalesce(nullif(s.lieu_naissance, ''), d.lieu_naissance),
      email = coalesce(nullif(s.email, ''), d.email),
      telephone = coalesce(nullif(s.telephone, ''), d.telephone),
      client_id = coalesce(s.client_id, d.client_id),
      notes = case
        when d.notes is null or d.notes = '' then s.notes
        when s.notes is null or s.notes = '' then d.notes
        else s.notes || E'\n' || d.notes
      end
    from stagiaires d
    where s.id = p_survivant and d.id = v_doublon;

    delete from stagiaires where id = v_doublon;
  end loop;
end;
$$;

grant execute on function fusionner_stagiaires(uuid, uuid[]) to authenticated;

-- ==== PATCH 2026-09-18 (e) — type de financement et OPCO sur la fiche client (voir patch_2026-09-18e_financement_client.sql) ====
alter table clients add column if not exists type_financement text;
comment on column clients.type_financement is 'Mode de financement habituel de ce client : entreprise (règle elle-même), opco (pris en charge par un OPCO — voir opco_nom), ou autre (CPF, France Travail, Conseil régional...). Informatif, indépendant de sessions_formation.origine_financement qui peut varier par session.';

alter table clients add column if not exists opco_nom text;
comment on column clients.opco_nom is 'Nom de l''OPCO qui prend en charge la formation pour ce client, quand type_financement = ''opco''.';

-- ==== PATCH 2026-09-18 (f) — fusion des fiches catalogue individuel/groupe (voir patch_2026-09-18f_catalogue_individuel_groupe.sql) ====
alter table formations_catalogue add column if not exists prix_individuel numeric(10,2);
comment on column formations_catalogue.prix_individuel is 'Tarif individuel (€), pour les formations proposées à la fois en individuel et en groupe (voir prix_groupe). La colonne prix reste le tarif unique des formations sans cette distinction.';

alter table formations_catalogue add column if not exists prix_groupe numeric(10,2);
comment on column formations_catalogue.prix_groupe is 'Tarif groupe (€), pour les formations proposées à la fois en individuel et en groupe (voir prix_individuel).';
-- (La fusion automatique des paires i/g n'a rien à faire ici : le catalogue
-- de démonstration inséré plus bas n'a pas encore été créé à ce stade.)

-- ==== PATCH 2026-09-19 — fusion de sessions en doublon (voir patch_2026-09-19_fusion_sessions.sql) ====
create or replace function fusionner_sessions(p_survivant uuid, p_doublons uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_doublon uuid;
begin
  if auth_role() not in ('admin', 'gestionnaire') and not auth_is_super_admin() then
    raise exception 'Fusion de sessions réservée aux rôles admin/gestionnaire.';
  end if;

  select organisation_id into v_org from sessions_formation where id = p_survivant;
  if v_org is null or (v_org <> auth_organisation_id() and not auth_is_super_admin()) then
    raise exception 'Session survivante introuvable ou hors organisation.';
  end if;

  foreach v_doublon in array p_doublons loop
    if v_doublon = p_survivant then continue; end if;
    if not exists (select 1 from sessions_formation where id = v_doublon and organisation_id = v_org) then
      raise exception 'Session doublon % introuvable ou hors organisation.', v_doublon;
    end if;

    update session_participants sp
    set session_id = p_survivant
    where sp.session_id = v_doublon
      and not exists (
        select 1 from session_participants sp2
        where sp2.session_id = p_survivant and sp2.stagiaire_id = sp.stagiaire_id
      );

    update session_clients sc
    set session_id = p_survivant
    where sc.session_id = v_doublon
      and not exists (
        select 1 from session_clients sc2
        where sc2.session_id = p_survivant and sc2.client_id = sc.client_id
      );

    update documents_generes set session_id = p_survivant where session_id = v_doublon;
    update envois_email set session_id = p_survivant where session_id = v_doublon;

    delete from sessions_formation where id = v_doublon;
  end loop;
end;
$$;

grant execute on function fusionner_sessions(uuid, uuid[]) to authenticated;

-- ==== PATCH 2026-10-04 — report / changement de date d'une session (voir patch_2026-10-04_report_session.sql) ====
-- Report : session d'origine conservée (annulée) + nouvelle session reliée ; erreur de saisie : correction sur place tracée.


alter table sessions_formation add column if not exists session_origine_id uuid
  references sessions_formation(id) on delete set null;
comment on column sessions_formation.session_origine_id is 'Si cette session est la reprogrammation d''une session reportée : id de la session d''origine (conservée, statut annulée).';

alter table sessions_formation add column if not exists motif_report text
  check (motif_report is null or motif_report in ('client', 'indisponibilite', 'annulee_reprogrammee', 'autre'));
comment on column sessions_formation.motif_report is 'Sur la session d''ORIGINE d''un report : motif du report (client, indisponibilite, annulee_reprogrammee, autre).';

alter table sessions_formation add column if not exists commentaire_report text;
comment on column sessions_formation.commentaire_report is 'Précision libre sur le motif du report (obligatoire si motif = autre).';

alter table sessions_formation add column if not exists historique_dates jsonb not null default '[]'::jsonb;
comment on column sessions_formation.historique_dates is 'Corrections de date faites sur place (motif "erreur de saisie") : [{le, par_nom, motif, commentaire, ancienne_date_debut, ancienne_date_fin, ancien_numero, nouveau_numero}].';

create index if not exists idx_sessions_formation_origine on sessions_formation(session_origine_id);

-- ----------------------------------------------------------------------------
-- Calcul du prochain numéro de session pour une date donnée (même règle que
-- le trigger de création : AAAA.MM de la date de début, compteur NNN par
-- exercice comptable de l'organisme). Factorisé ici pour être réutilisé par
-- le trigger ET par la correction de date sur place.
-- Réservé aux fonctions "security definer" (jamais appelable directement
-- depuis l'appli : on pourrait sinon consommer les numéros d'un autre
-- organisme).
-- ----------------------------------------------------------------------------
create or replace function prochain_numero_session(p_organisation uuid, p_date date) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_jour_debut smallint;
  v_mois_debut smallint;
  v_annee_civile int := extract(year from p_date);
  v_mois int := extract(month from p_date);
  v_jour int := extract(day from p_date);
  v_annee_exercice int;
  v_numero int;
begin
  select exercice_jour_debut, exercice_mois_debut into v_jour_debut, v_mois_debut
  from organisations where id = p_organisation;
  v_jour_debut := coalesce(v_jour_debut, 1);
  v_mois_debut := coalesce(v_mois_debut, 1);

  if (v_mois, v_jour) >= (v_mois_debut, v_jour_debut) then
    v_annee_exercice := v_annee_civile;
  else
    v_annee_exercice := v_annee_civile - 1;
  end if;

  insert into compteurs_numero_session (organisation_id, annee_exercice, dernier_numero)
  values (p_organisation, v_annee_exercice, 1)
  on conflict (organisation_id, annee_exercice)
  do update set dernier_numero = compteurs_numero_session.dernier_numero + 1
  returning dernier_numero into v_numero;

  return v_annee_civile || '.' || lpad(v_mois::text, 2, '0') || '.' || lpad(v_numero::text, 3, '0');
end;
$$;

revoke all on function prochain_numero_session(uuid, date) from public, anon, authenticated;

-- Le trigger de création délègue maintenant à la fonction ci-dessus
-- (comportement identique à celui du patch 2026-09-17h / 2026-09-18c).
create or replace function generer_numero_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero_session is null then
    new.numero_session := prochain_numero_session(new.organisation_id, new.date_debut);
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Report / changement de date d'une session.
-- p_motif : 'client' | 'indisponibilite' | 'annulee_reprogrammee' | 'autre'
--           (report : nouvelle session créée) ou 'erreur_saisie' (correction
--           sur place). Renvoie l'id de la session à ouvrir ensuite (la
--           nouvelle session pour un report, la même pour une correction).
-- Réservé aux rôles admin/gestionnaire.
-- ----------------------------------------------------------------------------
create or replace function reporter_session(
  p_session uuid, p_date_debut date, p_date_fin date, p_motif text, p_commentaire text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s sessions_formation%rowtype;
  v_date_fin date;
  v_nouvelle uuid;
  v_numero text;
  v_par text;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, '')), '');
begin
  if auth_role() not in ('admin', 'gestionnaire') and not auth_is_super_admin() then
    raise exception 'Le changement de date d''une session est réservé aux rôles admin/gestionnaire.';
  end if;

  select * into v_s from sessions_formation where id = p_session;
  if not found or (v_s.organisation_id <> auth_organisation_id() and not auth_is_super_admin()) then
    raise exception 'Session introuvable ou hors organisation.';
  end if;

  if p_date_debut is null then
    raise exception 'La nouvelle date de début est obligatoire.';
  end if;
  v_date_fin := coalesce(p_date_fin, p_date_debut);
  if v_date_fin < p_date_debut then
    raise exception 'La date de fin ne peut pas précéder la date de début.';
  end if;
  if p_motif not in ('client', 'indisponibilite', 'annulee_reprogrammee', 'autre', 'erreur_saisie') then
    raise exception 'Motif inconnu.';
  end if;
  if p_motif = 'autre' and v_commentaire is null then
    raise exception 'Précise le motif du report.';
  end if;
  if p_date_debut = v_s.date_debut and v_date_fin = coalesce(v_s.date_fin, v_s.date_debut) then
    raise exception 'La nouvelle date est identique à la date actuelle.';
  end if;

  -- --- Correction d'une erreur de saisie : sur place, sans nouvelle session.
  if p_motif = 'erreur_saisie' then
    -- Le numéro n'est recalculé que si l'année ou le mois change ; sinon il
    -- reste cohérent avec la date et on évite de créer un trou dans la série.
    if left(coalesce(v_s.numero_session, ''), 7) = to_char(p_date_debut, 'YYYY.MM') then
      v_numero := v_s.numero_session;
    else
      v_numero := prochain_numero_session(v_s.organisation_id, p_date_debut);
    end if;

    select btrim(coalesce(prenom, '') || ' ' || coalesce(nom, '')) into v_par from profils where id = auth.uid();

    update sessions_formation
    set date_debut = p_date_debut,
        date_fin = v_date_fin,
        numero_session = v_numero,
        historique_dates = historique_dates || jsonb_build_array(jsonb_build_object(
          'le', now(),
          'par_nom', v_par,
          'motif', 'erreur_saisie',
          'commentaire', v_commentaire,
          'ancienne_date_debut', v_s.date_debut,
          'ancienne_date_fin', v_s.date_fin,
          'ancien_numero', v_s.numero_session,
          'nouveau_numero', v_numero
        ))
    where id = p_session;

    return p_session;
  end if;

  -- --- Vrai report : la session d'origine est conservée.
  if v_s.statut = 'terminee' then
    raise exception 'Une session terminée ne peut pas être reportée (si la date était fausse, choisis « Correction d''une erreur de saisie »).';
  end if;
  if exists (select 1 from sessions_formation where session_origine_id = p_session) then
    raise exception 'Cette session a déjà été reportée vers une autre session.';
  end if;

  update sessions_formation
  set statut = 'annulee', motif_report = p_motif, commentaire_report = v_commentaire
  where id = p_session;

  insert into sessions_formation (
    organisation_id, formation_id, client_id, formateur_id, lieu, adresse, code_postal, ville,
    date_debut, date_fin, horaires, prix_unitaire, numero_devis, origine_financement,
    sous_traitance_recue, conditions_realisation_session, modalite, statut, session_origine_id
  ) values (
    v_s.organisation_id, v_s.formation_id, v_s.client_id, v_s.formateur_id, v_s.lieu, v_s.adresse, v_s.code_postal, v_s.ville,
    p_date_debut, v_date_fin, v_s.horaires, v_s.prix_unitaire, v_s.numero_devis, v_s.origine_financement,
    v_s.sous_traitance_recue, v_s.conditions_realisation_session, v_s.modalite, 'planifiee', p_session
  ) returning id into v_nouvelle;   -- le trigger attribue le nouveau numéro d'après la nouvelle date

  insert into session_clients (organisation_id, session_id, client_id, prix_unitaire, numero_devis)
  select organisation_id, v_nouvelle, client_id, prix_unitaire, numero_devis
  from session_clients where session_id = p_session;

  insert into session_participants (organisation_id, session_id, stagiaire_id, client_id)
  select organisation_id, v_nouvelle, stagiaire_id, client_id
  from session_participants where session_id = p_session;

  return v_nouvelle;
end;
$$;

grant execute on function reporter_session(uuid, date, date, text, text) to authenticated;


-- ==== PATCH 2026-10-04 (b) — commentaire libre sur l'évaluation du stagiaire (voir patch_2026-10-04b_commentaire_evaluation.sql) ====
alter table session_participants add column if not exists commentaire_evaluation text;
comment on column session_participants.commentaire_evaluation is 'Commentaire libre du stagiaire sur la formation (évaluation de satisfaction, indicateur Qualiopi).';

-- ---------------------------------------------------------------------------
-- PATCH 2026-10-04c — Évaluation stagiaire par QR code (jeton de session + RPC publiques)
-- ---------------------------------------------------------------------------
alter table sessions_formation add column if not exists token_evaluation uuid not null default gen_random_uuid();
create unique index if not exists idx_sessions_formation_token_evaluation on sessions_formation(token_evaluation);
comment on column sessions_formation.token_evaluation is 'Jeton secret du QR code d''évaluation par les stagiaires (page publique evaluation.html).';

-- Charge ce qu'il faut pour afficher la page : intitulé, dates, liste des
-- inscrits (prénom + initiale du nom, avec indicateur "a déjà répondu").
create or replace function evaluation_charger(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_fin date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_ouvert boolean;
  v_message text;
  v_liste jsonb;
begin
  select s.id, s.date_debut, s.date_fin, s.statut, f.denomination, o.raison_sociale
    into v_s
  from sessions_formation s
  left join formations_catalogue f on f.id = s.formation_id
  left join organisations o on o.id = s.organisation_id
  where s.token_evaluation = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lien invalide.');
  end if;

  v_fin := coalesce(v_s.date_fin, v_s.date_debut);
  v_ouvert := v_s.statut <> 'annulee' and v_aujourdhui >= v_fin and v_aujourdhui <= v_fin + 7;
  v_message := case
    when v_s.statut = 'annulee' then 'Cette session a été annulée ou reportée.'
    when v_aujourdhui < v_fin then 'L''évaluation sera ouverte le dernier jour de la formation.'
    when v_aujourdhui > v_fin + 7 then 'Le délai pour répondre à cette évaluation est dépassé.'
    else null end;

  if v_ouvert then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', sp.id,
             'nom', coalesce(st.prenom, '') || ' ' || left(coalesce(st.nom, ''), 1) || '.',
             'deja_repondu', sp.evaluation_satisfaction is not null and sp.evaluation_satisfaction <> '{}'::jsonb
           ) order by st.nom, st.prenom), '[]'::jsonb)
      into v_liste
    from session_participants sp join stagiaires st on st.id = sp.stagiaire_id
    where sp.session_id = v_s.id;
  else
    v_liste := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'ok', true, 'ouvert', v_ouvert, 'message', v_message,
    'formation', v_s.denomination, 'organisme', v_s.raison_sociale,
    'date_debut', v_s.date_debut, 'date_fin', v_fin,
    'participants', v_liste);
end;
$$;

-- Enregistre la réponse d'un stagiaire. p_reponses : {"critère": 1..4, ...}
create or replace function evaluation_enregistrer(
  p_token uuid, p_participant uuid, p_reponses jsonb, p_commentaire text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_fin date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_sp record;
  v_cle text;
  v_val jsonb;
  v_total numeric := 0;
  v_n int := 0;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, '')), '');
begin
  select id, date_debut, date_fin, statut into v_s from sessions_formation where token_evaluation = p_token;
  if not found then raise exception 'Lien invalide.'; end if;

  v_fin := coalesce(v_s.date_fin, v_s.date_debut);
  if v_s.statut = 'annulee' or v_aujourdhui < v_fin or v_aujourdhui > v_fin + 7 then
    raise exception 'L''évaluation n''est pas ouverte pour cette session.';
  end if;

  select id, evaluation_satisfaction into v_sp
  from session_participants where id = p_participant and session_id = v_s.id;
  if not found then raise exception 'Stagiaire introuvable pour cette session.'; end if;
  if v_sp.evaluation_satisfaction is not null and v_sp.evaluation_satisfaction <> '{}'::jsonb then
    raise exception 'Une évaluation a déjà été enregistrée pour ce stagiaire.';
  end if;

  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' or p_reponses = '{}'::jsonb then
    raise exception 'Aucune réponse reçue.';
  end if;
  if (select count(*) from jsonb_object_keys(p_reponses)) > 30 then
    raise exception 'Trop de réponses.';
  end if;
  for v_cle, v_val in select * from jsonb_each(p_reponses) loop
    if length(v_cle) > 200 or jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}') !~ '^[1-4]$' then
      raise exception 'Réponse invalide.';
    end if;
    v_total := v_total + (v_val #>> '{}')::numeric;
    v_n := v_n + 1;
  end loop;

  if v_commentaire is not null and length(v_commentaire) > 2000 then
    raise exception 'Commentaire trop long.';
  end if;

  update session_participants
  set evaluation_satisfaction = p_reponses,
      note_moyenne = round(v_total / v_n, 2),
      commentaire_evaluation = v_commentaire
  where id = p_participant;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function evaluation_charger(uuid) from public;
revoke all on function evaluation_enregistrer(uuid, uuid, jsonb, text) from public;
grant execute on function evaluation_charger(uuid) to anon, authenticated;
grant execute on function evaluation_enregistrer(uuid, uuid, jsonb, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- PATCH 2026-10-04d — Émargement électronique par QR code (table emargements + RPC)
-- ---------------------------------------------------------------------------
alter table sessions_formation add column if not exists token_emargement uuid not null default gen_random_uuid();
create unique index if not exists idx_sessions_formation_token_emargement on sessions_formation(token_emargement);
comment on column sessions_formation.token_emargement is 'Jeton secret du QR code d''émargement de la session (page publique emargement.html).';

create table if not exists emargements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  session_id uuid not null references sessions_formation(id) on delete cascade,
  role text not null check (role in ('stagiaire', 'formateur')),
  participant_id uuid references session_participants(id) on delete cascade,
  formateur_id uuid references profils(id),
  jour date not null,
  demi_journee text not null check (demi_journee in ('matin', 'apres_midi')),
  signature text not null check (length(signature) <= 80000),   -- image PNG en data URL
  signe_le timestamptz not null default now(),
  origine text not null default 'qr' check (origine in ('qr', 'appli')),
  check ((role = 'stagiaire' and participant_id is not null and formateur_id is null)
      or (role = 'formateur' and formateur_id is not null and participant_id is null))
);
create unique index if not exists idx_emargements_stagiaire on emargements(participant_id, jour, demi_journee) where participant_id is not null;
create unique index if not exists idx_emargements_formateur on emargements(session_id, formateur_id, jour, demi_journee) where formateur_id is not null;
create index if not exists idx_emargements_session on emargements(session_id);
comment on table emargements is 'Signatures électroniques d''émargement (stagiaires et formateur), horodatées, une par personne / jour / demi-journée.';

alter table emargements enable row level security;
drop policy if exists emargements_select on emargements;
create policy emargements_select on emargements for select to authenticated
  using (
    (organisation_id = auth_organisation_id() and (
      auth_role() in ('admin', 'gestionnaire')
      or (auth_role() = 'formateur' and exists (
        select 1 from sessions_formation sf
        where sf.id = emargements.session_id and sf.formateur_id = auth.uid()
      ))
    ))
    or auth_is_super_admin()
  );
-- Pas de politique d'insertion / modification / suppression : tout passe par
-- les fonctions ci-dessous (la suppression d'une session supprime ses lignes).

-- ----------------------------------------------------------------------------
-- Page publique : charge la session, les inscrits (prénom + initiale du nom) et
-- les créneaux déjà signés. "est_formateur" = l'utilisateur connecté est le
-- formateur affecté à la session.
-- ----------------------------------------------------------------------------
create or replace function emargement_charger(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_fin date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_ouvert boolean;
  v_message text;
  v_liste jsonb;
  v_form_signes jsonb;
begin
  select s.id, s.date_debut, s.date_fin, s.statut, s.formateur_id, f.denomination, o.raison_sociale
    into v_s
  from sessions_formation s
  left join formations_catalogue f on f.id = s.formation_id
  left join organisations o on o.id = s.organisation_id
  where s.token_emargement = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Lien invalide.');
  end if;

  v_fin := coalesce(v_s.date_fin, v_s.date_debut);
  v_ouvert := v_s.statut <> 'annulee' and v_aujourdhui >= v_s.date_debut and v_aujourdhui <= v_fin;
  v_message := case
    when v_s.statut = 'annulee' then 'Cette session a été annulée ou reportée.'
    when v_aujourdhui < v_s.date_debut then 'L''émargement sera ouvert le premier jour de la formation.'
    when v_aujourdhui > v_fin then 'L''émargement de cette session est clos.'
    else null end;

  if v_ouvert then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', sp.id,
             'nom', coalesce(st.prenom, '') || ' ' || left(coalesce(st.nom, ''), 1) || '.',
             'signes', (select coalesce(jsonb_agg(jsonb_build_object('jour', e.jour, 'dj', e.demi_journee)), '[]'::jsonb)
                        from emargements e where e.participant_id = sp.id)
           ) order by st.nom, st.prenom), '[]'::jsonb)
      into v_liste
    from session_participants sp join stagiaires st on st.id = sp.stagiaire_id
    where sp.session_id = v_s.id;

    select coalesce(jsonb_agg(jsonb_build_object('jour', e.jour, 'dj', e.demi_journee)), '[]'::jsonb)
      into v_form_signes
    from emargements e where e.session_id = v_s.id and e.formateur_id is not null;
  else
    v_liste := '[]'::jsonb;
    v_form_signes := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'ok', true, 'ouvert', v_ouvert, 'message', v_message,
    'formation', v_s.denomination, 'organisme', v_s.raison_sociale,
    'date_debut', v_s.date_debut, 'date_fin', v_fin, 'aujourdhui', v_aujourdhui,
    'participants', v_liste,
    'est_formateur', (auth.uid() is not null and auth.uid() = v_s.formateur_id),
    'formateur_signes', v_form_signes);
end;
$$;

-- Vérifie la validité d'un créneau (jour dans la session, pas dans le futur).
create or replace function emargement_verifier_creneau(p_debut date, p_fin date, p_jour date, p_dj text)
returns void language plpgsql immutable as $$
declare v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if p_dj not in ('matin', 'apres_midi') then raise exception 'Demi-journée inconnue.'; end if;
  if p_jour is null or p_jour < p_debut or p_jour > p_fin then raise exception 'Ce jour ne fait pas partie de la session.'; end if;
  if p_jour > v_aujourdhui then raise exception 'Impossible de signer un jour à venir.'; end if;
end;
$$;
revoke all on function emargement_verifier_creneau(date, date, date, text) from public, anon, authenticated;

-- Signature d'un stagiaire (sans compte, via le jeton du QR code).
create or replace function emargement_enregistrer(
  p_token uuid, p_participant uuid, p_jour date, p_demi_journee text, p_signature text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_fin date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  select id, organisation_id, date_debut, date_fin, statut into v_s from sessions_formation where token_emargement = p_token;
  if not found then raise exception 'Lien invalide.'; end if;
  v_fin := coalesce(v_s.date_fin, v_s.date_debut);
  if v_s.statut = 'annulee' or v_aujourdhui < v_s.date_debut or v_aujourdhui > v_fin then
    raise exception 'L''émargement n''est pas ouvert pour cette session.';
  end if;
  perform emargement_verifier_creneau(v_s.date_debut, v_fin, p_jour, p_demi_journee);

  if not exists (select 1 from session_participants where id = p_participant and session_id = v_s.id) then
    raise exception 'Stagiaire introuvable pour cette session.';
  end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 80000 then
    raise exception 'Signature invalide.';
  end if;
  if exists (select 1 from emargements where participant_id = p_participant and jour = p_jour and demi_journee = p_demi_journee) then
    raise exception 'Ce créneau est déjà signé.';
  end if;

  insert into emargements (organisation_id, session_id, role, participant_id, jour, demi_journee, signature, origine)
  values (v_s.organisation_id, v_s.id, 'stagiaire', p_participant, p_jour, p_demi_journee, p_signature, 'qr');
  return jsonb_build_object('ok', true);
end;
$$;

-- Signature du formateur : exige d'être connecté ET d'être le formateur
-- affecté à la session (jusqu'à 7 jours après la fin, pour un oubli).
create or replace function emargement_formateur(
  p_token uuid, p_jour date, p_demi_journee text, p_signature text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_fin date;
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if auth.uid() is null then raise exception 'Connecte-toi à l''application pour signer en tant que formateur.'; end if;
  select id, organisation_id, date_debut, date_fin, statut, formateur_id into v_s from sessions_formation where token_emargement = p_token;
  if not found then raise exception 'Lien invalide.'; end if;
  if v_s.formateur_id is distinct from auth.uid() then
    raise exception 'Seul le formateur affecté à cette session peut signer.';
  end if;
  v_fin := coalesce(v_s.date_fin, v_s.date_debut);
  if v_s.statut = 'annulee' or v_aujourdhui < v_s.date_debut or v_aujourdhui > v_fin + 7 then
    raise exception 'L''émargement n''est pas ouvert pour cette session.';
  end if;
  perform emargement_verifier_creneau(v_s.date_debut, v_fin, p_jour, p_demi_journee);
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 80000 then
    raise exception 'Signature invalide.';
  end if;
  if exists (select 1 from emargements where session_id = v_s.id and formateur_id = auth.uid() and jour = p_jour and demi_journee = p_demi_journee) then
    raise exception 'Ce créneau est déjà signé.';
  end if;

  insert into emargements (organisation_id, session_id, role, formateur_id, jour, demi_journee, signature, origine)
  values (v_s.organisation_id, v_s.id, 'formateur', auth.uid(), p_jour, p_demi_journee, p_signature, 'appli');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function emargement_charger(uuid) from public;
revoke all on function emargement_enregistrer(uuid, uuid, date, text, text) from public;
revoke all on function emargement_formateur(uuid, date, text, text) from public;
grant execute on function emargement_charger(uuid) to anon, authenticated;
grant execute on function emargement_enregistrer(uuid, uuid, date, text, text) to anon, authenticated;
grant execute on function emargement_formateur(uuid, date, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- PATCH 2026-10-04e — Type de formation : initiale / recyclage
-- ---------------------------------------------------------------------------
alter table formations_catalogue add column if not exists type_formation text not null default 'initiale';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'formations_catalogue_type_formation_check') then
    alter table formations_catalogue add constraint formations_catalogue_type_formation_check check (type_formation in ('initiale', 'recyclage'));
  end if;
end $$;
alter table formations_catalogue add column if not exists formation_initiale_id uuid references formations_catalogue(id) on delete set null;
comment on column formations_catalogue.type_formation is 'initiale ou recyclage — sert à la Synthèse de session (colonnes Initial / Recyclage).';
comment on column formations_catalogue.formation_initiale_id is 'Pour une fiche de type recyclage : la fiche de formation initiale dont elle est le recyclage.';

update formations_catalogue r
set type_formation = 'recyclage', formation_initiale_id = f.id
from formations_catalogue f
where f.formation_recyclage_id = r.id
  and f.id <> r.id
  and r.formation_initiale_id is null
  and r.type_formation = 'initiale'
  and r.formation_recyclage_id is distinct from f.id;     -- ignore les liens réciproques ambigus


-- ---------------------------------------------------------------------------
-- PATCH 2026-10-05 — Familles de formation et codes Passeport de prévention
-- ---------------------------------------------------------------------------
create table if not exists referentiel_rome (
  code text primary key,
  libelle text not null
);
alter table referentiel_rome enable row level security;
drop policy if exists referentiels_select_all on referentiel_rome;
create policy referentiels_select_all on referentiel_rome for select to authenticated, anon using (true);
drop policy if exists referentiels_write on referentiel_rome;
create policy referentiels_write on referentiel_rome for all to authenticated
  using (auth_is_super_admin()) with check (auth_is_super_admin());

create table if not exists familles_formation (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,   -- vide = famille commune
  nom text not null,
  intitule text,
  certifiante boolean not null default false,
  codes_nsf text[] not null default '{}',
  codes_formacode text[] not null default '{}',
  codes_rome text[] not null default '{}',
  codes_rs text[] not null default '{}',
  fiabilite text not null default 'a_verifier',
  source_officielle text,
  remarques text,
  mots_cles text[] not null default '{}',
  modifie_manuellement boolean not null default false,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint familles_formation_fiabilite_check check (fiabilite in
    ('fiche_officielle','alignee','codes_valides','cas_particulier','hors_perimetre','a_verifier','personnalisee')),
  constraint familles_formation_nb_nsf_check check (cardinality(codes_nsf) <= 3),
  constraint familles_formation_nb_formacode_check check (cardinality(codes_formacode) <= 5),
  constraint familles_formation_nb_rome_check check (cardinality(codes_rome) <= 10),
  constraint familles_formation_long_rome_check check (length(array_to_string(codes_rome, '/')) <= 70)
);
comment on table familles_formation is 'Codes Passeport de prévention partagés par plusieurs fiches du catalogue (organisation_id vide = famille commune).';
create unique index if not exists familles_formation_nom_uniq
  on familles_formation (coalesce(organisation_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nom));

alter table familles_formation enable row level security;
drop policy if exists familles_formation_select on familles_formation;
create policy familles_formation_select on familles_formation for select to authenticated
  using (organisation_id is null or organisation_id = auth_organisation_id() or auth_is_super_admin());
drop policy if exists familles_formation_write on familles_formation;
create policy familles_formation_write on familles_formation for all to authenticated
  using ((organisation_id = auth_organisation_id() and auth_role() in ('admin','super_admin')) or auth_is_super_admin())
  with check ((organisation_id = auth_organisation_id() and auth_role() in ('admin','super_admin')) or auth_is_super_admin());

alter table formations_catalogue add column if not exists famille_id uuid references familles_formation(id) on delete set null;
comment on column formations_catalogue.famille_id is 'Famille de formation portant les codes Passeport de prévention (NSF, Formacode, ROME, RS).';

-- ----------------------------------------------------------------------------
-- Import : référentiels (insert/maj des libellés, jamais de suppression) puis
-- familles. Une admin d'organisation importe dans SON organisation ; le
-- super_admin importe les familles communes.
-- ----------------------------------------------------------------------------
create or replace function importer_catalogue_passeport(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cible uuid;
  n_ref int := 0; n_cree int := 0; n_maj int := 0; n_garde int := 0;
  x jsonb; f jsonb; existante familles_formation%rowtype;
  v_nsf text[]; v_fc text[]; v_rome text[]; v_rs text[]; v_mk text[];
begin
  if auth_role() not in ('admin','super_admin') then
    raise exception 'Réservé aux administrateurs.';
  end if;
  cible := case when auth_is_super_admin() then null else auth_organisation_id() end;

  for x in select * from jsonb_array_elements(coalesce(p->'referentiels'->'nsf','[]'::jsonb)) loop
    insert into referentiel_nsf(code, libelle) values (x->>'code', coalesce(nullif(x->>'libelle',''), x->>'code'))
      on conflict (code) do update set libelle = excluded.libelle; n_ref := n_ref + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'referentiels'->'formacode','[]'::jsonb)) loop
    insert into referentiel_formacodes(code, libelle) values (x->>'code', coalesce(nullif(x->>'libelle',''), x->>'code'))
      on conflict (code) do update set libelle = excluded.libelle; n_ref := n_ref + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'referentiels'->'rome','[]'::jsonb)) loop
    insert into referentiel_rome(code, libelle) values (x->>'code', coalesce(nullif(x->>'libelle',''), x->>'code'))
      on conflict (code) do update set libelle = excluded.libelle; n_ref := n_ref + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'referentiels'->'rs','[]'::jsonb)) loop
    insert into referentiel_certifications_pro(code, libelle, type) values (x->>'code', coalesce(nullif(x->>'libelle',''), x->>'code'), 'RS')
      on conflict (code) do update set libelle = case when excluded.libelle <> excluded.code then excluded.libelle else referentiel_certifications_pro.libelle end;
    n_ref := n_ref + 1;
  end loop;

  for f in select * from jsonb_array_elements(coalesce(p->'familles','[]'::jsonb)) loop
    select coalesce(array_agg(e), '{}') into v_nsf  from jsonb_array_elements_text(coalesce(f->'nsf','[]'::jsonb)) e;
    select coalesce(array_agg(e), '{}') into v_fc   from jsonb_array_elements_text(coalesce(f->'formacode','[]'::jsonb)) e;
    select coalesce(array_agg(e), '{}') into v_rome from jsonb_array_elements_text(coalesce(f->'rome','[]'::jsonb)) e;
    select coalesce(array_agg(e), '{}') into v_rs   from jsonb_array_elements_text(coalesce(f->'rs','[]'::jsonb)) e;
    select coalesce(array_agg(e), '{}') into v_mk   from jsonb_array_elements_text(coalesce(f->'mots_cles','[]'::jsonb)) e;

    select * into existante from familles_formation
      where organisation_id is not distinct from cible and lower(nom) = lower(f->>'nom');
    if found then
      if existante.modifie_manuellement then
        n_garde := n_garde + 1;
      else
        update familles_formation set intitule = f->>'intitule', certifiante = coalesce((f->>'certifiante')::boolean, false),
          codes_nsf = v_nsf, codes_formacode = v_fc, codes_rome = v_rome, codes_rs = v_rs,
          fiabilite = coalesce(f->>'fiabilite', 'a_verifier'), source_officielle = f->>'source_officielle',
          remarques = f->>'remarques', mots_cles = v_mk, updated_at = now()
        where id = existante.id;
        n_maj := n_maj + 1;
      end if;
    else
      insert into familles_formation(organisation_id, nom, intitule, certifiante, codes_nsf, codes_formacode, codes_rome, codes_rs,
                                     fiabilite, source_officielle, remarques, mots_cles)
      values (cible, f->>'nom', f->>'intitule', coalesce((f->>'certifiante')::boolean, false), v_nsf, v_fc, v_rome, v_rs,
              coalesce(f->>'fiabilite', 'a_verifier'), f->>'source_officielle', f->>'remarques', v_mk);
      n_cree := n_cree + 1;
    end if;
  end loop;

  return jsonb_build_object('referentiels', n_ref, 'familles_creees', n_cree, 'familles_mises_a_jour', n_maj, 'familles_conservees', n_garde);
end $$;
revoke all on function importer_catalogue_passeport(jsonb) from public;
grant execute on function importer_catalogue_passeport(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- PATCH 2026-10-05 (b) — Nom de naissance et NIR chiffré des stagiaires (voir patch_2026-10-05b_nir_nom_naissance.sql)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

alter table stagiaires add column if not exists nom_naissance text;
alter table stagiaires drop constraint if exists stagiaires_nom_naissance_long_check;
alter table stagiaires add constraint stagiaires_nom_naissance_long_check
  check (nom_naissance is null or char_length(nom_naissance) <= 30);
comment on column stagiaires.nom_naissance is 'Nom de naissance (30 caractères max.) — exigé par Passeport de prévention avec le NIR.';

-- ----- Clé de chiffrement (invisible depuis l'application) -------------------
create table if not exists secrets_applicatifs (
  nom text primary key,
  valeur text not null,
  created_at timestamptz not null default now()
);
alter table secrets_applicatifs enable row level security;   -- aucune policy = aucun accès client
revoke all on secrets_applicatifs from anon, authenticated;
insert into secrets_applicatifs(nom, valeur)
values ('cle_nir', encode(gen_random_bytes(32), 'hex'))
on conflict (nom) do nothing;

-- ----- NIR chiffré ------------------------------------------------------------
create table if not exists stagiaires_nir (
  stagiaire_id uuid primary key references stagiaires(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  nir_chiffre bytea not null,
  updated_at timestamptz not null default now()
);
alter table stagiaires_nir enable row level security;        -- aucune policy = aucun accès client direct
revoke all on stagiaires_nir from anon, authenticated;

-- ----- Journal d'accès --------------------------------------------------------
create table if not exists journal_acces_nir (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  stagiaire_id uuid,                       -- pas de clé étrangère : la trace survit à la suppression
  stagiaire_libelle text,
  user_id uuid,
  action text not null check (action in ('lecture','ecriture','suppression','export')),
  created_at timestamptz not null default now()
);
create index if not exists idx_journal_nir_org on journal_acces_nir (organisation_id, created_at desc);
alter table journal_acces_nir enable row level security;
revoke all on journal_acces_nir from anon, authenticated;

-- ----- Fonctions internes -----------------------------------------------------
create or replace function nir_cle() returns text
language sql stable security definer set search_path = public as $$
  select valeur from secrets_applicatifs where nom = 'cle_nir'
$$;
revoke all on function nir_cle() from public, anon, authenticated;

-- Vérifie le droit d'accès et renvoie l'organisation du stagiaire.
create or replace function nir_controle_acces(p_stagiaire uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null or (auth_role() not in ('admin','gestionnaire') and not auth_is_super_admin()) then
    raise exception 'Accès au NIR réservé aux rôles admin et gestionnaire.';
  end if;
  select organisation_id into v_org from stagiaires where id = p_stagiaire;
  if v_org is null or (v_org <> auth_organisation_id() and not auth_is_super_admin()) then
    raise exception 'Stagiaire introuvable ou hors organisation.';
  end if;
  return v_org;
end $$;
revoke all on function nir_controle_acces(uuid) from public, anon, authenticated;

create or replace function nir_trace(p_org uuid, p_stagiaire uuid, p_action text) returns void
language sql security definer set search_path = public as $$
  insert into journal_acces_nir(organisation_id, stagiaire_id, stagiaire_libelle, user_id, action)
  select p_org, p_stagiaire, coalesce(s.prenom || ' ' || s.nom, '(supprimé)'), auth.uid(), p_action
  from (select 1) x left join stagiaires s on s.id = p_stagiaire
$$;
revoke all on function nir_trace(uuid, uuid, text) from public, anon, authenticated;

-- ----- Enregistrer / effacer le NIR -------------------------------------------
-- Accepte 13 caractères (format Passeport) ou 15 (avec clé, qui est alors
-- vérifiée puis retirée). Texte vide = effacement.
create or replace function nir_definir(p_stagiaire uuid, p_nir text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := nir_controle_acces(p_stagiaire);
  v_nir text := upper(regexp_replace(coalesce(p_nir, ''), '[\s.\-]', '', 'g'));
  v_base text;
  v_num bigint;
begin
  if v_nir = '' then
    delete from stagiaires_nir where stagiaire_id = p_stagiaire;
    perform nir_trace(v_org, p_stagiaire, 'suppression');
    return;
  end if;
  if length(v_nir) not in (13, 15) then
    raise exception 'Le NIR doit comporter 13 caractères (ou 15 avec la clé).';
  end if;
  v_base := left(v_nir, 13);
  if v_base !~ '^[1-478][0-9]{2}(0[1-9]|1[0-2]|[2-9][0-9])([0-9]{2}|2A|2B)[0-9]{6}$' then
    raise exception 'Format de NIR invalide (sexe, année, mois, département, commune, ordre).';
  end if;
  if length(v_nir) = 15 then
    if right(v_nir, 2) !~ '^[0-9]{2}$' then raise exception 'La clé du NIR doit être numérique.'; end if;
    v_num := replace(replace(v_base, '2A', '19'), '2B', '18')::bigint;
    if (97 - (v_num % 97)) <> right(v_nir, 2)::int then
      raise exception 'La clé du NIR (2 derniers chiffres) est incorrecte : vérifie la saisie.';
    end if;
  end if;
  insert into stagiaires_nir(stagiaire_id, organisation_id, nir_chiffre, updated_at)
  values (p_stagiaire, v_org, pgp_sym_encrypt(v_base, nir_cle()), now())
  on conflict (stagiaire_id) do update set nir_chiffre = excluded.nir_chiffre, updated_at = now();
  perform nir_trace(v_org, p_stagiaire, 'ecriture');
end $$;
revoke all on function nir_definir(uuid, text) from public, anon;
grant execute on function nir_definir(uuid, text) to authenticated;

-- ----- Lire un NIR (journalisé) ------------------------------------------------
create or replace function nir_lire(p_stagiaire uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := nir_controle_acces(p_stagiaire); v_nir text;
begin
  select pgp_sym_decrypt(nir_chiffre, nir_cle()) into v_nir from stagiaires_nir where stagiaire_id = p_stagiaire;
  if v_nir is not null then perform nir_trace(v_org, p_stagiaire, 'lecture'); end if;
  return v_nir;
end $$;
revoke all on function nir_lire(uuid) from public, anon;
grant execute on function nir_lire(uuid) to authenticated;

-- ----- Lire plusieurs NIR pour un export (une ligne de journal par stagiaire) ---
create or replace function nir_lire_lot(p_ids uuid[]) returns table(stagiaire_id uuid, nir text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_org uuid; v_nir text;
begin
  foreach v_id in array coalesce(p_ids, '{}') loop
    v_org := nir_controle_acces(v_id);
    select pgp_sym_decrypt(n.nir_chiffre, nir_cle()) into v_nir from stagiaires_nir n where n.stagiaire_id = v_id;
    if v_nir is not null then
      perform nir_trace(v_org, v_id, 'export');
      stagiaire_id := v_id; nir := v_nir;
      return next;
    end if;
  end loop;
end $$;
revoke all on function nir_lire_lot(uuid[]) from public, anon;
grant execute on function nir_lire_lot(uuid[]) to authenticated;

-- ----- Savoir quels stagiaires ont un NIR (sans le révéler) -----------------------
create or replace function nir_renseignes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select n.stagiaire_id from stagiaires_nir n
  where auth.uid() is not null
    and (auth_role() in ('admin','gestionnaire') or auth_is_super_admin())
    and (n.organisation_id = auth_organisation_id() or auth_is_super_admin())
$$;
revoke all on function nir_renseignes() from public, anon;
grant execute on function nir_renseignes() to authenticated;

-- ----- Consulter le journal (admin) ---------------------------------------------
create or replace function nir_journal(p_stagiaire uuid default null, p_limite int default 100)
returns table(created_at timestamptz, action text, stagiaire_libelle text, utilisateur text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or (auth_role() <> 'admin' and not auth_is_super_admin()) then
    raise exception 'Journal d''accès au NIR réservé à l''administrateur.';
  end if;
  return query
    select j.created_at, j.action, j.stagiaire_libelle, coalesce(nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), ''), p.email, '?')
    from journal_acces_nir j left join profils p on p.id = j.user_id
    where (j.organisation_id = auth_organisation_id() or auth_is_super_admin())
      and (p_stagiaire is null or j.stagiaire_id = p_stagiaire)
    order by j.created_at desc
    limit least(coalesce(p_limite, 100), 500);
end $$;
revoke all on function nir_journal(uuid, int) from public, anon;
grant execute on function nir_journal(uuid, int) to authenticated;

-- ----- Fusion de stagiaires : reprend aussi nom de naissance et NIR ------------------
create or replace function fusionner_stagiaires(p_survivant uuid, p_doublons uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_doublon uuid;
begin
  if auth_role() not in ('admin', 'gestionnaire') and not auth_is_super_admin() then
    raise exception 'Fusion de stagiaires réservée aux rôles admin/gestionnaire.';
  end if;

  select organisation_id into v_org from stagiaires where id = p_survivant;
  if v_org is null or (v_org <> auth_organisation_id() and not auth_is_super_admin()) then
    raise exception 'Stagiaire survivant introuvable ou hors organisation.';
  end if;

  foreach v_doublon in array p_doublons loop
    if v_doublon = p_survivant then continue; end if;
    if not exists (select 1 from stagiaires where id = v_doublon and organisation_id = v_org) then
      raise exception 'Fiche doublon % introuvable ou hors organisation.', v_doublon;
    end if;

    update session_participants sp
    set stagiaire_id = p_survivant
    where sp.stagiaire_id = v_doublon
      and not exists (
        select 1 from session_participants sp2
        where sp2.session_id = sp.session_id and sp2.stagiaire_id = p_survivant
      );

    delete from session_participants where stagiaire_id = v_doublon;

    -- Le NIR du doublon est conservé si le survivant n'en a pas.
    update stagiaires_nir set stagiaire_id = p_survivant
    where stagiaire_id = v_doublon
      and not exists (select 1 from stagiaires_nir where stagiaire_id = p_survivant);

    update stagiaires s
    set
      civilite = coalesce(nullif(s.civilite, ''), d.civilite),
      date_naissance = coalesce(s.date_naissance, d.date_naissance),
      lieu_naissance = coalesce(nullif(s.lieu_naissance, ''), d.lieu_naissance),
      nom_naissance = coalesce(nullif(s.nom_naissance, ''), d.nom_naissance),
      email = coalesce(nullif(s.email, ''), d.email),
      telephone = coalesce(nullif(s.telephone, ''), d.telephone),
      client_id = coalesce(s.client_id, d.client_id),
      notes = case
        when d.notes is null or d.notes = '' then s.notes
        when s.notes is null or s.notes = '' then d.notes
        else s.notes || E'\n' || d.notes
      end
    from stagiaires d
    where s.id = p_survivant and d.id = v_doublon;

    delete from stagiaires where id = v_doublon;
  end loop;
end;
$$;
grant execute on function fusionner_stagiaires(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- PATCH 2026-10-05 (c) — Espace client (voir patch_2026-10-05c_espace_client.sql)
-- ---------------------------------------------------------------------------
-- ----- 0. CORRECTIF DE SÉCURITÉ : utilisateur sans profil ---------------------------------
-- Avant ce patch, auth_role() renvoyait NULL pour un compte sans ligne dans
-- "profils" (ce qui sera le cas des comptes clients). Or, dans plusieurs
-- fonctions, un test du genre « auth_role() not in ('admin','gestionnaire')
-- and not super_admin » donne alors NULL (et non VRAI) : la vérification de
-- rôle était silencieusement contournée. auth_role() renvoie maintenant
-- 'aucun' pour un compte sans profil : tous ces tests le refusent.
create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profils where id = auth.uid()), 'aucun')
$$;

-- Contrôles d'accès au NIR renforcés (rôle ET organisation explicitement vérifiés).
create or replace function nir_controle_acces(p_stagiaire uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null or not (auth_role() in ('admin','gestionnaire') or auth_is_super_admin()) then
    raise exception 'Accès au NIR réservé aux rôles admin et gestionnaire.';
  end if;
  select organisation_id into v_org from stagiaires where id = p_stagiaire;
  if v_org is null or not (v_org is not distinct from auth_organisation_id() or auth_is_super_admin()) then
    raise exception 'Stagiaire introuvable ou hors organisation.';
  end if;
  return v_org;
end $$;
revoke all on function nir_controle_acces(uuid) from public, anon, authenticated;

-- ----- 1. Comptes clients -----------------------------------------------------
create table if not exists acces_clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  client_id uuid not null references clients(id) on delete cascade,
  prenom text,
  nom text,
  fonction text,
  email text,
  actif boolean not null default true,
  derniere_connexion timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_acces_clients_client on acces_clients (client_id);
alter table acces_clients enable row level security;
drop policy if exists acces_clients_staff on acces_clients;
create policy acces_clients_staff on acces_clients for all to authenticated
  using ((organisation_id = auth_organisation_id() and auth_role() in ('admin','gestionnaire')) or auth_is_super_admin())
  with check ((organisation_id = auth_organisation_id() and auth_role() in ('admin','gestionnaire')) or auth_is_super_admin());

create or replace function auth_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from acces_clients where user_id = auth.uid() and actif
$$;
revoke all on function auth_client_id() from public, anon;
grant execute on function auth_client_id() to authenticated;

-- ----- 2. Documents publiés ----------------------------------------------------
alter table documents_generes add column if not exists publie_client boolean not null default false;
alter table documents_generes add column if not exists publie_le timestamptz;
alter table documents_generes add column if not exists document_origine_id uuid references documents_generes(id) on delete set null;
alter table documents_generes drop constraint if exists documents_generes_type_check;
alter table documents_generes add constraint documents_generes_type_check check (type in (
  'devis','convention','convocation','feuille_presence',
  'attestation_fin_formation','certificat_realisation',
  'certificat_competence','bilan_formation','grille_certification',
  'convention_signee'
));
create index if not exists idx_documents_generes_client on documents_generes (client_id, session_id) where publie_client;

-- ----- 3. Signatures de convention ----------------------------------------------
create table if not exists signatures_conventions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  session_id uuid references sessions_formation(id) on delete set null,
  client_id uuid not null references clients(id),
  document_id uuid not null unique references documents_generes(id) on delete cascade,   -- la convention d'origine
  document_signe_id uuid references documents_generes(id) on delete set null,            -- la convention signée
  user_id uuid,
  nom_signataire text not null,
  fonction_signataire text,
  empreinte_sha256 text,                                                                  -- empreinte de la convention d'origine
  signe_le timestamptz not null default now()
);
alter table signatures_conventions enable row level security;
drop policy if exists signatures_conventions_staff on signatures_conventions;
create policy signatures_conventions_staff on signatures_conventions for select to authenticated
  using ((organisation_id = auth_organisation_id() and auth_role() in ('admin','gestionnaire')) or auth_is_super_admin());

-- ----- 4. Stockage : accès du client aux fichiers -----------------------------------
create or replace function client_peut_lire_fichier(p_nom text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_client_id() is not null and exists (
    select 1 from documents_generes d
    where d.storage_path = p_nom and d.publie_client and d.client_id = auth_client_id()
  )
$$;
revoke all on function client_peut_lire_fichier(text) from public, anon;
grant execute on function client_peut_lire_fichier(text) to authenticated;

-- Dépôt autorisé uniquement sous {organisation}/{session}/signees/{client}/…
create or replace function client_peut_deposer_fichier(p_nom text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_client_id() is not null and exists (
    select 1 from acces_clients a
    where a.user_id = auth.uid() and a.actif
      and p_nom like a.organisation_id::text || '/%/signees/' || a.client_id::text || '/%'
  )
$$;
revoke all on function client_peut_deposer_fichier(text) from public, anon;
grant execute on function client_peut_deposer_fichier(text) to authenticated;

drop policy if exists documents_bucket_client_select on storage.objects;
create policy documents_bucket_client_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and client_peut_lire_fichier(name));

drop policy if exists documents_bucket_client_insert on storage.objects;
create policy documents_bucket_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and client_peut_deposer_fichier(name));

-- ----- 5a. NIR : cœur d'écriture partagé (staff et client) --------------------------
create or replace function nir_ecrire(p_org uuid, p_stagiaire uuid, p_nir text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_nir text := upper(regexp_replace(coalesce(p_nir, ''), '[\s.\-]', '', 'g'));
  v_base text;
  v_num bigint;
begin
  if v_nir = '' then
    delete from stagiaires_nir where stagiaire_id = p_stagiaire;
    perform nir_trace(p_org, p_stagiaire, 'suppression');
    return;
  end if;
  if length(v_nir) not in (13, 15) then
    raise exception 'Le NIR doit comporter 13 caractères (ou 15 avec la clé).';
  end if;
  v_base := left(v_nir, 13);
  if v_base !~ '^[1-478][0-9]{2}(0[1-9]|1[0-2]|[2-9][0-9])([0-9]{2}|2A|2B)[0-9]{6}$' then
    raise exception 'Format de NIR invalide (sexe, année, mois, département, commune, ordre).';
  end if;
  if length(v_nir) = 15 then
    if right(v_nir, 2) !~ '^[0-9]{2}$' then raise exception 'La clé du NIR doit être numérique.'; end if;
    v_num := replace(replace(v_base, '2A', '19'), '2B', '18')::bigint;
    if (97 - (v_num % 97)) <> right(v_nir, 2)::int then
      raise exception 'La clé du NIR (2 derniers chiffres) est incorrecte : vérifie la saisie.';
    end if;
  end if;
  insert into stagiaires_nir(stagiaire_id, organisation_id, nir_chiffre, updated_at)
  values (p_stagiaire, p_org, pgp_sym_encrypt(v_base, nir_cle()), now())
  on conflict (stagiaire_id) do update set nir_chiffre = excluded.nir_chiffre, updated_at = now();
  perform nir_trace(p_org, p_stagiaire, 'ecriture');
end $$;
revoke all on function nir_ecrire(uuid, uuid, text) from public, anon, authenticated;

create or replace function nir_definir(p_stagiaire uuid, p_nir text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform nir_ecrire(nir_controle_acces(p_stagiaire), p_stagiaire, p_nir);
end $$;
revoke all on function nir_definir(uuid, text) from public, anon;
grant execute on function nir_definir(uuid, text) to authenticated;

-- Journal : affiche aussi le nom des comptes clients.
create or replace function nir_journal(p_stagiaire uuid default null, p_limite int default 100)
returns table(created_at timestamptz, action text, stagiaire_libelle text, utilisateur text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (auth_role() = 'admin' or auth_is_super_admin()) then
    raise exception 'Journal d''accès au NIR réservé à l''administrateur.';
  end if;
  return query
    select j.created_at, j.action, j.stagiaire_libelle,
      coalesce(nullif(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), ''), p.email,
               case when ac.user_id is not null then 'Client : ' || coalesce(nullif(trim(coalesce(ac.prenom,'') || ' ' || coalesce(ac.nom,'')), ''), ac.email, '?') end,
               '?')
    from journal_acces_nir j
    left join profils p on p.id = j.user_id
    left join acces_clients ac on ac.user_id = j.user_id
    where (j.organisation_id = auth_organisation_id() or auth_is_super_admin())
      and (p_stagiaire is null or j.stagiaire_id = p_stagiaire)
    order by j.created_at desc
    limit least(coalesce(p_limite, 100), 500);
end $$;
revoke all on function nir_journal(uuid, int) from public, anon;
grant execute on function nir_journal(uuid, int) to authenticated;

-- ----- 5b. Fonctions de l'espace client ------------------------------------------------
-- La session appartient-elle au client courant ?
create or replace function client_a_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_client_id() is not null and exists (
    select 1 from sessions_formation s
    where s.id = p_session
      and (s.client_id = auth_client_id()
        or exists (select 1 from session_clients sc where sc.session_id = s.id and sc.client_id = auth_client_id())
        or exists (select 1 from session_participants sp where sp.session_id = s.id and sp.client_id = auth_client_id()))
  )
$$;
revoke all on function client_a_session(uuid) from public, anon;

-- Le stagiaire est-il l'un des stagiaires du client courant ?
create or replace function client_a_stagiaire(p_stagiaire uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_client_id() is not null and exists (
    select 1 from stagiaires st
    where st.id = p_stagiaire
      and (st.client_id = auth_client_id()
        or exists (select 1 from session_participants sp where sp.stagiaire_id = st.id and sp.client_id = auth_client_id()))
  )
$$;
revoke all on function client_a_stagiaire(uuid) from public, anon;

-- Identité du compte client connecté (et trace de la connexion).
create or replace function client_contexte() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return null; end if;
  update acces_clients set derniere_connexion = now() where user_id = auth.uid() and actif;
  select jsonb_build_object(
    'client_id', c.id, 'client', c.raison_sociale,
    'prenom', a.prenom, 'nom', a.nom, 'email', a.email,
    'organisme', o.raison_sociale)
  into r
  from acces_clients a join clients c on c.id = a.client_id join organisations o on o.id = a.organisation_id
  where a.user_id = auth.uid() and a.actif;
  return r;
end $$;
revoke all on function client_contexte() from public, anon;
grant execute on function client_contexte() to authenticated;

-- Liste des sessions du client, avec l'état de sa convention et de ses stagiaires.
create or replace function client_sessions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_client uuid := auth_client_id(); r jsonb;
begin
  if v_client is null then raise exception 'Accès réservé aux comptes clients.'; end if;
  select coalesce(jsonb_agg(x order by x->>'date_debut' desc), '[]'::jsonb) into r from (
    select jsonb_build_object(
      'id', s.id, 'numero_session', s.numero_session, 'formation', f.denomination,
      'date_debut', s.date_debut, 'date_fin', s.date_fin, 'lieu', s.lieu, 'ville', s.ville, 'statut', s.statut,
      'nb_stagiaires', (select count(*) from session_participants sp where sp.session_id = s.id and sp.client_id = v_client),
      'nb_infos_manquantes', (select count(*) from session_participants sp
          join stagiaires st on st.id = sp.stagiaire_id
          where sp.session_id = s.id and sp.client_id = v_client
            and (coalesce(st.nom_naissance,'') = '' or not exists (select 1 from stagiaires_nir n where n.stagiaire_id = st.id))),
      'convention_id', (select d.id from documents_generes d where d.session_id = s.id and d.client_id = v_client and d.type = 'convention' and d.publie_client order by d.genere_le desc limit 1),
      'convention_signee', exists (select 1 from signatures_conventions sg where sg.session_id = s.id and sg.client_id = v_client),
      'nb_documents', (select count(*) from documents_generes d where d.session_id = s.id and d.client_id = v_client and d.publie_client)
    ) as x
    from sessions_formation s join formations_catalogue f on f.id = s.formation_id
    where client_a_session(s.id)
  ) t;
  return r;
end $$;
revoke all on function client_sessions() from public, anon;
grant execute on function client_sessions() to authenticated;

-- Documents publiés pour le client, pour une session.
create or replace function client_documents(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_client uuid := auth_client_id(); r jsonb;
begin
  if v_client is null or not client_a_session(p_session) then raise exception 'Session introuvable.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'type', d.type, 'storage_path', d.storage_path, 'publie_le', coalesce(d.publie_le, d.genere_le),
      'stagiaire', nullif(trim(coalesce(st.prenom,'') || ' ' || coalesce(st.nom,'')), ''),
      'signee', exists (select 1 from signatures_conventions sg where sg.document_id = d.id),
      'signe_le', (select sg.signe_le from signatures_conventions sg where sg.document_id = d.id),
      'signataire', (select sg.nom_signataire from signatures_conventions sg where sg.document_id = d.id)
    ) order by d.type, st.nom, d.genere_le), '[]'::jsonb) into r
  from documents_generes d left join stagiaires st on st.id = d.stagiaire_id
  where d.session_id = p_session and d.client_id = v_client and d.publie_client;
  return r;
end $$;
revoke all on function client_documents(uuid) from public, anon;
grant execute on function client_documents(uuid) to authenticated;

-- Stagiaires du client pour une session, avec les informations à compléter.
create or replace function client_stagiaires(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_client uuid := auth_client_id(); r jsonb;
begin
  if v_client is null or not client_a_session(p_session) then raise exception 'Session introuvable.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', st.id, 'civilite', st.civilite, 'prenom', st.prenom, 'nom', st.nom,
      'nom_naissance', st.nom_naissance, 'date_naissance', st.date_naissance, 'lieu_naissance', st.lieu_naissance,
      'email', st.email, 'telephone', st.telephone,
      'nir_renseigne', exists (select 1 from stagiaires_nir n where n.stagiaire_id = st.id)
    ) order by st.nom, st.prenom), '[]'::jsonb) into r
  from session_participants sp join stagiaires st on st.id = sp.stagiaire_id
  where sp.session_id = p_session and sp.client_id = v_client;
  return r;
end $$;
revoke all on function client_stagiaires(uuid) from public, anon;
grant execute on function client_stagiaires(uuid) to authenticated;

-- Mise à jour des informations d'un stagiaire par le client (champs autorisés uniquement).
create or replace function client_maj_stagiaire(p_stagiaire uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_dn date;
begin
  if not client_a_stagiaire(p_stagiaire) then raise exception 'Stagiaire introuvable.'; end if;
  if p_data ? 'date_naissance' and coalesce(p_data->>'date_naissance','') <> '' then
    begin v_dn := (p_data->>'date_naissance')::date;
    exception when others then raise exception 'Date de naissance invalide.'; end;
    if v_dn > current_date or v_dn < date '1900-01-01' then raise exception 'Date de naissance invalide.'; end if;
  end if;
  if length(coalesce(p_data->>'nom_naissance','')) > 30 then raise exception 'Nom de naissance : 30 caractères maximum.'; end if;
  update stagiaires s set
    civilite       = case when p_data ? 'civilite'       then nullif(trim(p_data->>'civilite'),'')       else s.civilite end,
    nom_naissance  = case when p_data ? 'nom_naissance'  then nullif(trim(p_data->>'nom_naissance'),'')  else s.nom_naissance end,
    date_naissance = case when p_data ? 'date_naissance' then v_dn                                       else s.date_naissance end,
    lieu_naissance = case when p_data ? 'lieu_naissance' then nullif(trim(p_data->>'lieu_naissance'),'') else s.lieu_naissance end,
    email          = case when p_data ? 'email'          then nullif(trim(p_data->>'email'),'')          else s.email end,
    telephone      = case when p_data ? 'telephone'      then nullif(trim(p_data->>'telephone'),'')      else s.telephone end
  where s.id = p_stagiaire;
end $$;
revoke all on function client_maj_stagiaire(uuid, jsonb) from public, anon;
grant execute on function client_maj_stagiaire(uuid, jsonb) to authenticated;

-- NIR saisi par le client : enregistré chiffré, jamais relisible par le client.
create or replace function client_nir_definir(p_stagiaire uuid, p_nir text) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not client_a_stagiaire(p_stagiaire) then raise exception 'Stagiaire introuvable.'; end if;
  if coalesce(trim(p_nir), '') = '' then raise exception 'NIR vide.'; end if;
  select organisation_id into v_org from stagiaires where id = p_stagiaire;
  perform nir_ecrire(v_org, p_stagiaire, p_nir);
end $$;
revoke all on function client_nir_definir(uuid, text) from public, anon;
grant execute on function client_nir_definir(uuid, text) to authenticated;

-- Signature de la convention : le PDF signé est déposé par le client dans
-- {organisation}/{session}/signees/{client}/…, puis déclaré ici.
create or replace function client_signer_convention(p_document uuid, p_nom text, p_fonction text, p_chemin text, p_empreinte text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid := auth_client_id();
  d documents_generes%rowtype;
  v_signe uuid;
begin
  if v_client is null then raise exception 'Accès réservé aux comptes clients.'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Le nom du signataire est obligatoire.'; end if;
  select * into d from documents_generes
  where id = p_document and type = 'convention' and publie_client and client_id = v_client;
  if not found then raise exception 'Convention introuvable.'; end if;
  if exists (select 1 from signatures_conventions where document_id = p_document) then
    raise exception 'Cette convention est déjà signée.';
  end if;
  if p_chemin is null or not client_peut_deposer_fichier(p_chemin)
     or p_chemin not like d.organisation_id::text || '/' || d.session_id::text || '/signees/' || v_client::text || '/%' then
    raise exception 'Chemin du fichier signé invalide.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'documents' and name = p_chemin) then
    raise exception 'Le fichier signé n''a pas été déposé.';
  end if;
  insert into documents_generes(organisation_id, session_id, client_id, type, storage_path, publie_client, publie_le, document_origine_id)
  values (d.organisation_id, d.session_id, v_client, 'convention_signee', p_chemin, true, now(), d.id)
  returning id into v_signe;
  insert into signatures_conventions(organisation_id, session_id, client_id, document_id, document_signe_id, user_id,
                                     nom_signataire, fonction_signataire, empreinte_sha256)
  values (d.organisation_id, d.session_id, v_client, d.id, v_signe, auth.uid(),
          trim(p_nom), nullif(trim(coalesce(p_fonction,'')), ''), p_empreinte);
  return v_signe;
end $$;
revoke all on function client_signer_convention(uuid, text, text, text, text) from public, anon;
grant execute on function client_signer_convention(uuid, text, text, text, text) to authenticated;




-- ============================================================================
-- DONNÉES DE DÉMONSTRATION
-- ============================================================================

insert into organisations (id, slug, raison_sociale, forme_juridique, siret, numero_declaration_activite, rcs, tva_intracommunautaire, adresse, code_postal, ville, telephone, email_contact, pied_de_page_documents, representant_nom, representant_qualite, code_naf, exercice_jour_debut, exercice_mois_debut)
values (
  '00000000-0000-0000-0000-000000000001',
  'previsecours',
  'SARL Prévisecours',
  'SARL au capital de 5000€',
  '88120528000012',
  '53290938829',
  'RCS Quimper',
  'FR65 881205280',
  null,
  null,
  'Riec-sur-Bélon',
  null,
  null,
  'Prévisecours, Santé et sécurité au travail - SARL au capital de 5000€ — SIRET : 88120528000012 – RCS Quimper - n° TVA intracommunautaire : FR65 881205280',
  'Claude KERYHUEL',
  'co-gérant',
  '8559A',
  1,
  4  -- exercice comptable du 1er avril au 31 mars (conforme au BPF réel de Prévisecours)
);

-- Un client de démonstration
insert into clients (id, organisation_id, raison_sociale, ville)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'EPISAVEURS-POMONA', 'St Jacques de la Lande');

insert into contacts_client (organisation_id, client_id, nom, prenom, contact_principal)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Contact', 'Démo', true);

-- Catalogue : deux entrées SST (initiale / MAC), une entrée CACES, une habilitation électrique
insert into formations_catalogue (id, organisation_id, code, categorie, denomination, prix, duree_heures, objectifs, consignes_convocation, cycle_mois)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', 'SSTi', 'Secourisme', 'Sauveteur Secouriste du Travail — Formation initiale', 165, 14,
   'Permettre au Sauveteur Secouriste du Travail d''intervenir face à un accident et de s''intégrer dans la démarche de prévention des risques professionnels de l''entreprise.',
   E'• Tenue de travail adaptée à la formation\n• Chaussures de sécurité', 24),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', 'MAC-SST', 'Secourisme', 'Maintien des Acquis et Compétences du Sauveteur Secouriste du Travail', 540, 7,
   'Permettre au Sauveteur Secouriste du Travail d''intervenir face à un accident et de s''intégrer dans la démarche de prévention des risques professionnels de l''entreprise.',
   E'• Tenue de travail adaptée à la formation\n• Chaussures de sécurité', 24),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', 'CACES-R486-A', 'CACES', 'CACES® R486 — Plates-formes élévatrices mobiles de personnel — Catégorie A', null, 14,
   'Acquérir les compétences théoriques et pratiques pour conduire les plates-formes élévatrices mobiles de personnes en toute sécurité.', null, null),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001', 'HABELEC-NE', 'Habilitation électrique', 'Habilitation électrique — Personnel non électricien', null, 7,
   'Habiliter le personnel non électricien à exécuter des opérations d''ordre non électrique en sécurité.', null, null);

-- SSTi renvoie vers MAC-SST à échéance
update formations_catalogue set formation_recyclage_id = '00000000-0000-0000-0000-000000000402'
where id = '00000000-0000-0000-0000-000000000401';

-- Un stagiaire, et deux sessions de démonstration : une MAC-SST déjà suivie
-- il y a ~23 mois (fait apparaître une alerte de recyclage sur le tableau de
-- bord, l'échéance des 24 mois arrivant dans ~30 jours), et une nouvelle
-- session planifiée.
insert into stagiaires (id, organisation_id, client_id, civilite, nom, prenom, date_naissance)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'M.', 'DEMO', 'Stagiaire', '1990-01-01');

insert into sessions_formation (id, organisation_id, formation_id, client_id, lieu, date_debut, date_fin, statut)
values (
  '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000101', 'EPISAVEURS-POMONA', current_date - interval '700 days', current_date - interval '700 days', 'terminee'
);

insert into session_clients (organisation_id, session_id, client_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101');

insert into session_participants (organisation_id, session_id, stagiaire_id, client_id, statut)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'certifie');

insert into sessions_formation (id, organisation_id, formation_id, client_id, lieu, date_debut, date_fin, statut)
values (
  '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000101', 'EPISAVEURS-POMONA', current_date + interval '14 days', current_date + interval '14 days', 'planifiee'
);

insert into session_clients (organisation_id, session_id, client_id)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101');

insert into session_participants (organisation_id, session_id, stagiaire_id, client_id, statut)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'inscrit');

-- ============================================================================
-- FIN — Après ce script :
-- 1. Créer un compte via Supabase Auth (email/mot de passe).
-- 2. Insérer manuellement la ligne "profils" correspondante avec
--    organisation_id = '00000000-0000-0000-0000-000000000001' et role = 'admin'.
-- ============================================================================
