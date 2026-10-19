# Setup

The site works with no setup in demo mode: open `index.html` through a local server and `admin.html` in the same browser.
Garments saved in demo mode live only in that browser. To go live, connect Supabase and (optionally) the AI function.

## 1. Supabase (garments, images, admin login)
1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase/schema.sql` -> Run.
3. Authentication -> Users -> **Add user** (your email + password). Then Authentication -> Sign In / Providers -> turn **off** "Allow new users to sign up", so only you can be an admin.
4. Project Settings -> API: copy the Project URL and the **anon** key into `app-config.js` (`supabaseUrl`, `supabaseKey`). Never put the service_role key in this file.
5. Open `admin.html`, sign in, press "وارد کردن لباس‌های فعلی" to load the current garments, then edit them.

## 2. AI (size advice, styling, arrival advice, virtual try-on)
Needs the Supabase CLI and two API keys: an Anthropic key (text and size) and a Gemini key (image try-on).
```
supabase functions deploy ai
supabase secrets set ANTHROPIC_API_KEY=... GEMINI_API_KEY=...
```
Then set `aiEndpoint` in `app-config.js` to `https://<project-ref>.supabase.co/functions/v1/ai`.
Each AI request costs money and the endpoint is callable by anyone who opens the site, so before launch restrict
`Access-Control-Allow-Origin` in `supabase/functions/ai/index.ts` to your domain and consider rate limiting.
Without `aiEndpoint` the shop still shows built-in demo answers (size from height and weight, canned style tips,
a simple photo overlay for the try-on, and the computed arrival dates).

## 3. Arrival planner
`prepDays`, `shipDays` and `bufferDays` in `app-config.js`, plus the per-garment "extra preparation days" in the admin panel,
decide the latest order date for an event.
