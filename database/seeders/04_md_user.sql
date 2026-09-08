-- ================================================================
-- Seed: 04_md_user.sql
-- Default super admin only
-- ================================================================
SET search_path TO public;


INSERT INTO public."md_user" ("uid_user_system", "nama", "username", "password", "kd_role", "status_user", "is_deleted", "created_at", "updated_at", "email", "failed_login_attempts", "is_locked", "password_changed_at") VALUES
('00000000-0000-0000-0000-000000000001', 'Super Administrator', 'super', '543a114a20358409b5b274bc05da3d06c0df7e5c00a0935ee1ae90dc9fc3ca75', 'RS001', 'A', FALSE, '2026-07-30T04:55:40.906Z', '2026-08-06T04:22:49.584Z', 'devinalum@inalum.id', 0, FALSE, NOW())
ON CONFLICT ("uid_user_system") DO UPDATE SET
    "nama" = EXCLUDED."nama",
    "username" = EXCLUDED."username",
    "password" = EXCLUDED."password",
    "kd_role" = EXCLUDED."kd_role",
    "status_user" = EXCLUDED."status_user",
    "is_deleted" = EXCLUDED."is_deleted",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at",
    "email" = EXCLUDED."email",
    "failed_login_attempts" = EXCLUDED."failed_login_attempts",
    "is_locked" = EXCLUDED."is_locked",
    "password_changed_at" = EXCLUDED."password_changed_at";

-- Seed current password into history if empty (idempotent)
INSERT INTO public.d_password_history (uid_user_system, password_hash, created_at)
SELECT '00000000-0000-0000-0000-000000000001',
       '543a114a20358409b5b274bc05da3d06c0df7e5c00a0935ee1ae90dc9fc3ca75',
       NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.d_password_history
    WHERE uid_user_system = '00000000-0000-0000-0000-000000000001'
);
