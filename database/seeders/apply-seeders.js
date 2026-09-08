#!/usr/bin/env node
/**
 * database/seeders/apply-seeders.js
 *
 * Applies every *.sql file in this folder (in filename order) against the
 * application database, using DB_* variables from `.env.development`
 * (or the real environment).
 *
 * Intended production flow:
 *   npm run db:schema
 *   npm run db:seed
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

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

  console.log(`[seed] target: ${client.user}@${client.host}:${client.port}/${client.database}`);
  console.log(`[seed] files: ${files.join(', ')}`);

  await client.connect();
  try {
    for (const file of files) {
      const fullPath = path.join(__dirname, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`[seed] applying ${file} ...`);
      await client.query(sql);
      console.log(`[seed] OK: ${file}`);
    }
    console.log('[seed] Done.');
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

