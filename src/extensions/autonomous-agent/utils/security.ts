import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';
import type { SecurityScanResult } from '../types.js';

export async function scanForSecrets(cwd: string): Promise<SecurityScanResult> {
  const patterns = [
    /['"]?(?:password|passwd|pwd|secret|api[_-]?key|private[_-]?key|token|auth|credential)['"]?\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /(?:sk_live_|sk_test_|Bearer\s+)[a-zA-Z0-9]{20,}/gi,
    /(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36,}/gi,
    /(?:AKIA[0-9A-Z]{16})/gi,
    /(?:xox[baprs]-[0-9]{12}-[0-9]{12}-[0-9A-Za-z]{32})/gi,
  ];

  const results: Array<{ file: string; line: number; match: string }> = [];
  const srcDir = join(cwd, 'src');

  try {
    const files = await getAllFiles(srcDir);
    for (const file of files) {
      if (extname(file) === '.md' || (extname(file) === '.json' && !file.includes('package.json'))) {
        continue;
      }
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
              results.push({
                file: file.replace(cwd + '/', ''),
                line: idx + 1,
                match: match[0],
              });
            }
          }
        });
      } catch {
        // Skip file
      }
    }
  } catch {
    // No src dir
  }

  return {
    secretsFound: results.length > 0,
    vulnerabilities: results.length,
    details: results.length > 0 ? `Found ${results.length} potential secrets` : undefined,
  };
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function checkNpmAudit(api: any): Promise<{ vulnerabilities: number }> {
  try {
    const result = await api.exec('npm', ['audit', '--json'], { cwd: process.cwd() });
    if (result.code === 0) {
      return { vulnerabilities: 0 };
    }
    const audit = JSON.parse(result.stdout);
    const count = Object.keys(audit.vulnerabilities || {}).length;
    return { vulnerabilities: count };
  } catch {
    return { vulnerabilities: 0 };
  }
}

export async function checkOutdated(api: any): Promise<string[]> {
  try {
    const result = await api.exec('npm', ['outdated', '--json'], { cwd: process.cwd() });
    if (result.code === 0 && result.stdout) {
      const outdated = JSON.parse(result.stdout);
      return Object.keys(outdated).map(pkg => `${pkg}: ${outdated[pkg].current} → ${outdated[pkg].latest}`);
    }
  } catch {
    // No outdated packages or error
  }
  return [];
}
