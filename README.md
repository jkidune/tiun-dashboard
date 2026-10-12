# tiun. dashboard

Subscription and usage-billing console built with Next.js 16 (App Router), React 19, Prisma 6 and PostgreSQL.

## First-time setup

1. Create an empty database in PostgreSQL (pgAdmin, or `psql -U postgres`):

   ```sql
   CREATE DATABASE tiun;
   ```

2. Copy `.env.example` to `.env` and put your PostgreSQL password in `DATABASE_URL`.

3. Install, create the tables and load sample data:

   ```bash
   npm install
   npx prisma migrate dev --name init
   npm run db:seed
   ```

4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

**Start fresh:** open http://localhost:3000/signup to create an empty workspace. Every page shows a setup prompt until you add data.

**Or explore sample data:** run `npm run db:seed` and sign in as **amina@akoya.test** (Owner) with the `SEED_PASSWORD` from `.env` (default `tiun-demo-2026`).
Other seeded accounts, all with the same password: `neema@akoya.test` (Admin), `daudi@akoya.test` (Developer), `zawadi@akoya.test` (Viewer).

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run db:seed` | Wipe and reload the sample workspace |
| `npm run db:reset` | Drop all tables, re-run migrations and seed |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run build` | Production build |

## How it fits together

- `prisma/schema.prisma`: tables (workspaces, team members, customers, plans, sessions, transactions, API keys, request logs, webhooks, coupons, activity).
- `lib/auth.ts`: email + password sign-in, httpOnly session cookies, role permissions.
- `lib/context.ts`: the signed-in member plus the global Live/Sandbox and month selections (stored in cookies).
- `lib/metrics.ts`: KPI and chart queries.
- `app/actions/*`: server actions for every form; each checks the member's role.
- `app/(console)/*`: the pages. `app/api/v1/*`: public REST API. `app/api/export/*`: CSV exports.

## Public API

Create a key on the **APIs** page, then:

```bash
curl http://localhost:3000/api/v1/customers -H "Authorization: Bearer sk_live_..."
```

Endpoints: `GET/POST /api/v1/customers`, `GET /api/v1/transactions`, `POST /api/v1/sessions`. Every call is logged and shows up in the APIs request log.

## Roles

| | Owner | Admin | Developer | Viewer |
| --- | --- | --- | --- | --- |
| View everything | ✓ | ✓ | ✓ | ✓ |
| API keys, webhooks, sign-in methods | ✓ | ✓ | ✓ | |
| Customers, refunds, plans, settings, team | ✓ | ✓ | | |
| Billing and ownership transfer | ✓ | | | |

## Images

`public/avatars` and `public/banners` hold the photos used in the app. The four football photos in `public/` are not used.
