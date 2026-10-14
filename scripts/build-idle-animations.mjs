// Local idle stories use Mascot Studio's pinned actor and SVG compiler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-idle-animations.mjs <mascot-studio checkout>');
const catalog = createRequire(import.meta.url)('../animation-catalog.js');
const read = file => execFileSync('git', ['show', `${catalog.tag}:${file}`], { cwd: source, maxBuffer: 32 * 1024 * 1024 });
const commit = execFileSync('git', ['rev-parse', `${catalog.tag}^{}`], { cwd: source }).toString().trim();
if (commit !== catalog.commit) throw new Error('Idle actor source must match the pinned catalog');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-idle-art-'));
try {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', catalog.tag, 'scripts'], { cwd: source }).toString().trim().split(/\r?\n/);
  for (const file of files.filter(file => /^scripts\/mascot-.*\.mjs$/.test(file))) fs.writeFileSync(path.join(temp, path.basename(file)), read(file));
  const { drawMascot, compileAnimation, svgDocument } = await import(pathToFileURL(path.join(temp, 'mascot-pixel-art.mjs')).href);
  const { createStoryKit } = await import(pathToFileURL(path.join(temp, 'mascot-story-kit.mjs')).href);
  const reference = JSON.parse(read('src/components/claude-mascot/reference-artwork.json'));
  const { story } = createStoryKit(options => drawMascot(reference, options));
  const variants = [
    story('idle-look-around', 'Quietly looks left and right, blinks, and returns to the resting pose.', beat => {
      beat(1600, 'Rest');
      beat(180, 'Notice left', { gazeX: -5 });
      beat(900, 'Look left', { gazeX: -10 });
      beat(180, 'Center');
      beat(120, 'Blink', { eyes: 'closed' });
      beat(500, 'Rest');
      beat(180, 'Notice right', { gazeX: 5 });
      beat(900, 'Look right', { gazeX: 10 });
      beat(180, 'Center');
      beat(1600, 'Rest');
    }, { reducedStage: 'Rest' }),
    story('idle-breathe', 'Takes a slow breath with planted feet, relaxes the shoulders, and settles.', beat => {
      beat(1800, 'Rest');
      beat(300, 'Breathe in', { dy: -5 });
      beat(1400, 'Hold breath', { dy: -5, eyes: 'closed' });
      beat(300, 'Breathe out', { eyes: 'closed' });
      beat(900, 'Relax', { eyes: 'happy' });
      beat(200, 'Blink', { eyes: 'closed' });
      beat(1800, 'Rest');
    }, { reducedStage: 'Rest' }),
  ].map(animation => ({ ...animation, title: animation.name === 'idle-breathe' ? 'Idle / breathe' : 'Idle / look around', label: animation.description }));
  for (const animation of variants) {
    const bytes = Buffer.from(svgDocument(compileAnimation(animation)));
    fs.writeFileSync(path.join(root, 'assets', `${animation.name}.svg`), bytes);
    catalog.states[animation.name] = {
      sourceState: animation.name, file: `${animation.name}.svg`, duration: animation.duration, loop: true,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'), localSource: 'scripts/build-idle-animations.mjs',
    };
  }
  catalog.idleVariants = ['idle', ...variants.map(animation => animation.name)];
  fs.writeFileSync(path.join(root, 'animation-catalog.js'), `// Generated from Mascot Studio ${catalog.tag}, with the earlier walk and local idle variants.\n;(function () {\n  const catalog = ${JSON.stringify(catalog, null, 2)}\n  if (typeof module !== 'undefined' && module.exports) module.exports = catalog\n  else window.PET_ANIMATIONS = catalog\n})()\n`);
  console.log(`Built ${variants.length} idle variants; the pet now has ${catalog.idleVariants.length} idle choices.`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
