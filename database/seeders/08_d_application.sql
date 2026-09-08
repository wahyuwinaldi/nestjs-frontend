-- ================================================================
-- Seed: 08_d_application.sql
-- ================================================================
SET search_path TO public;


INSERT INTO public."d_application" ("app_key", "nama_aplikasi", "deskripsi", "domain", "api_token", "status", "is_deleted", "created_at") VALUES
('aba50071a406547be2fece2aa8cf3961595b5c3064f735e6', 'API Template', 'NestJS + Fastify API template', 'http://localhost:5173', '559d381e81162a17a4ea03061a8bd9da3b2362b3cb3c311cc59ec421b9202764', 'A', FALSE, '2026-07-30T04:55:40.906Z')
ON CONFLICT ("app_key") DO UPDATE SET
    "nama_aplikasi" = EXCLUDED."nama_aplikasi",
    "deskripsi" = EXCLUDED."deskripsi",
    "domain" = EXCLUDED."domain",
    "api_token" = EXCLUDED."api_token",
    "status" = EXCLUDED."status",
    "is_deleted" = EXCLUDED."is_deleted",
    "created_at" = EXCLUDED."created_at";
