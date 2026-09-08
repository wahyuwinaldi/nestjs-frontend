-- ================================================================
-- Seed: 01_md_role.sql
-- Generated at: 2026-08-11T09:35:01.127Z
-- From: public seed
-- Table: public.md_role
-- ================================================================
SET search_path TO public;


INSERT INTO public."md_role" ("kd_role", "nm_role", "status", "is_deleted", "created_at", "updated_at") VALUES
('RS001', 'Super Administrator', 'A', FALSE, '2026-07-30T04:55:40.906Z', '2026-08-11T01:42:37.836Z'),
('RS002', 'Administrator', 'A', FALSE, '2026-08-05T03:22:37.281Z', '2026-08-11T01:42:43.181Z'),
('RS003', 'User', 'A', FALSE, '2026-08-04T07:53:36.217Z', '2026-08-07T06:08:09.252Z')
ON CONFLICT ("kd_role") DO UPDATE SET
    "nm_role" = EXCLUDED."nm_role",
    "status" = EXCLUDED."status",
    "is_deleted" = EXCLUDED."is_deleted",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

-- exported_rows=3
