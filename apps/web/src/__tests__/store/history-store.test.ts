import { describe, expect, it } from 'vitest';

import {
  deserializeHistory,
  serializeHistory,
  type HistoryEntry,
} from '../../store/history-store';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'history-1',
    type: 'edit',
    timestamp: new Date('2026-07-15T12:00:00.000Z'),
    description: 'Saved edits',
    before: 'blob:before',
    after: 'blob:after',
    canUndo: true,
    documentIds: ['document-1'],
    fileNames: ['example.pdf'],
    ...overrides,
  };
}

describe('history persistence', () => {
  it('keeps undo enabled when both immutable document versions are recorded', () => {
    const serialized = serializeHistory([
      makeEntry({
        metadata: {
          beforeVersionId: 'version-1',
          afterVersionId: 'version-2',
        },
      }),
    ]);

    expect(serialized[0]).toMatchObject({ canUndo: true });
    expect(serialized[0]).not.toHaveProperty('before');
    expect(serialized[0]).not.toHaveProperty('after');

    expect(deserializeHistory(serialized)[0]).toMatchObject({
      canUndo: true,
      before: null,
      after: null,
    });
  });

  it('does not advertise reload-safe undo for transient blob URLs', () => {
    const serialized = serializeHistory([makeEntry()]);

    expect(serialized[0]).toMatchObject({ canUndo: false });
    expect(deserializeHistory(serialized)[0]).toMatchObject({ canUndo: false });
  });
});
