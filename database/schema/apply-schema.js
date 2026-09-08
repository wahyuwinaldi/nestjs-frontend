#!/usr/bin/env node
/**
 * database/schema/apply-schema.js
 *
 * Applies every *.sql file in this folder (in filename order) against the
 * application database, using the DB_* variables from `.env.development`
 * (or the real environment). Avoids relying on the `psql` CLI being on PATH,
 * which is unreliable on Windows.
 *
 * Usage:
 *   node database/schema/apply-schema.js
 *   npm run db:schema
 */

'use strict';

const path = require('path');
const fs = require('fs');

(function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '..', '.env.development');
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const dotenv = require('dotenv');
    dotenv.config({ path: fs.existsSync(envPath) ? envPath : undefined });
  } catch (err) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx === -1) return;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      });
    }
  }
})();

const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'template',
  });

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort();

  console.log(`[schema] target: ${client.user}@${client.host}:${client.port}/${client.database}`);
  console.log(`[schema] files: ${files.join(', ')}`);

  await client.connect();
  try {
    for (const file of files) {
      const fullPath = path.join(__dirname, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`[schema] applying ${file} ...`);
      await client.query(sql);
      console.log(`[schema] OK: ${file}`);
    }
    console.log('[schema] Done.');
  } catch (err) {
    console.error('[schema] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
