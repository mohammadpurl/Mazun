/* Loads the starter catalogue (collections, products, settings) into an empty Supabase project.
   Usage: npm run seed:supabase   (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local) */
import { SupabaseRepo } from '../src/lib/db/supabase';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}
new SupabaseRepo(url, key).seedIfEmpty().then(
  done => console.log(done.length ? `Inserted: ${done.join(', ')}` : 'Nothing to do: the tables already have data.'),
  e => { console.error(e); process.exit(1); },
);
