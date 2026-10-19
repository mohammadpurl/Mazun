import path from 'node:path';
import { LocalRepo } from './local';
import type { Repo } from './repo';
import { SupabaseRepo } from './supabase';

export type { Repo } from './repo';

let repo: Repo | undefined;

/** Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, otherwise the local JSON store in ./data. */
export function db(): Repo {
  if (repo) return repo;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  repo = url && key ? new SupabaseRepo(url, key) : new LocalRepo(path.join(process.cwd(), 'data'));
  return repo;
}
