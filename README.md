# API Template (NestJS + Fastify)

Scaffolding backend untuk proyek baru: auth, user, menu, action, permission, settings.

## Stack
- NestJS 11 + Fastify
- PostgreSQL schema `public`
- JWT (cookie AES) + `x-api-key`
- Swagger: http://localhost:3000/api/docs
- MinIO (opsional) + SMTP via MailModule

## Setup DB
```bash
# buat database di Postgres, lalu:
npm run db:schema
npm run db:seed
```

Sesuaikan `.env.development` (lihat `.env.example`).

## Run
```bash
npm install
npm run start:dev
```

## Akun seed
- username: `super`
- password: sesuai hash di `database/seeders/04_md_user.sql` (ganti setelah seed)

Pastikan `APP_KEY` / `API_TOKEN` di env cocok dengan baris di `08_d_application.sql`.

## Modul inti
| Area | Path |
|------|------|
| Login | `POST /auth/authorize` |
| User | `/master/user` |
| Permission | `/master/permission` |
| Menu / Action | `/system/menu`, `/system/action` |
| Website Settings | `/system/website` |

## Test
```bash
npm test
```
