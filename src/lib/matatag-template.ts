import { z } from 'zod';
import checklist from './matatag-checklist.json';
import content from './matatag-question-content.json';

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_.-]+$/);
const label = z.string().trim().min(1, 'Enter a label.').max(4000);
export const matatagOptionSchema = z.object({
  value: id,
  en: label,
  fil: z.string().trim().max(4000),
  kind: z.enum(['YES', 'NO', 'NA']),
});
export const matatagTemplateSchema = z
  .object({
    sections: z
      .array(
        z.object({
          id,
          title: label,
          translation: z.string().trim().max(4000),
          items: z
            .array(
              z.object({
                id,
                number: z.string().trim().min(1).max(20),
                starred: z.boolean(),
                group: z.boolean(),
                text: z.object({
                  en: label,
                  fil: z.string().trim().max(4000),
                  reference: z.string().max(4000),
                }),
                options: z.array(matatagOptionSchema).max(10),
              })
            )
            .min(1, 'Each section needs at least one question.')
            .max(300),
        })
      )
      .min(1, 'Add at least one section.')
      .max(100),
  })
  .superRefine(({ sections }, ctx) => {
    const ids = new Set<string>();
    sections.forEach((section, s) => {
      for (const entry of [section, ...section.items]) {
        if (ids.has(entry.id))
          ctx.addIssue({
            code: 'custom',
            path: ['sections', s],
            message: 'Section and question IDs must be unique.',
          });
        ids.add(entry.id);
      }
      if (!section.items.some((item) => !item.group))
        ctx.addIssue({
          code: 'custom',
          path: ['sections', s, 'items'],
          message: 'Each section needs a response question.',
        });
      section.items.forEach((item, q) => {
        if (!item.group && item.options.length < 2)
          ctx.addIssue({
            code: 'custom',
            path: ['sections', s, 'items', q, 'options'],
            message: 'Each question needs at least two options.',
          });
        if (new Set(item.options.map((option) => option.value)).size !== item.options.length)
          ctx.addIssue({
            code: 'custom',
            path: ['sections', s, 'items', q, 'options'],
            message: 'Option values must be unique.',
          });
      });
    });
  });

export type MatatagTemplate = z.infer<typeof matatagTemplateSchema>;
export type MatatagQuestion = MatatagTemplate['sections'][number]['items'][number];
export const defaultMatatagOptions: MatatagQuestion['options'] = [
  { value: 'YES', en: 'Yes', fil: 'Oo', kind: 'YES' },
  { value: 'NO', en: 'No', fil: 'Hindi', kind: 'NO' },
  { value: 'NA', en: 'N/A', fil: 'N/A', kind: 'NA' },
];
const questions: Record<string, MatatagQuestion['text']> = content.items;
export const defaultMatatagTemplate: MatatagTemplate = {
  sections: checklist.map((section) => ({
    id: section.id,
    title: section.title,
    translation: section.translation,
    items: section.items.map((item) => ({
      id: item.id,
      number: item.number,
      starred: item.starred,
      group: item.group,
      text: questions[item.id],
      options: item.group ? [] : defaultMatatagOptions,
    })),
  })),
};
