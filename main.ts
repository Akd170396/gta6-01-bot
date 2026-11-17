// Solmara Nights — the entry program for make.fun's gta6-01 bounty.
// It copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
const gameSrc = join(repoRoot, 'game');
if (!existsSync(join(gameSrc, 'index.html'))) {
  throw new Error(`Solmara Nights: no game/index.html found under ${repoRoot}`);
}
for (const name of ['game', 'screenshots']) {
  const src = join(repoRoot, name);
  const dest = join(outDir, name);
  if (!existsSync(src)) continue;
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));
console.log(`Solmara Nights: wrote ${outDir} (game/, screenshots/, dossier.json)`);
