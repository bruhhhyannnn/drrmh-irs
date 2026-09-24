'use client';

import { TemplateQuestionEditor } from '@/components/matatag/template-question-editor';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { matatagTemplateSchema, type MatatagTemplate } from '@/lib/matatag-template';
import { createUuid } from '@/lib/uuid';
import { Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const panel =
  'rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm md:p-6 dark:border-gray-800 dark:bg-gray-900';

export function MatatagTemplateEditor({
  initial,
  onPublish,
  previewHref = '/matatag',
}: {
  initial: { revision: number; definition: MatatagTemplate };
  onPublish: (input: {
    revision: number;
    definition: MatatagTemplate;
  }) => Promise<{ revision: number; definition: MatatagTemplate }>;
  previewHref?: string;
}) {
  const [definition, setDefinition] = useState(initial.definition);
  const [revision, setRevision] = useState(initial.revision);
  const [selected, setSelected] = useState(initial.definition.sections[0].id);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [saving, setSaving] = useState(false);
  const section = definition.sections.find((item) => item.id === selected)!;
  const questionCount = definition.sections.reduce((total, item) => total + item.items.length, 0);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(next: MatatagTemplate) {
    setDefinition(next);
    setDirty(true);
    setMessage('');
    setError('');
  }

  function editSection(patch: Partial<typeof section>) {
    change({
      sections: definition.sections.map((item) =>
        item.id === selected ? { ...item, ...patch } : item
      ),
    });
  }

  async function save() {
    const parsed = matatagTemplateSchema.safeParse(definition);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const sectionIndex = typeof issue.path[1] === 'number' ? issue.path[1] : -1;
      const invalidSection = definition.sections[sectionIndex];
      if (invalidSection) setSelected(invalidSection.id);
      const questionIndex = typeof issue.path[3] === 'number' ? issue.path[3] : -1;
      const question = invalidSection?.items[questionIndex];
      setError(
        `${invalidSection?.title || 'Checklist'}${question ? ` · Question ${question.number}` : ''}: ${issue.message}`
      );
      return;
    }
    if (
      !window.confirm(
        'Publish this checklist for new assessments? Existing assessments will keep their original questions.'
      )
    )
      return;
    setError('');
    setSaving(true);
    try {
      const result = await onPublish({ revision, definition: parsed.data });
      setDefinition(result.definition);
      setRevision(result.revision);
      setDirty(false);
      setMessage(
        'Checklist published. New assessments will use these sections, questions, and options.'
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to publish. Your edits are still here.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-5 text-gray-900 dark:text-white"
    >
      <div
        className={`${panel} sticky top-24 z-10 flex flex-wrap items-center justify-between gap-4 border-brand-200 bg-brand-25/95 backdrop-blur dark:border-brand-900 dark:bg-brand-950/95`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
              aria-hidden="true"
            >
              <Save size={16} />
            </span>
            <h2 className="font-semibold text-gray-950 dark:text-white">Assessment checklist</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {definition.sections.length} sections · Revision {revision}
            {dirty ? ' · Unpublished changes' : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Only new assessments use a published revision.
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {questionCount} questions in this template
        </p>
        <Button
          type="submit"
          disabled={!dirty}
          isLoading={saving}
          loadingText="Publishing…"
          startIcon={<Save size={18} aria-hidden="true" />}
        >
          {dirty ? 'Publish changes' : 'No changes to publish'}
        </Button>
      </div>
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200"
        >
          {message}
        </p>
      )}
      <fieldset disabled={saving} className="min-w-0 space-y-5">
        <div className={`${panel} space-y-5`}>
          <div>
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Step 1 of 2</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
              Choose a section
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Move through the checklist in order, or jump to any section.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              id="selected-section"
              label="Section to edit"
              options={definition.sections.map((item, index) => ({
                value: item.id,
                label: `${index + 1}. ${item.title || 'Untitled section'}`,
              }))}
              value={selected}
              onChange={setSelected}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              startIcon={<Plus size={18} aria-hidden="true" />}
              onClick={() => {
                const id = createUuid();
                change({
                  sections: [...definition.sections, { id, title: '', translation: '', items: [] }],
                });
                setSelected(id);
              }}
            >
              Add section
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {definition.sections.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelected(item.id)}
                aria-pressed={selected === item.id}
                className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected === item.id ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-100' : 'border-gray-200 bg-gray-50/70 text-gray-700 hover:border-brand-200 hover:bg-brand-25 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-brand-800'}`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {item.title || 'Untitled section'}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {item.items.length} questions
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              id="section-title"
              label="Section title (English)"
              value={section.title}
              maxLength={4000}
              required
              onChange={(event) => editSection({ title: event.target.value })}
            />
            <Input
              id="section-translation"
              label="Section title (Filipino, optional)"
              value={section.translation}
              maxLength={4000}
              onChange={(event) => editSection({ translation: event.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="danger"
            disabled={definition.sections.length === 1}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete “${section.title || 'Untitled section'}” and its ${section.items.length} questions from the next checklist?`
                )
              )
                return;
              const sections = definition.sections.filter((item) => item.id !== selected);
              change({ sections });
              setSelected(sections[0].id);
            }}
          >
            Delete section
          </Button>
        </div>
        <TemplateQuestionEditor
          items={section.items}
          onChange={(items) => editSection({ items })}
        />
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Open published assessment (new tab)
        </Link>
        <Button type="submit" disabled={!dirty} isLoading={saving} loadingText="Publishing…">
          Publish changes
        </Button>
      </div>
    </form>
  );
}
