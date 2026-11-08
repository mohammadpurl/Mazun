import path from 'node:path';
import { LocalRepo } from './local';
import type { Repo } from './repo';
import { SupabaseRepo } from './supabase';

export type { Repo } from './repo';
export { ConflictError } from './repo';

let repo: Repo | undefined;

/** Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, otherwise the local JSON store in ./data.
 *  MEZON_STORE=local forces the local store even with Supabase keys (development against demo data). */
export function db(): Repo {
  if (repo) return repo;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const local = process.env.MEZON_STORE === 'local' || !url || !key;
  repo = local ? new LocalRepo(path.join(process.cwd(), 'data')) : new SupabaseRepo(url, key);
  return repo;
}
