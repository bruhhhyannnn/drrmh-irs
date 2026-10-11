import { Button, personMeta, UNKNOWN_PERSON, type PersonEntry } from '@/components/ds';
import { cn } from '@/lib';
import { User, Users } from 'lucide-react';

/**
 * One "People affected" row: icon, Missing persons / Casualties, a one-line summary and an
 * Add or Manage button (left out when the report can't be changed).
 */
export function PeopleRow({
  kind,
  meta,
  hasPeople,
  onManage,
}: {
  kind: 'missing' | 'casualty';
  meta: string;
  hasPeople: boolean;
  onManage?: () => void;
}) {
  const title = kind === 'missing' ? 'Missing persons' : 'Casualties';
  const Icon = kind === 'missing' ? User : Users;
  return (
    <div className="flex items-center gap-3.5 py-3">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          kind === 'missing' ? 'bg-gray-100 text-gray-600' : 'bg-error-50 text-[#b42318]'
        )}
      >
        <Icon size={20} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-gray-500">{meta}</span>
      </div>
      {onManage && (
        <Button
          variant="outline"
          size="sm"
          onClick={onManage}
          aria-label={`${hasPeople ? 'Manage' : 'Add'} ${title.toLowerCase()}`}
        >
          {hasPeople ? 'Manage' : 'Add'}
        </Button>
      )}
    </div>
  );
}

/** The people under a row on the submitted report, indented to the row's text. */
export function PeopleList({
  people,
}: {
  people: (PersonEntry & { id: string; condition?: string; diagnosis?: string | null })[];
}) {
  if (!people.length) return null;
  return (
    <ul className="flex flex-col gap-2 pb-1 pl-13.5">
      {people.map((person) => (
        <li
          key={person.id}
          className="flex flex-col gap-0.75 rounded-2xl border-[1.5px] border-gray-200 px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[15px] font-semibold">{person.name || UNKNOWN_PERSON}</span>
            {person.condition && (
              <span className="bg-warning-50 flex min-h-5.5 items-center rounded-full px-2 text-[12px] font-semibold text-[#b54708]">
                {person.condition}
              </span>
            )}
          </div>
          <span className="text-[13px] leading-[1.4] text-gray-500">{personMeta(person)}</span>
        </li>
      ))}
    </ul>
  );
}
