import {
  emptyMatatag,
  matatagCompletionErrors,
  matatagResponseTotals,
  matatagSections,
  matatagTotals,
  matatagUnansweredQuestions,
} from '@/lib/matatag';
import { localizedSections } from '@/lib/matatag-question-content';
import content from '@/lib/matatag-question-content.json';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('bilingual content covers every source ID and preserves question wording and scoring', () => {
  assert.deepEqual(
    Object.keys(content.sections),
    matatagSections.map((section) => section.id)
  );
  assert.deepEqual(
    Object.keys(content.items),
    matatagSections.flatMap((section) => section.items.map((item) => item.id))
  );
  for (const [index, section] of localizedSections.entries()) {
    const source = matatagSections[index];
    assert.equal(section.title, source.title);
    assert.equal(section.translation, source.translation);
    for (const [itemIndex, item] of section.items.entries()) {
      const original = source.items[itemIndex];
      const { text, ...metadata } = item;
      const { text: originalText, ...originalMetadata } = original;
      assert.deepEqual(metadata, originalMetadata);
      assert.ok(text.en.trim() && text.fil.trim(), `${item.id}: both languages required`);
      if (item.number.includes('.')) {
        assert.ok(originalText.includes(text.en), `${item.id}: preserve the source label`);
      } else {
        assert.equal([text.en, text.fil, text.reference].filter(Boolean).join(' '), originalText);
      }
    }
  }
});

test('completion errors identify unanswered question locations', () => {
  const document = emptyMatatag();
  const errors = matatagCompletionErrors(document);
  assert.ok(errors.some((error) => error.includes('checklist questions still need')));
  assert.equal(matatagUnansweredQuestions(document)[0]?.number, '1');
});

test('progress counts answerable questions separately from grouped score results', () => {
  const document = emptyMatatag();
  assert.ok(matatagResponseTotals(document).total > matatagTotals(document).total);
});
