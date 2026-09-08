# Dashboard Template (Vue 3 + Vite + PrimeVue)

Scaffolding frontend untuk dashboard admin: auth, user, menu, action, permission, settings, dan layout Sakai.

## Fitur inti

| Area | Path |
|------|------|
| Dashboard | `/` |
| User | `/master/user` |
| Role & Permission | `/master/permission` |
| Permission Private | `/master/permission/private` |
| Menu | `/system/menu` |
| Action | `/system/action` |
| Website Settings | `/system/website` |
| Ganti Password | `/account/password` |
| Login | `/auth/login` |

## Setup

```bash
npm install
cp .env.development.example .env.development
npm run dev
```

Pastikan backend API berjalan di `http://localhost:3000` (proxy Vite `/api`).
