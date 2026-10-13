// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from './draft';

const draft = {
  version: 1 as const,
  eventId: 'event-drill',
  location: { lat: 14.5779, lng: 120.9846, name: 'Taft' },
  counts: { students: 12 },
  damageId: '',
  missingPersons: [{ name: 'Maria Santos', age: 34, sex: 'female' as const }],
  casualties: [],
  savedAt: 1_760_000_000_000,
};

describe('report draft', () => {
  it('saves and loads one draft per member', () => {
    saveDraft('user-1', draft);

    expect(loadDraft('user-1')).toEqual(draft);
    expect(loadDraft('user-2')).toBeNull();
  });

  it('is gone once cleared', () => {
    saveDraft('user-1', draft);
    clearDraft('user-1');

    expect(loadDraft('user-1')).toBeNull();
  });

  it('ignores a draft from another version or a damaged one', () => {
    localStorage.setItem('irs:ert-report-draft:user-1', JSON.stringify({ ...draft, version: 2 }));
    expect(loadDraft('user-1')).toBeNull();

    localStorage.setItem('irs:ert-report-draft:user-1', '{not json');
    expect(loadDraft('user-1')).toBeNull();
  });

  it('works without drafts when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => saveDraft('user-1', draft)).not.toThrow();
    expect(loadDraft('user-1')).toBeNull();
  });
});
