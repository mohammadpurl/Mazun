// Dev server on the local demo store (data/store.json), even when .env.local has Supabase keys, so the admin panel
// can be tried against demo data (npm run seed:demo) without touching the live database. Values in .env.demo.local
// (not committed) override .env.local, e.g. a separate demo ADMIN_PASSWORD. Port 5189 unless PORT is set.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const extra = {};
if (existsSync('.env.demo.local')) {
  for (const line of readFileSync('.env.demo.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) extra[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = { ...process.env, ...extra, MEZON_STORE: 'local' };
const child = spawn('npx', ['next', 'dev', '-p', process.env.PORT ?? '5189'], { stdio: 'inherit', shell: true, env });
child.on('exit', code => process.exit(code ?? 0));
