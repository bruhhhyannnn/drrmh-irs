// Which language the checklist questions show in (DRRM-015). The MATATAG form is bilingual;
// some evaluators want both, some only one. Kept per device in localStorage, like the theme.

export type QuestionLanguage = 'both' | 'en' | 'fil';

export const QUESTION_LANGUAGE_KEY = 'irs-question-language';

export function readQuestionLanguage(): QuestionLanguage {
  try {
    const stored = localStorage.getItem(QUESTION_LANGUAGE_KEY);
    if (stored === 'en' || stored === 'fil') return stored;
  } catch {
    // Storage blocked (private mode, sandboxed frame): show both.
  }
  return 'both';
}
