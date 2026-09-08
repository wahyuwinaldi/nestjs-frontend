-- ================================================================
-- Seed: 05_d_action_menu.sql
-- Extra action bindings (Confirm on Website Settings)
-- ================================================================
SET search_path TO public;


INSERT INTO public."d_action_menu" ("kd_menu", "kd_action") VALUES
('MN_SYSWS', 'ACT_F09EDD')
ON CONFLICT ("kd_menu", "kd_action") DO NOTHING;
