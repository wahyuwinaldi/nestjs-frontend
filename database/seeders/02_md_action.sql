-- ================================================================
-- Seed: 02_md_action.sql
-- Generated at: 2026-08-11T09:35:01.127Z
-- From: public seed
-- Table: public.md_action
-- ================================================================
SET search_path TO public;


INSERT INTO public."md_action" ("kd_action", "kode", "nm_action", "deskripsi", "created_at") VALUES
('ACT_AC', 'AC', 'Access', 'Hak akses membuka menu', '2026-07-30T04:55:40.906Z'),
('ACT_DT', 'DT', 'Delete', 'Hak akses menghapus data', '2026-07-30T04:55:40.906Z'),
('ACT_F09EDD', 'CF', 'Confirm', 'Hak melakukan konfirmasi request', '2026-08-07T02:34:17.763Z'),
('ACT_IN', 'IN', 'Insert', 'Hak akses menambah data', '2026-07-30T04:55:40.906Z'),
('ACT_UP', 'UP', 'Update', 'Hak akses mengubah data', '2026-07-30T04:55:40.906Z'),
('ACT_VW', 'VW', 'View', 'Hak akses melihat data', '2026-07-30T04:55:40.906Z')
ON CONFLICT ("kd_action") DO UPDATE SET
    "kode" = EXCLUDED."kode",
    "nm_action" = EXCLUDED."nm_action",
    "deskripsi" = EXCLUDED."deskripsi",
    "created_at" = EXCLUDED."created_at";

-- exported_rows=6
