import { describe, expect, it } from 'vitest';
import { MCP_PLACEHOLDER, encode, decode } from './index.js';

describe('mcp placeholder', () => {
  it('is wired to the shared core format', () => {
    expect(MCP_PLACEHOLDER).toBe(true);
    expect(decode(encode('hi from mcp'))).toBe('hi from mcp');
  });
});
