export { createServer, main } from './server.js';
export * from './tools/compute-diff-regions.js';
export * from './tools/score-global.js';
export * from './tools/render-overlay.js';
export * from './types.js';

// Auto-start server when this file is run directly
import { main } from './server.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}