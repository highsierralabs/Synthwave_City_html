// Whole-corpus checks for tools/glslmin (plans/T02-glslmin.md, section 6): src/common.glsl as it is
// on disk plus the GPU fixtures. The GPU proof itself is tools/glslmin/browser-test.mjs.
import { describe, it, expect } from 'vitest';
import { minifyShaders } from '../../tools/glslmin/index.mjs';
import { loadCorpus } from '../../tools/glslmin/corpus.mjs';
import { sizeTable } from '../../tools/glslmin/size.mjs';

const { sources } = loadCorpus();

describe('corpus', () => {
  it('gives identical output for the same input', () => {
    expect(JSON.stringify(minifyShaders(sources))).toBe(JSON.stringify(minifyShaders(sources)));
    expect(JSON.stringify(minifyShaders(sources, { rename: false }))).toBe(JSON.stringify(minifyShaders(sources, { rename: false })));
  });

  it('does not depend on the order of the files', () => {
    const reversed = Object.fromEntries(Object.entries(sources).reverse());
    expect(minifyShaders(reversed).names).toEqual(minifyShaders(sources).names);
  });

  it('strip-only output is a fixed point of strip-only', () => {
    const once = minifyShaders(sources, { rename: false }).out;
    expect(minifyShaders(once, { rename: false }).out).toEqual(once);
  });

  it('keeps every path, the reserved names and the FS switch', () => {
    const { out } = minifyShaders(sources);
    expect(Object.keys(out)).toEqual(Object.keys(sources));
    const all = Object.values(out).join('');
    for (const name of ['uniform F{', 'T0', 'void main(', '#ifdef FS\n']) expect(all).toContain(name);
    expect(all).not.toMatch(/\/\/|\/\*/);
  });

  it('gets smaller at each step, raw and deflated', () => {
    const { table } = sizeTable(sources);
    expect(table.strip.bytes).toBeLessThan(table.source.bytes);
    expect(table.renamed.bytes).toBeLessThan(table.strip.bytes);
    expect(table.pruned.bytes).toBeLessThanOrEqual(table.renamed.bytes);
    expect(table.renamed.deflated).toBeLessThan(table.strip.deflated);
    expect(table.pruned.deflated).toBeLessThanOrEqual(table.renamed.deflated);
  });
});
