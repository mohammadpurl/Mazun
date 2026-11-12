# Mazun Atelier — boutique with admin panel

Next.js 15 + TypeScript, Supabase in production. Shop in English, Arabic and Persian (Arabic and Persian mirror
right-to-left); admin panel in Persian. The shop follows the "Mazun Atelier" design (tokens: ivory, sand, espresso,
olive; Source Serif 4 / Noto Naskh Arabic; 2px radius).

## What is in it

**Shop**

| Where | What it does |
|---|---|
| `/` | The editorial hero and the brass rack, then one section each for try-on, size and the set |
| AI stylist | A button floating on every shop page except `/stylist`, which has its own chat, opens the conversation: it picks a garment from the catalogue, finds the size in the chat or with the camera, sends her to try it on and builds the set. On a product page it starts with that piece |
| `/collection` | Every piece as flip cards |
| Camera sizing | She gives her height and stands back; pose landmarks found in the browser give shoulder and hip widths, from which a bust estimate picks a size (`src/lib/body-scan.ts`). No frame leaves the device; the result is always called an estimate |
| The rack | On the home page. Garments hang side-on on one rail; hover, keyboard focus or a tap turns a piece to its back and parts its neighbours; the caption links to the piece and to the stylist; swipe when the rail overflows |
| Product drawer (`?p=<id>`) | Front / back / detail, colours, sizes, stock line, add to bag, wishlist, try-on and stylist buttons, fabric and delivery |
| Size assistant | Height, usual size, fit, length, optional measurements → a recommended size in stock with the size guide (`recommendSize` in `src/lib/fit.ts`) |
| `/fitting-room` | Upload a full-length photo or a short video (one frame is used) → preview of the garment on the customer (Gemini), slider or side-by-side comparison; without a key, a simple overlay |
| `/stylist` | A garment plus shayla, bag, jewellery and shoes; occasion presets, replace per role, chat (Claude); add the whole look to the bag |
| Bag and checkout | Bag kept in the browser; checkout saves the order (numbered, priced on the server), then sends the customer to WhatsApp/Telegram/Instagram with the order |

Garments without photos are drawn as coloured silhouettes, and empty campaign images show a sand placeholder, so
the shop looks finished before photography arrives.

**Admin panel (`/admin`)**, password-protected: dashboard; orders (multi-item, status, notes, WhatsApp the customer,
CSV export); products (garments for the rack and accessories for the stylist, with colours, sizes, size chart,
front/back/detail images, sale price, "New" label, display order); collections (name, description, image, order);
site settings (brand, chat channel, delivery days, home-page images, featured piece).

## Run locally

```bash
npm install
cp .env.example .env.local   # then set ADMIN_PASSWORD and SESSION_SECRET (32+ chars)
npm run dev                   # http://localhost:5188  and  /admin
```

Without Supabase keys the app runs in **local mode**: data in `data/store.json` (seeded with the design's catalogue
on first run) and uploads in `data/uploads/`. Delete `data/store.json` to start over. Local mode is for
development only — serverless hosts do not keep files.

```bash
npm run check   # typecheck + tests
npm run build
```

## Go live (Supabase + any Next.js host, e.g. Vercel)

1. Create a Supabase project. SQL Editor → paste `supabase/schema.sql` → Run.
2. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, then load the starter catalogue:
   `npm run seed:supabase` (it only fills empty tables).
3. Set the environment variables on the host: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`. The service-role key stays on the server; the browser never talks to Supabase
   directly, and the tables have RLS on with no policies, so customer phone numbers are not reachable with the public key.
4. Open `/admin` → Site settings → set the WhatsApp number (or Telegram/Instagram), the home-page images, and
   upload product photos under Products.

### AI (fitting room and stylist)

- `GEMINI_API_KEY` — virtual try-on on the customer's photo (`IMAGE_MODEL`, default `gemini-2.5-flash-image`).
- `ANTHROPIC_API_KEY` — the floating AI stylist and the stylist page's chat answer from your own catalogue (`CLAUDE_MODEL`, default `claude-opus-5-5`).

Without them the shop uses built-in behaviour (overlay preview, preset looks, and a keyword reading of the customer's message in `src/lib/concierge.ts`). Each call costs money; `/api/ai` is
rate-limited per visitor (in memory, per server instance). The server looks products up by id itself, and
customer photos are never stored.

## Notes

- Admin login is a single password with a signed, HTTP-only, SameSite=strict cookie (7 days); 8 wrong tries
  per 15 minutes per IP are allowed. Admin API routes check the session again and refuse cross-site requests.
- Order prices and names are snapshotted when the order is placed, so later edits do not rewrite history.
- Language: a `lang` cookie set by the switcher, else the browser's language, else English.
- Dashboard days follow the shop's time zone (`Asia/Muscat`, see `src/lib/stats.ts`).
- `legacy-static/` holds the original static prototype for reference; nothing imports it.
