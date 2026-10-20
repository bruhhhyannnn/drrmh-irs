'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner, Button, Drawer, FieldLabel, FOCUS_RING, Switch } from '@/components/ds';
import { cn } from '@/lib';
import { clampFloors, parseFloors, sectionProgress, setAsideCount } from '@/lib/assessment-draft';
import { applicableItems, areaQuestionCounts } from '@/lib/assessment-score';
import { useId, useRef, useState } from 'react';
import { Card, Mono } from '../../_components/chrome';
import { formatDate } from '../../_lib/format';
import type { StepProps } from './details-step';

type Profile = { floor_count: number; area_type_ids: string[] };
type PendingChange = Profile & { message: string };

/**
 * About the building: floors and which kinds of area it has. These decide which questions
 * apply. A change that would hide answers asks first; hidden answers are kept in the draft.
 */
export function BuildingStep({
  template,
  draft,
  update,
  onGrown,
}: StepProps & {
  /** Sections that gained questions because an area was ticked, for the index's "New questions". */
  onGrown: (sectionIds: string[]) => void;
}) {
  const id = useId();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const floors = draft.floor_count;
  const ticked = new Set(draft.area_type_ids);
  const counts = areaQuestionCounts(template, floors);
  const total = applicableItems(template, floors, draft.area_type_ids).filter(
    (i) => i.is_scored
  ).length;
  const stairwells = template.area_types.find((a) => a.code === 'stairwells');

  const apply = (next: Profile) => {
    const before = sectionProgress(template, draft);
    const after = sectionProgress(template, { ...draft, ...next });
    const grown = Object.keys(after).filter((s) => after[s].total > (before[s]?.total ?? 0));
    if (next.area_type_ids.length > draft.area_type_ids.length && grown.length) onGrown(grown);
    update((d) => ({ ...d, ...next }));
  };

  /** Applies the change, or asks first when it would set answers aside. */
  const propose = (next: Profile, message: (n: number) => string) => {
    const n = setAsideCount(template, draft, next);
    if (n > 0) setPending({ ...next, message: message(n) });
    else apply(next);
  };

  const setFloors = (value: number) => {
    const floor_count = clampFloors(value);
    if (floor_count === floors) return;
    let area_type_ids = draft.area_type_ids;
    // Two or more floors means stairs: tick Stairwells once, never untick it.
    if (floors < 2 && floor_count >= 2 && stairwells && !ticked.has(stairwells.id)) {
      area_type_ids = [...area_type_ids, stairwells.id];
    }
    propose(
      { floor_count, area_type_ids },
      (n) =>
        `${n} sprinkler ${n === 1 ? 'answer' : 'answers'} will be set aside. They come back if you set 3 or more floors again.`
    );
  };

  const toggleArea = (areaId: string, on: boolean, name: string) => {
    const area_type_ids = on
      ? [...draft.area_type_ids, areaId]
      : draft.area_type_ids.filter((a) => a !== areaId);
    propose(
      { floor_count: floors, area_type_ids },
      (n) =>
        `${n} ${n === 1 ? 'answer' : 'answers'} for ${name} will be set aside. They come back if you tick it again.`
    );
  };

  return (
    <Card className="flex flex-col gap-6 p-5 md:p-6">
      <h2 className="text-[19px] leading-[1.3] font-bold">About the building</h2>

      {draft.prefilled_from && (
        <Banner tone="warning">
          From the last assessment on {formatDate(draft.prefilled_from)} — check it&apos;s still
          right
        </Banner>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FieldLabel htmlFor={`${id}-floors`}>How many floors?</FieldLabel>
        <FloorsInput id={`${id}-floors`} value={floors} onCommit={setFloors} />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-[14px] large-text:text-[16px] font-semibold text-gray-700">
          Which of these does the building have?
        </legend>
        {template.area_types.map((area) => {
          const labelId = `${id}-${area.code}`;
          const n = counts[area.id] ?? 0;
          return (
            <div
              key={area.id}
              className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-surface px-4 py-3.5"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Bilingual
                  en={area.name_en}
                  fil={area.name_fil}
                  className="text-[15px] large-text:text-[17px] font-semibold"
                />
                <span
                  id={`${labelId}-desc`}
                  className="text-[13px] large-text:text-[14px] text-gray-500"
                >
                  <Mono>{n}</Mono> {n === 1 ? 'question' : 'questions'}
                </span>
              </div>
              <Switch
                size="md"
                checked={ticked.has(area.id)}
                onChange={(on) => toggleArea(area.id, on, area.name_en)}
                label={area.name_en}
                describedBy={`${labelId}-desc`}
              />
            </div>
          );
        })}
      </fieldset>

      <p className="text-[16px] font-semibold" aria-live="polite">
        <Mono>{total}</Mono> {total === 1 ? 'question' : 'questions'}
      </p>

      <Drawer
        open={!!pending}
        onClose={() => setPending(null)}
        title="Set answers aside?"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPending(null)}>
              Keep
            </Button>
            <Button
              onClick={() => {
                if (pending) {
                  apply({ floor_count: pending.floor_count, area_type_ids: pending.area_type_ids });
                }
                setPending(null);
              }}
            >
              Set aside
            </Button>
          </div>
        }
      >
        <p className="text-[16px] leading-[1.5]">{pending?.message}</p>
      </Drawer>
    </Card>
  );
}

const STEP_BUTTON = cn(
  'size-12 text-[20px] large-text:text-[22px] leading-none font-semibold max-[359px]:size-11 disabled:text-gray-300 disabled:hover:bg-transparent',
  FOCUS_RING,
  'focus-visible:-outline-offset-3'
);

/**
 * − floors +, looking like the ds Stepper. Typing isn't committed until the box is left or
 * Enter is pressed, so clearing it to type "2" doesn't pass through 1 (or end up as 12); a
 * blank box goes back to the current value.
 */
function FloorsInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    const parsed = text === null || cancelled.current ? null : parseFloors(text);
    cancelled.current = false;
    setText(null);
    if (parsed !== null && parsed !== value) onCommit(parsed);
  };

  return (
    <div className="flex h-12.5 shrink-0 items-center overflow-hidden rounded-full border border-gray-300 bg-surface">
      <button
        type="button"
        aria-label="Floors: minus one"
        disabled={value <= 1}
        onClick={() => onCommit(value - 1)}
        className={cn(STEP_BUTTON, 'text-gray-600 hover:bg-gray-100')}
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label="Floors"
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={cn(
          'font-landing-mono h-full w-14 bg-transparent text-center text-[15px] large-text:text-[17px] font-semibold text-gray-900 max-[359px]:w-10',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      />
      <button
        type="button"
        aria-label="Floors: plus one"
        disabled={value >= 200}
        onClick={() => onCommit(value + 1)}
        className={cn(STEP_BUTTON, 'text-brand-500 hover:bg-brand-25')}
      >
        +
      </button>
    </div>
  );
}
