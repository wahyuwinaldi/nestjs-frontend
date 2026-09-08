-- ============================================================================
-- API Template - 05_settings.sql
-- Website Settings (branding assets)
-- ============================================================================

SET search_path TO public;

-- ----------------------------------------------------------------------------
-- md_settings: website branding / config files
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_settings (
    id_settings VARCHAR(10) PRIMARY KEY,
    nm_settings VARCHAR(100) NOT NULL,
    kode        VARCHAR(100) NOT NULL,
    value       TEXT,
    is_deleted  BOOLEAN DEFAULT FALSE,
    tgl_insert  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_md_settings_kode_active
    ON public.md_settings (kode)
    WHERE is_deleted = FALSE;
