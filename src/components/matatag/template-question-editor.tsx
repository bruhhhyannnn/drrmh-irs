'use client';

import { Button } from '@/components/ui/button';
import { Checkbox, Textarea } from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { defaultMatatagOptions, type MatatagQuestion } from '@/lib/matatag-template';
import { createUuid } from '@/lib/uuid';
import { CornerDownRight, Plus, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

const panel =
  'rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm md:p-6 dark:border-gray-800 dark:bg-gray-900';

function AutoResizeTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [props.value]);

  return <Textarea {...props} ref={ref} rows={props.rows ?? 2} />;
}

function newQuestion(number: string): MatatagQuestion {
  return {
    id: createUuid(),
    number,
    text: { en: '', fil: '', reference: '' },
    group: false,
    starred: false,
    options: defaultMatatagOptions.map((option) => ({ ...option })),
  };
}

function isSubQuestion(question: MatatagQuestion) {
  return question.number.includes('.');
}

export function TemplateQuestionEditor({
  items,
  onChange,
}: {
  items: MatatagQuestion[];
  onChange: (items: MatatagQuestion[]) => void;
}) {
  function editQuestion(id: string, patch: Partial<MatatagQuestion>) {
    onChange(items.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  function addChildQuestion(group: MatatagQuestion) {
    const prefix = `${group.number || '1'}.`;
    const children = items.filter((item) => item.number.startsWith(prefix));
    const usedNumbers = new Set(children.map((item) => item.number));
    let childNumber = 1;
    while (usedNumbers.has(`${prefix}${childNumber}`)) childNumber++;

    const groupIndex = items.findIndex((item) => item.id === group.id);
    const lastChildIndex = items.reduce(
      (lastIndex, item, index) => (item.number.startsWith(prefix) ? index : lastIndex),
      groupIndex
    );
    const next = [...items];
    next.splice(lastChildIndex + 1, 0, newQuestion(`${prefix}${childNumber}`));
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className={`${panel} space-y-3`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">Step 2 of 2</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
              Shape the questions
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Edit inline. Responses stay fixed: Yes / Oo, No / Hindi, and N/A.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {items.length} {items.length === 1 ? 'question' : 'questions'}
          </span>
        </div>
        <Table
          className="min-w-[1024px] table-fixed"
          containerClassName="shadow-none border-gray-200 dark:border-gray-700"
        >
          <colgroup>
            <col className="w-16" />
            <col />
            <col />
            <col className="w-[88px]" />
            <col className="w-24" />
            <col className="w-32" />
            <col className="w-20" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2">No.</TableHead>
              <TableHead>Question (English)</TableHead>
              <TableHead>Question (Filipino)</TableHead>
              <TableHead className="px-2 text-center">Group</TableHead>
              <TableHead className="px-2 text-center">Negative</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="px-2 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    No questions in this section yet.
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Add the first question below to start building this section.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              items.map((question) => (
                <TableRow
                  key={question.id}
                  className={
                    question.group
                      ? 'bg-brand-50/50'
                      : isSubQuestion(question)
                        ? 'bg-[#e8f1e9]/60 dark:bg-[#20372a]/30'
                        : undefined
                  }
                >
                  <TableCell className="px-2 align-top">
                    <span
                      className={`flex h-10 items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-200 ${isSubQuestion(question) ? 'pl-4 text-[#255f3c] dark:text-[#79c493]' : ''}`}
                    >
                      {isSubQuestion(question) && <CornerDownRight size={15} aria-hidden="true" />}
                      {question.number}
                    </span>
                  </TableCell>
                  <TableCell className={`align-top ${isSubQuestion(question) ? 'pl-10' : ''}`}>
                    <AutoResizeTextarea
                      aria-label={`English text for question ${question.number}`}
                      rows={2}
                      maxLength={4000}
                      required
                      value={question.text.en}
                      onChange={(event) =>
                        editQuestion(question.id, {
                          text: { ...question.text, en: event.target.value },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <AutoResizeTextarea
                      aria-label={`Filipino text for question ${question.number}`}
                      rows={2}
                      maxLength={4000}
                      value={question.text.fil}
                      onChange={(event) =>
                        editQuestion(question.id, {
                          text: { ...question.text, fil: event.target.value },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="px-2 align-top">
                    <div className="flex h-10 items-center justify-center">
                      <Checkbox
                        aria-label={`Group heading for question ${question.number}`}
                        checked={question.group}
                        onChange={(event) =>
                          editQuestion(question.id, {
                            group: event.target.checked,
                            options: question.options.length
                              ? question.options
                              : defaultMatatagOptions.map((option) => ({ ...option })),
                          })
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-2 align-top">
                    <div className="flex h-10 items-center justify-center">
                      <Checkbox
                        aria-label={`Negative question for ${question.number}`}
                        checked={question.starred}
                        disabled={question.group}
                        onChange={(event) =>
                          editQuestion(question.id, { starred: event.target.checked })
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 align-top">
                    <AutoResizeTextarea
                      aria-label={`Reference for question ${question.number}`}
                      placeholder="Optional guidance"
                      rows={2}
                      maxLength={4000}
                      value={question.text.reference}
                      onChange={(event) =>
                        editQuestion(question.id, {
                          text: { ...question.text, reference: event.target.value },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="px-2 align-top">
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-10 p-0 text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-500 dark:hover:bg-error-950/40"
                        aria-label={`Delete question ${question.number}`}
                        title="Delete question"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete question ${question.number} from this checklist?`
                            )
                          )
                            onChange(items.filter((item) => item.id !== question.id));
                        }}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </Button>
                      {question.group && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="size-10 p-0"
                          aria-label={`Add a child question to ${question.number}`}
                          title="Add child question"
                          onClick={() => addChildQuestion(question)}
                        >
                          <Plus size={17} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            startIcon={<Plus size={18} aria-hidden="true" />}
            onClick={() => onChange([...items, newQuestion(String(items.length + 1))])}
          >
            Add question
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tip: mark a row as a group to unlock child questions.
          </p>
        </div>
      </div>
    </div>
  );
}
