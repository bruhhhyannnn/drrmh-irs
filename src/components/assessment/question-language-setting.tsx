'use client';

import { FieldHelp, SegmentedControl } from '@/components/ds';
import type { QuestionLanguage } from '@/lib/question-language';
import { useQuestionLanguageStore } from '@/store';
import { useId } from 'react';

const OPTIONS: { value: QuestionLanguage; label: string }[] = [
  { value: 'both', label: 'English + Filipino' },
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
];

/** The language of the assessment checklist, saved on this device. Shown in My profile. */
export function QuestionLanguageSetting() {
  const id = useId();
  const language = useQuestionLanguageStore((s) => s.language);
  const setLanguage = useQuestionLanguageStore((s) => s.setLanguage);

  return (
    <section className="flex flex-col gap-3.5">
      <h3
        id={id}
        className="text-[11px] large-text:text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase"
      >
        Checklist language
      </h3>
      <SegmentedControl
        name={`${id}-language`}
        labelledBy={id}
        options={OPTIONS}
        value={language}
        onChange={(value) => setLanguage(value as QuestionLanguage)}
      />
      <FieldHelp>How the building assessment questions are shown on this device.</FieldHelp>
    </section>
  );
}
