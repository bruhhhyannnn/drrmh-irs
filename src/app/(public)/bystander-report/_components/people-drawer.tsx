'use client';

import { FOCUS_RING } from '@/app/(public)/_components/primitives';
import { cn, type BystanderCasualty, type BystanderMissingPerson } from '@/lib';
import { User, X } from 'lucide-react';
import { useState } from 'react';
import { personMeta, UNKNOWN_PERSON } from '../_lib/summary';
import { Drawer } from './drawer';
import { Button, FieldError, FieldLabel, OptionTile, SegmentedControl, TextInput } from './fields';

type Person = BystanderMissingPerson | BystanderCasualty;

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

const COPY = {
  missing: {
    title: 'Missing persons',
    subtitle: 'People who cannot be found since the incident.',
    first: 'Add a person',
    another: 'Add another person',
  },
  casualty: {
    title: 'Casualties',
    subtitle: 'People hurt or killed in the incident.',
    first: 'Add a casualty',
    another: 'Add another casualty',
  },
};

interface Draft {
  name: string;
  age: string;
  sex: BystanderMissingPerson['sex'];
  condition_id: string;
  diagnosis: string;
}

const EMPTY_DRAFT: Draft = { name: '', age: '', sex: 'unknown', condition_id: '', diagnosis: '' };

type PeopleDrawerProps = {
  open: boolean;
  onClose: () => void;
  conditions: { id: string; name: string }[];
} & (
  | {
      kind: 'missing';
      people: BystanderMissingPerson[];
      onSave: (people: BystanderMissingPerson[]) => void;
    }
  | { kind: 'casualty'; people: BystanderCasualty[]; onSave: (people: BystanderCasualty[]) => void }
);

/**
 * Lists the people added so far and takes one more. Asks only what a bystander can know: a
 * name if known, an age or an estimate, sex in one tap — plus condition and what they can see
 * for casualties. Cancel discards this visit's changes; Done keeps them, including a filled
 * draft that wasn't added to the list yet. Mount with a fresh `key` per open.
 */
export function PeopleDrawer(props: PeopleDrawerProps) {
  const { kind, open, onClose, conditions } = props;
  const isCasualty = kind === 'casualty';
  const copy = COPY[kind];
  const [people, setPeople] = useState<Person[]>(props.people);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<{ age?: string; condition?: string }>({});

  const conditionName = (id: string) => conditions.find((c) => c.id === id)?.name ?? '';
  const isDraftFilled =
    !!draft.name.trim() ||
    !!draft.age.trim() ||
    (isCasualty && (!!draft.condition_id || !!draft.diagnosis.trim()));

  /** Validates the draft; returns the person to add, or null after showing the errors. */
  const draftToPerson = (): Person | null => {
    const age = draft.age.trim() === '' ? null : Number(draft.age);
    const nextErrors = {
      age:
        age !== null && (!Number.isInteger(age) || age < 0 || age > 130)
          ? 'Enter an age from 0 to 130.'
          : undefined,
      condition: isCasualty && !draft.condition_id ? 'Pick a condition.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.age || nextErrors.condition) return null;

    const person = { name: draft.name.trim(), age, sex: draft.sex };
    return isCasualty
      ? { ...person, condition_id: draft.condition_id, diagnosis: draft.diagnosis.trim() || null }
      : person;
  };

  const addDraft = () => {
    const person = draftToPerson();
    if (!person) return;
    setPeople((list) => [...list, person]);
    setDraft(EMPTY_DRAFT);
  };

  const done = () => {
    let list = people;
    if (isDraftFilled) {
      const person = draftToPerson();
      if (!person) return;
      list = [...people, person];
    }
    if (props.kind === 'casualty') props.onSave(list as BystanderCasualty[]);
    else props.onSave(list as BystanderMissingPerson[]);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        <div className="flex flex-wrap-reverse gap-3">
          <div className="flex flex-[1_1_120px] flex-col">
            <Button variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="flex flex-[1_1_120px] flex-col">
            <Button fullWidth onClick={done}>
              Done{people.length > 0 && ` (${people.length})`}
            </Button>
          </div>
        </div>
      }
    >
      {people.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
            Added · {people.length}
          </span>
          <ul className="flex flex-col gap-2">
            {people.map((person, i) => {
              const name = person.name || UNKNOWN_PERSON;
              const condition = 'condition_id' in person ? conditionName(person.condition_id) : '';
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border-[1.5px] border-gray-200 py-3 pr-2 pl-3.5 shadow-[0_1px_3px_rgba(16,24,40,.06)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600">
                    <User size={18} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="text-[15px] font-semibold">{name}</span>
                      {condition && (
                        <span className="flex h-5.5 items-center rounded-full bg-warning-50 px-2 text-[12px] font-semibold text-[#b54708]">
                          {condition}
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] leading-[1.4] text-gray-500">
                      {personMeta(person)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setPeople((list) => list.filter((_, idx) => idx !== i))}
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:bg-error-50 hover:text-[#b42318]',
                      FOCUS_RING
                    )}
                  >
                    <X size={18} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-[#eaecf0] bg-gray-50 p-5">
        <span className="text-[15px] font-bold">{people.length ? copy.another : copy.first}</span>

        {isCasualty && (
          <div className="flex flex-col gap-2">
            <FieldLabel id="condition-label" hint="Required">
              Condition
            </FieldLabel>
            <div
              role="radiogroup"
              aria-labelledby="condition-label"
              aria-describedby={errors.condition ? 'condition-error' : undefined}
              className="grid grid-cols-2 gap-2"
            >
              {conditions.map((condition) => (
                <OptionTile
                  key={condition.id}
                  name="casualty-condition"
                  value={condition.id}
                  checked={draft.condition_id === condition.id}
                  onSelect={(value) => {
                    setDraft((d) => ({ ...d, condition_id: value }));
                    setErrors((e) => ({ ...e, condition: undefined }));
                  }}
                  className="h-12 text-[14px]"
                >
                  {condition.name}
                </OptionTile>
              ))}
            </div>
            <FieldError id="condition-error">{errors.condition}</FieldError>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="person-name" hint="If known">
            Name
          </FieldLabel>
          <TextInput
            id="person-name"
            placeholder="Full name"
            autoComplete="off"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="person-age" hint="An estimate is fine">
            Age
          </FieldLabel>
          <div className="relative">
            <TextInput
              id="person-age"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 30"
              autoComplete="off"
              invalid={!!errors.age}
              aria-describedby={errors.age ? 'person-age-error' : undefined}
              value={draft.age}
              onChange={(e) => {
                setDraft((d) => ({ ...d, age: e.target.value.replace(/\D/g, '').slice(0, 3) }));
                setErrors((er) => ({ ...er, age: undefined }));
              }}
              className="pr-14"
            />
            <span
              aria-hidden
              className="font-landing-mono pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[13px] text-gray-400"
            >
              yrs
            </span>
          </div>
          <FieldError id="person-age-error">{errors.age}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel id="person-sex-label">Sex</FieldLabel>
          <SegmentedControl
            name="person-sex"
            labelledBy="person-sex-label"
            options={SEX_OPTIONS}
            value={draft.sex}
            onChange={(value) =>
              setDraft((d) => ({ ...d, sex: value as BystanderMissingPerson['sex'] }))
            }
          />
        </div>

        {isCasualty && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="person-diagnosis" hint="Optional">
              What you can see
            </FieldLabel>
            <TextInput
              id="person-diagnosis"
              placeholder="e.g. Cut on the left arm, awake and talking"
              autoComplete="off"
              value={draft.diagnosis}
              onChange={(e) => setDraft((d) => ({ ...d, diagnosis: e.target.value }))}
            />
          </div>
        )}

        <Button variant="outline" fullWidth onClick={addDraft}>
          Add to list
        </Button>
      </div>
    </Drawer>
  );
}
