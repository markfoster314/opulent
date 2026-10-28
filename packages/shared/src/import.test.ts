import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_CHARS, collectionImportSchema } from './import';

describe('collectionImportSchema', () => {
  it('accepts a CSV at the cap and rejects one character past it', () => {
    const atCap = 'a'.repeat(IMPORT_MAX_CHARS);
    expect(collectionImportSchema.safeParse({ csv: atCap }).success).toBe(true);
    expect(collectionImportSchema.safeParse({ csv: `${atCap}a` }).success).toBe(false);
    expect(collectionImportSchema.safeParse({ csv: '' }).success).toBe(false);
  });
});
