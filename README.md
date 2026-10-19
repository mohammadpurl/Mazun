# Mezon — abaya shop with admin panel

Next.js 15 + TypeScript, Supabase in production. Shop in Persian, Arabic and English; admin panel in Persian.

## What is in it

**Shop (`/`)** — the garment rail from the original static site: hover/tap to flip a garment, open it for
front/back, sizes, price (with sale price), and the shopper tools (size guide, virtual try-on, style tips,
arrival planner). Category filter chips appear when there is more than one category with garments in it.

**Ordering** — the customer picks a size, enters name, mobile, city/address, an optional event date and a note.
The order is saved first (it gets a number, e.g. #1001), then the customer gets a ready-made message for the
shop's WhatsApp / Telegram / Instagram. Sold-out sizes and hidden garments are refused by the server.

**Admin panel (`/admin`)**, password-protected:

| Page | What it does |
|---|---|
| Dashboard | New and open orders, this month's sales, sold-out sizes, orders per day (14 days), top garments, latest orders |
| Orders | Filter by status, search by number/name/phone/garment, change status inline, details drawer with admin note, WhatsApp/call the customer, Excel (CSV) export |
| Garments | Display order (drag or ▲▼), show/hide, edit: names fa/ar/en, category, price, sale price, extra prep days, front/back images (auto-resized to WebP), sizes and stock, size chart, descriptions |
| Categories | Add, rename, hide, reorder, delete (garments become uncategorised, not deleted) |
| Site settings | Brand, tagline, ticker text, currency, order channel and handles, prep/ship/buffer days for the arrival planner |

## Run locally

```bash
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD and SESSION_SECRET (32+ chars)
npm run dev                   # http://localhost:5188  and  /admin
```

Without Supabase keys the app runs in **local mode**: data in `data/store.json` (seeded with the original eight
garments on first run) and uploads in `data/uploads/`. Delete `data/store.json` to start over. Local mode is for
development only — serverless hosts do not keep files.

```bash
npm run check   # typecheck + tests
npm run build
```

## Go live (Supabase + any Next.js host, e.g. Vercel)

1. Create a Supabase project. SQL Editor → paste `supabase/schema.sql` → Run. It creates the tables, the
   `garments` image bucket, and seeds the categories and the original garments (only into empty tables).
2. Set the environment variables on the host: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role). The service-role key stays on the server;
   the browser never talks to Supabase directly, and the tables have RLS on with no policies, so customer phone
   numbers are not reachable with the public key.
3. Open `/admin` → Site settings → set the WhatsApp number (or Telegram/Instagram). Until a handle for the chosen
   channel is set, the shop still saves orders and tells the customer you will contact them.

### Optional AI tools

Set `ANTHROPIC_API_KEY` (size advice, style tips, arrival note) and/or `GEMINI_API_KEY` (photo try-on). Without
them the shop uses its built-in answers. Calls cost money; `/api/ai` is rate-limited per visitor (in memory, per
server instance) and only fetches the site's own garment images.

## Notes

- Admin login is a single password with a signed, HTTP-only, SameSite=strict cookie (7 days); 8 wrong tries
  per 15 minutes per IP are allowed. Admin API routes check the session again and refuse cross-site requests.
- Order prices and garment names are snapshotted when the order is placed, so later edits do not rewrite history.
- Dashboard days follow the shop's time zone (`Asia/Muscat`, see `src/lib/stats.ts`).
- `legacy-static/` holds the original static prototype for reference; nothing imports it.
