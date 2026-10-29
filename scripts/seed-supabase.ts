/* Checks the Supabase project (tables, image bucket) and loads the starter catalogue into empty tables.
   Usage: npm run seed:supabase   (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local) */
import { SupabaseRepo } from '../src/lib/db/supabase';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}

async function main() {
  const repo = new SupabaseRepo(url!, key!);
  const problems = await repo.healthCheck();
  if (problems.length) {
    console.error('Supabase is not ready:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  console.log('Supabase OK: tables and the public "garments" image bucket exist.');
  const done = await repo.seedIfEmpty();
  console.log(done.length ? `Inserted: ${done.join(', ')}` : 'Nothing to seed: the tables already have data.');
}

main().catch(e => { console.error(e); process.exit(1); });
