#!/usr/bin/env node
import { main } from './main.js';
console.error('cli starting...');
main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
