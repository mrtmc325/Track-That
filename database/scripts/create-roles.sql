-- Per security.least_privilege_everywhere — each service role has access only to its own schema.
-- No cross-schema writes; read-only grants are explicit and minimal.

-- ---------------------------------------------------------------------------
-- auth_svc: owns the auth schema
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE auth_svc WITH LOGIN PASSWORD 'CHANGE_ME_auth_svc';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA auth TO auth_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO auth_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_svc;

-- ---------------------------------------------------------------------------
-- catalog_svc: owns the catalog schema
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE catalog_svc WITH LOGIN PASSWORD 'CHANGE_ME_catalog_svc';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA catalog TO catalog_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO catalog_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO catalog_svc;

-- ---------------------------------------------------------------------------
-- commerce_svc: owns commerce; reads catalog and promotions
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE commerce_svc WITH LOGIN PASSWORD 'CHANGE_ME_commerce_svc';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA commerce TO commerce_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA commerce TO commerce_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA commerce
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commerce_svc;

GRANT USAGE ON SCHEMA catalog TO commerce_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO commerce_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT SELECT ON TABLES TO commerce_svc;

GRANT USAGE ON SCHEMA promotions TO commerce_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA promotions TO commerce_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA promotions GRANT SELECT ON TABLES TO commerce_svc;

-- ---------------------------------------------------------------------------
-- promotions_svc: owns promotions; reads catalog
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE promotions_svc WITH LOGIN PASSWORD 'CHANGE_ME_promotions_svc';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA promotions TO promotions_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA promotions TO promotions_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA promotions
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO promotions_svc;

GRANT USAGE ON SCHEMA catalog TO promotions_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO promotions_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT SELECT ON TABLES TO promotions_svc;

-- ---------------------------------------------------------------------------
-- search_svc: read-only on catalog
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE ROLE search_svc WITH LOGIN PASSWORD 'CHANGE_ME_search_svc';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA catalog TO search_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO search_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog GRANT SELECT ON TABLES TO search_svc;
