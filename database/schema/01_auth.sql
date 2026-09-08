-- ============================================================================
-- API Template - 01_auth.sql
-- Schema "public": authentication / authorization core tables (self-contained,
-- does not depend on any table outside this schema).
-- Safe to re-run (idempotent): uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

SET search_path TO public;

-- ----------------------------------------------------------------------------
-- md_role: application roles (RS001 Super Administrator, RS002 Administrator, RS003 User, …)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_role (
    kd_role     VARCHAR(10)  PRIMARY KEY,
    nm_role     VARCHAR(100) NOT NULL,
    status      CHAR(1)      NOT NULL DEFAULT 'A', -- A=active, E=inactive
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- md_user: application users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_user (
    uid_user_system VARCHAR(36)  PRIMARY KEY,
    nama            VARCHAR(250) NOT NULL,
    email           VARCHAR(255), -- opsional
    username        VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(150) NOT NULL, -- sha256 hex digest (64 chars)
    kd_role         VARCHAR(10)  NOT NULL REFERENCES public.md_role(kd_role) ON UPDATE CASCADE ON DELETE RESTRICT,
    status_user     CHAR(1)      NOT NULL DEFAULT 'A', -- A=active, N=inactive
    is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    is_locked       BOOLEAN      NOT NULL DEFAULT FALSE,
    password_changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Idempotent upgrades for existing installations
ALTER TABLE public.md_user
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.md_user
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.md_user
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- d_password_history: recent password hashes (incl. current) for reuse policy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_password_history (
    id              BIGSERIAL    PRIMARY KEY,
    uid_user_system VARCHAR(36)  NOT NULL REFERENCES public.md_user(uid_user_system) ON UPDATE CASCADE ON DELETE CASCADE,
    password_hash   VARCHAR(150) NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_d_password_history_uid_created
    ON public.d_password_history (uid_user_system, created_at DESC);

-- ----------------------------------------------------------------------------
-- d_password_reset_token: forgot / admin / expired-change one-time tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_password_reset_token (
    id              BIGSERIAL    PRIMARY KEY,
    token_hash      VARCHAR(64)  NOT NULL UNIQUE,
    uid_user_system VARCHAR(36)  NOT NULL REFERENCES public.md_user(uid_user_system) ON UPDATE CASCADE ON DELETE CASCADE,
    purpose         VARCHAR(32)  NOT NULL, -- forgot | admin | expired_change
    expires_at      TIMESTAMP    NOT NULL,
    used_at         TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_d_password_reset_token_uid
    ON public.d_password_reset_token (uid_user_system);

-- ----------------------------------------------------------------------------
-- md_menu: application menu tree
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_menu (
    kd_menu     VARCHAR(10)  PRIMARY KEY,
    nm_menu     VARCHAR(100) NOT NULL,
    icon_menu   TEXT,
    link_menu   VARCHAR(250),
    kd_parent   VARCHAR(10)  REFERENCES public.md_menu(kd_menu) ON UPDATE CASCADE ON DELETE SET NULL,
    status      CHAR(1)      NOT NULL DEFAULT 'A',
    level       INTEGER      NOT NULL DEFAULT 1,
    urut        INTEGER      NOT NULL DEFAULT 0,
    urut_global INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- md_action: available CRUD-ish actions (AC=Access, IN=Insert, UP=Update,
-- DT=Delete, VW=View)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_action (
    kd_action   VARCHAR(10)  PRIMARY KEY,
    kode        VARCHAR(25)  NOT NULL, -- AC / IN / UP / DT / VW
    nm_action   VARCHAR(100) NOT NULL,
    deskripsi   VARCHAR(500),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- d_action_menu: catalog of which actions are applicable for a given menu
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_action_menu (
    kd_menu     VARCHAR(10) NOT NULL REFERENCES public.md_menu(kd_menu) ON UPDATE CASCADE ON DELETE CASCADE,
    kd_action   VARCHAR(10) NOT NULL REFERENCES public.md_action(kd_action) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (kd_menu, kd_action)
);

-- ----------------------------------------------------------------------------
-- d_permissions: role-level grants (menu + action per role)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_permissions (
    kd_permission VARCHAR(20) PRIMARY KEY,
    kd_role       VARCHAR(10) NOT NULL REFERENCES public.md_role(kd_role) ON UPDATE CASCADE ON DELETE CASCADE,
    kd_menu       VARCHAR(10) NOT NULL REFERENCES public.md_menu(kd_menu) ON UPDATE CASCADE ON DELETE CASCADE,
    kd_action     VARCHAR(10) NOT NULL REFERENCES public.md_action(kd_action) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (kd_role, kd_menu, kd_action)
);

-- ----------------------------------------------------------------------------
-- d_permissions_private: per-user permission overrides (grants specific to a
-- single user, independent of role)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_permissions_private (
    kd_permission   VARCHAR(20) PRIMARY KEY,
    uid_user_system VARCHAR(36) NOT NULL REFERENCES public.md_user(uid_user_system) ON UPDATE CASCADE ON DELETE CASCADE,
    kd_menu         VARCHAR(10) NOT NULL REFERENCES public.md_menu(kd_menu) ON UPDATE CASCADE ON DELETE CASCADE,
    kd_action       VARCHAR(10) NOT NULL REFERENCES public.md_action(kd_action) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (uid_user_system, kd_menu, kd_action)
);

-- ----------------------------------------------------------------------------
-- d_application: registered client applications (matches APP_KEY / API_TOKEN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.d_application (
    app_key       VARCHAR(50)  PRIMARY KEY,
    nama_aplikasi VARCHAR(100) NOT NULL,
    deskripsi     VARCHAR(500),
    domain        VARCHAR(200),
    api_token     VARCHAR(150),
    status        CHAR(1)      NOT NULL DEFAULT 'A',
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Views
-- ============================================================================

DROP VIEW IF EXISTS public.v_legacy CASCADE;
DROP VIEW IF EXISTS public.v_user CASCADE;

-- v_user: user + role, convenient for login / profile lookups
CREATE OR REPLACE VIEW public.v_user AS
SELECT
    u.uid_user_system,
    u.nama,
    u.email,
    u.username,
    u.password,
    u.kd_role,
    r.nm_role,
    u.status_user,
    u.is_deleted,
    u.failed_login_attempts,
    u.is_locked,
    u.password_changed_at
FROM public.md_user u
JOIN public.md_role r ON r.kd_role = u.kd_role
WHERE u.is_deleted = FALSE;

-- v_menu_public: role-based menu + action grants (used to build the menu
-- tree / permission checks for an authenticated role)
CREATE OR REPLACE VIEW public.v_menu_public AS
SELECT
    p.kd_permission,
    p.kd_role,
    p.kd_menu,
    m.nm_menu,
    m.icon_menu,
    m.link_menu,
    m.kd_parent,
    m.status,
    m.level,
    m.urut,
    m.urut_global,
    a.kd_action,
    a.kode,
    a.nm_action,
    a.deskripsi
FROM public.d_permissions p
JOIN public.md_menu m ON m.kd_menu = p.kd_menu
JOIN public.md_action a ON a.kd_action = p.kd_action
WHERE m.status = 'A'
ORDER BY m.urut_global, m.level, m.urut;

-- v_menu_private: per-user permission overrides
CREATE OR REPLACE VIEW public.v_menu_private AS
SELECT
    p.kd_permission,
    p.uid_user_system,
    p.kd_menu,
    m.nm_menu,
    m.icon_menu,
    m.link_menu,
    m.kd_parent,
    m.status,
    m.level,
    m.urut,
    m.urut_global,
    a.kd_action,
    a.kode,
    a.nm_action,
    a.deskripsi
FROM public.d_permissions_private p
JOIN public.md_menu m ON m.kd_menu = p.kd_menu
JOIN public.md_action a ON a.kd_action = p.kd_action
WHERE m.status = 'A'
ORDER BY m.urut_global, m.level, m.urut;
