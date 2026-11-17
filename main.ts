// Solmara Nights — entry program for make.fun gta6-01.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts (the kit's library, unchanged).
// Runs twice in the grader and must write the same bytes both times:
// the copy is a faithful byte copy in sorted order, and the dossier is
// a pure function of the copied files, so both runs agree.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The gate's caps for this competition (see kit RULES.txt / gate.json).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) {
    throw new Error(`main.ts: missing directory ${src}`);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: false });
}

function main(): void {
  // Start from a clean output directory so stale files never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
  console.log('game: Solmara Nights — open-world crime game, 6 story missions');
}

main();
