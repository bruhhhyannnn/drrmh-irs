import { matatagSections } from '@/lib/matatag';
import content from './matatag-question-content.json';

export type QuestionLanguage = 'en' | 'fil' | 'both';
export type QuestionText = { en: string; fil: string; reference: string };

const titles: Record<string, { en: string; fil: string }> = content.sections;
const questions: Record<string, QuestionText> = content.items;

// Keep the IDs and scoring metadata shared with server validation.
export const localizedSections = matatagSections.map((section) => ({
  ...section,
  title: titles[section.id].en,
  translation: titles[section.id].fil,
  items: section.items.map((item) => ({ ...item, text: questions[item.id] })),
}));
