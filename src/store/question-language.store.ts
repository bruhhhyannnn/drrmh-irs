import {
  QUESTION_LANGUAGE_KEY,
  readQuestionLanguage,
  type QuestionLanguage,
} from '@/lib/question-language';
import { create } from 'zustand';

interface QuestionLanguageState {
  /** English + Filipino, English or Filipino. Saved on this device only. */
  language: QuestionLanguage;
  setLanguage: (language: QuestionLanguage) => void;
}

export const useQuestionLanguageStore = create<QuestionLanguageState>((set) => ({
  language: typeof window === 'undefined' ? 'both' : readQuestionLanguage(),
  setLanguage: (language) => {
    try {
      if (language === 'both') localStorage.removeItem(QUESTION_LANGUAGE_KEY);
      else localStorage.setItem(QUESTION_LANGUAGE_KEY, language);
    } catch {
      // Storage blocked: the choice still applies until the page reloads.
    }
    set({ language });
  },
}));
