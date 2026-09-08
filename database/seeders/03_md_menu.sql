-- ================================================================
-- Seed: 03_md_menu.sql
-- Core menus: Dashboard, User, Permission, Menu, Action, Website Settings, Akun
-- ================================================================
SET search_path TO public;


INSERT INTO public."md_menu" ("kd_menu", "nm_menu", "icon_menu", "link_menu", "kd_parent", "status", "level", "urut", "urut_global", "created_at") VALUES
('MN_MAIN', 'Menu Utama', NULL, NULL, NULL, 'A', 1, 1, 1, '2026-07-31T02:11:16.957Z'),
('MN_DASH', 'Dashboard', 'ri-dashboard-line', '/', 'MN_MAIN', 'A', 2, 1, 2, '2026-07-30T04:55:40.906Z'),
('MN5EDCD6', 'Master Data', NULL, NULL, NULL, 'A', 1, 2, 3, '2026-07-31T06:58:05.844Z'),
('MN_USER', 'Pengguna', 'ri-user-line', '/master/user', 'MN5EDCD6', 'A', 2, 1, 4, '2026-08-04T01:07:18.992Z'),
('MN598C32', 'Manajemen Pengguna', 'ri-user-settings-line', NULL, 'MN5EDCD6', 'A', 2, 2, 5, '2026-08-04T04:49:58.329Z'),
('MN_PERM', 'Izin Umum', 'ri-shield-keyhole-line', '/master/permission', 'MN598C32', 'A', 3, 1, 6, '2026-07-31T03:10:49.269Z'),
('MN_PPRV', 'Izin Khusus', 'ri-shield-user-line', '/master/permission/private', 'MN598C32', 'A', 3, 2, 7, '2026-07-31T03:10:49.269Z'),
('MNDA48B0', 'Manajemen Menu', 'ri-list-settings-line', NULL, 'MN5EDCD6', 'A', 2, 3, 8, '2026-08-04T04:48:33.534Z'),
('MN_SYSMN', 'Menu', 'ri-menu-4-fill', '/system/menu', 'MNDA48B0', 'A', 3, 1, 9, '2026-07-30T04:55:40.906Z'),
('MN_SYSAC', 'Aksi', 'ri-shield-flash-line', '/system/action', 'MNDA48B0', 'A', 3, 2, 10, '2026-07-30T04:55:40.906Z'),
('MNCAD5D6', 'Pengaturan', NULL, NULL, NULL, 'A', 1, 3, 11, '2026-08-10T08:43:50.808Z'),
('MN_SYSWS', 'Website Settings', 'ri-settings-3-line', '/system/website', 'MNCAD5D6', 'A', 2, 1, 12, '2026-08-10T06:52:00.911Z'),
('MN_SYS', 'Akun', NULL, NULL, NULL, 'A', 1, 4, 13, '2026-07-30T04:55:40.906Z'),
('MN555DCC', 'Ganti Password', 'ri-key-line', '/account/password', 'MN_SYS', 'A', 2, 1, 14, '2026-08-05T06:44:41.879Z'),
('MNC1178A', 'Logout', 'ri-logout-circle-line', '/auth/logout', 'MN_SYS', 'A', 2, 2, 15, '2026-08-05T06:41:38.758Z')
ON CONFLICT ("kd_menu") DO UPDATE SET
    "nm_menu" = EXCLUDED."nm_menu",
    "icon_menu" = EXCLUDED."icon_menu",
    "link_menu" = EXCLUDED."link_menu",
    "kd_parent" = EXCLUDED."kd_parent",
    "status" = EXCLUDED."status",
    "level" = EXCLUDED."level",
    "urut" = EXCLUDED."urut",
    "urut_global" = EXCLUDED."urut_global",
    "created_at" = EXCLUDED."created_at";
