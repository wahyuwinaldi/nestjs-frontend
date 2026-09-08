-- ================================================================
-- Seed: 09_md_settings.sql
-- Generic website settings placeholders (upload assets via admin UI)
-- ================================================================
SET search_path TO public;


INSERT INTO public."md_settings" ("id_settings", "nm_settings", "kode", "value", "is_deleted", "tgl_insert") VALUES
('ST001', 'Color Logo', 'logo-color', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST002', 'Small Color Logo', 'logo-color-sm', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST003', 'White Logo', 'logo-white', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST004', 'Small White Logo', 'logo-white-sm', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST005', 'Login Background', 'login-bg', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST006', 'Website Icon', 'favicon', NULL, FALSE, '2026-08-10T06:52:00.908Z'),
('ST009', 'UI Theme', 'ui-theme', '{"primary":"emerald","surface":null,"preset":"Aura","menuMode":"static"}', FALSE, '2026-08-14T01:00:00.000Z')
ON CONFLICT ("id_settings") DO UPDATE SET
    "nm_settings" = EXCLUDED."nm_settings",
    "kode" = EXCLUDED."kode",
    "value" = EXCLUDED."value",
    "is_deleted" = EXCLUDED."is_deleted",
    "tgl_insert" = EXCLUDED."tgl_insert";
