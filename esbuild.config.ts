import { build } from 'esbuild';
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Entry points
const entryPoints = ['src/main.ts'];

// Output directory
const outdir = 'dist';

// External packages (don't bundle)
const external = [
  '@earendil-works/pi-coding-agent',
  '@earendil-works/pi-ai',
  '@earendil-works/pi-tui'
];

// Build options
const options = {
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node22',
  outdir,
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
};

// Ensure dist exists (created by prebuild)

// Build
build(options).then(() => {
  console.log('✅ Build complete');

  // Copy skills-md folder
  const skillsSrc = join(__dirname, 'src', 'tools', 'skills', 'skills-md');
  const skillsDst = join(__dirname, outdir, 'tools', 'skills', 'skills-md');
  if (existsSync(skillsSrc)) {
    copyDir(skillsSrc, skillsDst);
  }

  // Rename main.js → cli.js for backwards compatibility
  const mainPath = join(__dirname, outdir, 'main.js');
  const cliPath = join(__dirname, outdir, 'cli.js');
  if (existsSync(mainPath)) {
    // In Node.js we can rename, but simpler: just create symlink or copy
    // For now, we'll just note that the entry is main.js
    console.log('📦 Entry file: dist/main.js (update package.json bin if needed)');
  }

  console.log('📁 Skills copied');
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});

function copyDir(src: string, dst: string) {
  if (!existsSync(dst)) {
    mkdirSync(dst, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      copyFileSync(srcPath, dstPath);
    }
  }
}
