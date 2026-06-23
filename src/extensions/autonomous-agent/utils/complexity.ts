import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';
import type { ComplexityReport } from '../types.js';

export async function analyzeComplexity(cwd: string): Promise<ComplexityReport[]> {
  const results: ComplexityReport[] = [];
  const srcDir = join(cwd, 'src');

  try {
    const files = await getAllTsFiles(srcDir);
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileComplexities = calculateFileComplexity(file, content);
        results.push(...fileComplexities);
      } catch {
        // Skip file if cannot read
      }
    }
  } catch {
    // No src dir or error
  }

  return results;
}

async function getAllTsFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllTsFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && (extname(entry.name) === '.ts' || extname(entry.name) === '.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function calculateFileComplexity(file: string, content: string): ComplexityReport[] {
  const reports: ComplexityReport[] = [];
  const lines = content.split('\n');

  let functionDepth = 0;
  let functionStart = 0;
  let functionName = 'anonymous';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Detect function start
    if (line.match(/^(function|const\s+\w+\s*=\s*(?:async\s+)?\(|class\s+\w+|export\s+(?:default\s+)?(?:function|class|const|async\s+function))/)) {
      if (functionDepth === 0) {
        functionStart = i + 1;
        const match = line.match(/(function\s+(\w+)|const\s+(\w+)\s*=|class\s+(\w+))/);
        functionName = match ? (match[2] || match[3] || match[4]) : 'anonymous';
      }
      functionDepth++;
    }

    if (line === '}' && functionDepth > 0) {
      functionDepth--;
      if (functionDepth === 0) {
        const functionLines = (i + 1) - functionStart + 1;
        const functionContent = content.substring(
          content.indexOf(lines[functionStart - 1]),
          content.indexOf(lines[i]) + lines[i].length
        );
        const complexity = estimateComplexity(functionContent);

        if (complexity > 0) {
          reports.push({
            file,
            function: functionName,
            complexity,
            lines: functionLines,
          });
        }
      }
    }
  }

  return reports;
}

function estimateComplexity(code: string): number {
  let complexity = 1;

  const decisionPatterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bdo\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b\|\|/g,
    /&&/g,
    /\?/g,
    /[=!]===/g,
    /[=!]==/g,
  ];

  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

export function formatComplexityReport(reports: ComplexityReport[]): string {
  if (reports.length === 0) {
    return 'No functions analyzed';
  }

  const highComplexity = reports.filter(r => r.complexity >= 8);
  const output = [
    `Total functions: ${reports.length}`,
    `High complexity (≥8): ${highComplexity.length}`,
    '',
    ...highComplexity.map(r => `  ${r.file}:${r.function} complexity=${r.complexity}, lines=${r.lines}`)
  ];

  return output.join('\n');
}
