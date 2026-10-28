'use client';

import type { QuestionLanguage } from '@/lib/question-language';
import { useQuestionLanguageStore } from '@/store';

/**
 * Checklist text in the language chosen in My profile. Both: the English, then the Filipino on
 * its own line, smaller and grey. Filipino alone falls back to English where there's none.
 */
export function Bilingual({
  en,
  fil,
  as: Tag = 'span',
  id,
  className,
  language: fixed,
}: {
  en: string;
  fil: string;
  as?: 'span' | 'p' | 'h2' | 'h3';
  /** For aria-labelledby, e.g. the answer buttons of a question. */
  id?: string;
  className?: string;
  /** Ignores the device setting, e.g. 'both' on paper. */
  language?: QuestionLanguage;
}) {
  const chosen = useQuestionLanguageStore((s) => s.language);
  const language = fixed ?? chosen;
  const filipino = fil.trim();

  if (language === 'en' || !filipino) {
    return (
      <Tag id={id} className={className}>
        {en}
      </Tag>
    );
  }
  if (language === 'fil') {
    return (
      <Tag id={id} lang="fil" className={className}>
        {filipino}
      </Tag>
    );
  }
  return (
    <Tag id={id} className={className}>
      {en}
      <span lang="fil" className="mt-0.5 block text-[0.9em] font-normal text-gray-500">
        {filipino}
      </span>
    </Tag>
  );
}
