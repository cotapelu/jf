import { readFile } from 'fs/promises';
const cov = JSON.parse(await readFile(new URL('../coverage/coverage-final.json', import.meta.url)));
const filePath = Object.keys(cov).find(k => k.endsWith('team-manager.ts'));
if (!filePath) throw new Error('team-manager.ts not found');
const data = cov[filePath];
let covered = 0, total = 0;
for (const val of Object.values(data.b)) {
  if (Array.isArray(val) && val.length >= 2) {
    covered += val[0];
    total += val[1];
  }
}
console.log(`team-manager.ts branch coverage: ${covered}/${total} = ${(covered/total*100).toFixed(2)}%`);
