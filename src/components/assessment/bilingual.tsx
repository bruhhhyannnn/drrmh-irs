'use client';

import { useQuestionLanguageStore } from '@/store';

/**
 * Checklist text in the language chosen in My profile. Both: the English, then the Filipino on
 * its own line, smaller and grey. Filipino alone falls back to English where there's none.
 */
export function Bilingual({
  en,
  fil,
  as: Tag = 'span',
  className,
}: {
  en: string;
  fil: string;
  as?: 'span' | 'p' | 'h2' | 'h3';
  className?: string;
}) {
  const language = useQuestionLanguageStore((s) => s.language);
  const filipino = fil.trim();

  if (language === 'en' || !filipino) return <Tag className={className}>{en}</Tag>;
  if (language === 'fil') {
    return (
      <Tag lang="fil" className={className}>
        {filipino}
      </Tag>
    );
  }
  return (
    <Tag className={className}>
      {en}
      <span lang="fil" className="mt-0.5 block text-[0.9em] font-normal text-gray-500">
        {filipino}
      </span>
    </Tag>
  );
}
