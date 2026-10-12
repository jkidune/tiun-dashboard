# tiun. dashboard

Subscription and usage-billing console built with Next.js 16 (App Router), React 19, Prisma 6 and PostgreSQL.

## First-time setup

1. Create an empty database in PostgreSQL (pgAdmin, or `psql -U postgres`):

   ```sql
   CREATE DATABASE tiun;
   ```

2. Copy `.env.example` to `.env` and put your PostgreSQL password in `DATABASE_URL` and `DIRECT_URL` (locally they are the same).

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

## Deploying (Vercel + Neon)

1. **Neon:** in your project's dashboard, click **Connect** and copy two connection strings:
   - the **pooled** one (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one (turn off "Connection pooling") → `DIRECT_URL`
2. **Vercel:** *Add New → Project*, import `jkidune/tiun-dashboard` from GitHub. Leave the framework as Next.js.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled string |
   | `DIRECT_URL` | Neon direct string |
   | `APP_URL` | Your Vercel address, e.g. `https://tiun-dashboard.vercel.app` (you can add it after the first deploy) |

4. Click **Deploy**. The `vercel-build` script creates the tables (`prisma migrate deploy`) and then builds.
5. Open `/signup` on your live address to create the first workspace.
6. **Region:** in Vercel → Settings → Functions, pick the region closest to your Neon database (e.g. Frankfurt `fra1` with Neon `aws-eu-central-1`).

Every push to `main` then redeploys, and any new migrations are applied automatically.

**Never run `npm run db:seed` against the live database.** It deletes all data first; the script refuses to run unless the database is on `localhost`.

## Images

`public/avatars` and `public/banners` hold the photos used in the app. The four football photos in `public/` are not used.
