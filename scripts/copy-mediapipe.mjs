/* Copies the pose tracker's wasm from the pinned @mediapipe/tasks-vision package into public/mediapipe/wasm, so the
   files the live mirror loads always match the installed version. Runs after npm install. */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const from = path.join('node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = path.join('public', 'mediapipe', 'wasm');
if (!existsSync(from)) process.exit(0);
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) copyFileSync(path.join(from, f), path.join(to, f));
console.log(`mediapipe: copied ${readdirSync(from).length} files to ${to}`);
