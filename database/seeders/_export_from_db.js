#!/usr/bin/env node
/**
 * database/seeders/_export_from_db.js
 *
 * Exports a full, idempotent SQL snapshot from the current database
 * (schema `public`) into `database/seeders/*.sql`.
 *
 * This is used to bootstrap production later:
 *   npm run db:schema
 *   npm run db:seed
 *
 * Note: the snapshot includes users (with password hash) and permissions—
 * so it may be sensitive. Do not export/commit unintentionally.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

const OUT_DIR = __dirname;

(function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '..', '.env.development');
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const dotenv = require('dotenv');
    dotenv.config({ path: fs.existsSync(envPath) ? envPath : undefined });
  } catch (err) {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    });
  }
})();

function escapeIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function looksNumericLiteral(s) {
  // Accept ints and decimals; reject empty string.
  return /^-?\d+(\.\d+)?$/.test(s);
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;

  if (typeof value === 'string') {
    if (looksNumericLiteral(value)) return value;
    return `'${value.replace(/'/g, "''")}'`;
  }

  // Fallback: stringify as SQL string.
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function getColumns(client, tableName) {
  const res = await client.query(
    `
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = $1
ORDER BY ordinal_position
`,
    [tableName],
  );
  return res.rows.map((r) => r.column_name);
}

async function getRows(client, tableName, columns, orderByColumns) {
  const colsSql = columns.map(escapeIdent).join(', ');
  const orderSql = (orderByColumns && orderByColumns.length > 0)
    ? ` ORDER BY ${orderByColumns.map(escapeIdent).join(', ')}`
    : '';

  const res = await client.query(
    `SELECT ${colsSql} FROM public.${escapeIdent(tableName)}${orderSql}`,
  );
  return res.rows;
}

function buildUpsert(sqlTable, columns, pkColumns, rows) {
  const pkSet = new Set(pkColumns);
  const nonPkColumns = columns.filter((c) => !pkSet.has(c));

  const colsSql = columns.map(escapeIdent).join(', ');

  if (nonPkColumns.length === 0) {
    // Composite PK but no other columns.
    return [
      `INSERT INTO public.${escapeIdent(sqlTable)} (${colsSql}) VALUES`,
      rows.map((row) => `(${columns.map((c) => toSqlLiteral(row[c])).join(', ')})`).join(',\n'),
      `ON CONFLICT (${pkColumns.map(escapeIdent).join(', ')}) DO NOTHING;`,
    ].join('\n');
  }

  const updateSql = nonPkColumns
    .map((c) => `${escapeIdent(c)} = EXCLUDED.${escapeIdent(c)}`)
    .join(',\n    ');

  return [
    `INSERT INTO public.${escapeIdent(sqlTable)} (${colsSql}) VALUES`,
    rows.map((row) => `(${columns.map((c) => toSqlLiteral(row[c])).join(', ')})`).join(',\n'),
    `ON CONFLICT (${pkColumns.map(escapeIdent).join(', ')}) DO UPDATE SET`,
    `    ${updateSql};`,
  ].join('\n');
}

function writeSeedFile({ filename, headerLines, sql }) {
  const fullPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(fullPath, `${headerLines.join('\n')}\n\n${sql}\n`, 'utf8');
  return fullPath;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'template',
  });

  await client.connect();

  try {
    const tables = [
      { filename: '01_md_role.sql', table: 'md_role', pk: ['kd_role'], orderBy: ['kd_role'] },
      { filename: '02_md_action.sql', table: 'md_action', pk: ['kd_action'], orderBy: ['kd_action'] },
      { filename: '03_md_menu.sql', table: 'md_menu', pk: ['kd_menu'], orderBy: ['urut_global', 'level', 'urut'] },
      { filename: '04_md_user.sql', table: 'md_user', pk: ['uid_user_system'], orderBy: ['kd_role', 'username'] },
      { filename: '05_d_action_menu.sql', table: 'd_action_menu', pk: ['kd_menu', 'kd_action'], orderBy: ['kd_menu', 'kd_action'] },
      { filename: '06_d_permissions.sql', table: 'd_permissions', pk: ['kd_permission'], orderBy: ['kd_role', 'kd_menu', 'kd_action'] },
      { filename: '07_d_permissions_private.sql', table: 'd_permissions_private', pk: ['kd_permission'], orderBy: ['uid_user_system', 'kd_menu', 'kd_action'] },
      { filename: '08_d_application.sql', table: 'd_application', pk: ['app_key'], orderBy: ['app_key'] },
      { filename: '09_md_settings.sql', table: 'md_settings', pk: ['id_settings'], orderBy: ['id_settings'] },
    ];

    const nowIso = new Date().toISOString();

    for (const t of tables) {
      const columns = await getColumns(client, t.table);
      const rows = await getRows(client, t.table, columns, t.orderBy);

      const headerLines = [
        `-- ================================================================`,
        `-- Seed: ${t.filename}`,
        `-- Generated at: ${nowIso}`,
        `-- From: ${process.env.DB_HOST || 'localhost'} / ${process.env.DB_NAME || 'template'} (schema public)`,
        `-- Table: public.${t.table}`,
        `-- ================================================================`,
        `SET search_path TO public;`,
        ``,
      ];

      const sql = rows.length === 0
        ? `-- No rows in public.${t.table}`
        : `${buildUpsert(t.table, columns, t.pk, rows)}\n\n-- exported_rows=${rows.length}`;

      const fullPath = writeSeedFile({ filename: t.filename, headerLines, sql });
      console.log(`[export] wrote ${path.basename(fullPath)} (${rows.length} rows)`);
    }

    // Sequences (serial PKs). Keep this in a dedicated file so it runs last.
    const serialTargets = [];

    const seqLines = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const st of serialTargets) {
      const seqRes = await client.query(
        `SELECT pg_get_serial_sequence($1, $2) AS seq`,
        [`public.${st.table}`, st.col],
      );
      const seqName = seqRes.rows[0]?.seq;
      if (!seqName) continue;

      const maxRes = await client.query(
        `SELECT MAX(${escapeIdent(st.col)})::bigint AS maxval FROM public.${escapeIdent(st.table)}`,
      );
      const maxval = maxRes.rows[0]?.maxval;
      const nextBase = (maxval === null || maxval === undefined) ? 0 : Number(maxval);

      seqLines.push(
        `SELECT setval('${seqName}', COALESCE((SELECT MAX(${escapeIdent(st.col)}) FROM public.${escapeIdent(st.table)}), ${nextBase}), true);`,
      );
    }

    const sequencesHeader = [
      `-- ================================================================`,
      `-- Seed: 99_sequences.sql`,
      `-- Generated at: ${nowIso}`,
      `-- ================================================================`,
      `SET search_path TO public;`,
    ];

    const seqSql = seqLines.length === 0 ? '-- No serial sequences detected' : seqLines.join('\n');
    writeSeedFile({ filename: '99_sequences.sql', headerLines: sequencesHeader, sql: seqSql });
    console.log('[export] wrote 99_sequences.sql');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[export] Failed:', e);
  process.exitCode = 1;
});

