import { parentPort, workerData, isMainThread } from 'worker_threads';
import { createRequire } from 'module';

if (!isMainThread) {
  try {
    const require = createRequire(import.meta.url);
    // Handle empty content quickly without parser
    if (!workerData.content || workerData.content.trim().length === 0) {
      parentPort?.postMessage({ ast: { type: "Program", body: [], sourceType: "module", errors: [] } });
    } else {
      const parser = require('@typescript-eslint/parser');
      const { parse } = parser;
      const ast = parse(workerData.content, {
        sourceType: "module",
        ecmaVersion: "latest",
        ts: true,
        jsx: true,
        range: false,
        loc: true
      });
      parentPort?.postMessage({ ast });
    }
  } catch (e) {
    parentPort?.postMessage({ error: e.message });
  }
}
