import { describe, it, expect } from 'vitest';
import { createServer } from './server.js';

describe('MCP Server', () => {
  it('should create server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server).toBe('object');
  });

  it('should export main function', async () => {
    const module = await import('./server.js');
    expect(typeof module.main).toBe('function');
  });
});