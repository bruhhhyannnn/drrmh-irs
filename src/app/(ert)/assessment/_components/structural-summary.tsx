'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import type { AnswerValue } from '@/lib/assessment-template';
import {
  RECOMMENDATION_TEXT,
  STRUCTURAL_ELEMENTS,
  STRUCTURAL_THRESHOLD,
  defectInfo,
  elementInfo,
  extentOptions,
  formatRating,
  rateStructural,
  type ElementInfo,
  type ElementRating,
  type StructuralFinding,
  type StructuralInput,
  type StructuralRating,
} from '@/lib/structural-integrity';
import { ChevronDown } from 'lucide-react';
import { Card, Dot, Mono, Pill } from '../../_components/chrome';

// The structural integrity result of one assessment (DRRM-044): the tool's recommendation, the
// condition rating for the building and per element, and the defects found. Used by the review
// step (the rating so far) and the read-only view. A higher rating means more deterioration.

/** "Columns and Walls": the elements that need a detailed local investigation. */
export function localElementsText(rating: StructuralRating): string {
  const names = rating.localElements.map((code) => elementInfo(code).title.en);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Why an element needs a closer look: over the line, its critical crack, or both. */
export function elementReason(rating: ElementRating): string {
  const reasons = [];
  if (rating.lcr > STRUCTURAL_THRESHOLD) reasons.push(`rated above ${STRUCTURAL_THRESHOLD}%`);
  if (rating.critical === 'yes') reasons.push('critical crack present');
  return reasons.join(', ');
}

export function StructuralSummary({ input }: { input: StructuralInput }) {
  const rating = rateStructural(input);
  const found = input.findings.filter((f) => f.answer === 'yes');

  return (
    <div className="flex flex-col gap-4">
      {rating.recommendation !== 'none' && (
        <Banner tone={rating.recommendation === 'overall' ? 'error' : 'warning'}>
          <span className="font-bold">{RECOMMENDATION_TEXT[rating.recommendation]}.</span>{' '}
          {rating.recommendation === 'overall'
            ? `The building's condition rating is above ${STRUCTURAL_THRESHOLD}%.`
            : `Have an engineer look at the ${localElementsText(rating).toLowerCase()}.`}
        </Banner>
      )}

      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="flex flex-col">
            <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
              Condition rating
            </span>
            <Mono
              className={cn(
                'text-[40px] leading-none font-semibold',
                rating.gcr > STRUCTURAL_THRESHOLD && 'text-error-700'
              )}
            >
              {formatRating(rating.gcr)}
            </Mono>
          </div>
          <span className="pb-1 text-[16px] text-gray-600">
            {RECOMMENDATION_TEXT[rating.recommendation]}
          </span>
        </div>
        <p className="text-[14px] leading-[1.45] text-gray-600">
          Higher means more deterioration. Above <Mono>{STRUCTURAL_THRESHOLD}%</Mono> the tool asks
          for a detailed investigation. <Mono>{rating.found}</Mono>{' '}
          {rating.found === 1 ? 'defect' : 'defects'} found
          {rating.na > 0 && (
            <>
              {' '}
              · <Mono>{rating.na}</Mono> N/A
            </>
          )}
          .
        </p>

        <ul className="grid gap-3 sm:grid-cols-2">
          {STRUCTURAL_ELEMENTS.map((element) => (
            <ElementTile
              key={element.code}
              element={element}
              rating={rating.elements[element.code]}
            />
          ))}
        </ul>

        <p className="text-[13px] leading-[1.45] text-gray-500">
          A screening by ERT members with the Rapid Condition Assessment Tool (Material Component).
          It leaves the urgency of repair to an engineer, so it does not replace an engineer&apos;s
          inspection.
        </p>
      </Card>

      {found.length > 0 && (
        <Card className="flex flex-col gap-4 p-5 md:p-6">
          <h3 className="text-[18px] font-bold">
            Defects found <Mono className="text-gray-500">({found.length})</Mono>
          </h3>
          {STRUCTURAL_ELEMENTS.map((element) => {
            const rows = found.filter((f) => f.element === element.code);
            if (rows.length === 0) return null;
            return (
              <div key={element.code} className="flex flex-col gap-1.5">
                <span className="text-[14px] font-bold text-gray-600">{element.title.en}</span>
                <ul className="flex flex-col">
                  {rows.map((f) => (
                    <FindingRow key={f.defect} finding={f} />
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function ElementTile({ element, rating }: { element: ElementInfo; rating: ElementRating }) {
  const reason = elementReason(rating);
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-line bg-gray-50 px-4 py-3">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-gray-600">{element.title.en}</span>
        {rating.needsInvestigation && (
          <Pill tone="error" icon={<Dot className="bg-error-500" />}>
            Investigate
          </Pill>
        )}
      </span>
      <Mono
        className={cn(
          'text-[22px] leading-tight font-semibold',
          rating.notAssessed && 'text-gray-400'
        )}
      >
        {rating.notAssessed ? 'N/A' : formatRating(rating.lcr)}
      </Mono>
      <span className="text-[13px] leading-[1.4] text-gray-500">
        {rating.notAssessed
          ? 'Not assessed'
          : `${rating.found} found${rating.na > 0 ? ` · ${rating.na} N/A` : ''}`}
        {reason && ` · ${reason}`}
        {element.factor === 0 && ' · not counted in the building rating'}
      </span>
    </li>
  );
}

/** One defect that is there: what it is, how bad, how widespread, and any remarks. */
function FindingRow({ finding }: { finding: StructuralFinding }) {
  const defect = defectInfo(finding.defect);
  if (!defect) return null;
  const severity = finding.severity ? defect.severity[finding.severity - 1] : null;
  const extent = finding.extent ? extentOptions(finding.element)[finding.extent - 1] : null;
  return (
    <li className="flex gap-3 border-b border-line py-2 text-[15px] last:border-b-0">
      <Mono className="w-9 shrink-0 pt-0.5 text-[13px] text-gray-500">{defect.code}</Mono>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="leading-[1.45] font-semibold">{defect.term}</span>
        <span className="text-[14px] leading-[1.45] text-gray-600">
          {[severity?.en, extent?.en].filter(Boolean).join(' · ')}
        </span>
        {finding.remarks && (
          <span className="text-[14px] text-gray-600">
            <span className="font-semibold">Remarks:</span> {finding.remarks}
          </span>
        )}
      </span>
    </li>
  );
}

const ANSWER_TEXT: Record<AnswerValue, string> = { yes: 'Yes', no: 'No', na: 'N/A' };

/** Yes means a defect (or a critical crack) is there, so it reads as the unsafe answer. */
function AnswerPill({ answer }: { answer: AnswerValue | null }) {
  if (answer === null) return <span className="text-[14px] text-gray-400">—</span>;
  if (answer === 'na') {
    return <span className="pt-0.5 text-[14px] font-semibold text-gray-500">N/A</span>;
  }
  if (answer === 'yes') {
    return (
      <Pill tone="error" icon={<Dot className="bg-error-500" />}>
        {ANSWER_TEXT[answer]}
      </Pill>
    );
  }
  return <Pill tone="success">{ANSWER_TEXT[answer]}</Pill>;
}

/** Every structural answer of a submitted assessment, one collapsible card per element. */
export function StructuralAnswers({ input }: { input: StructuralInput }) {
  const criticalOf = new Map(input.critical.map((c) => [c.element as string, c.answer]));
  return (
    <>
      {STRUCTURAL_ELEMENTS.map((element) => {
        const rows = input.findings.filter((f) => f.element === element.code);
        const found = rows.filter((f) => f.answer === 'yes').length;
        const critical = criticalOf.get(element.code) ?? null;
        return (
          <Card key={element.code} className="p-0">
            <details className="group flex flex-col">
              <summary
                className={cn(
                  'flex cursor-pointer list-none items-start gap-3 rounded-[22px] p-5 select-none md:p-6 [&::-webkit-details-marker]:hidden',
                  FOCUS_RING
                )}
              >
                <Bilingual
                  as="h3"
                  en={`Structural integrity: ${element.title.en}`}
                  fil={element.title.fil}
                  className="min-w-0 flex-1 text-[18px] leading-[1.3] font-bold"
                />
                {found > 0 && (
                  <Pill tone="error" icon={<Dot className="bg-error-500" />}>
                    {found} found
                  </Pill>
                )}
                <ChevronDown
                  size={20}
                  aria-hidden
                  className="mt-1 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180"
                />
              </summary>
              <ul className="flex flex-col px-5 pb-5 md:px-6 md:pb-6">
                {rows.map((f) => {
                  const defect = defectInfo(f.defect);
                  if (!defect) return null;
                  const severity = f.severity ? defect.severity[f.severity - 1] : null;
                  const extent = f.extent ? extentOptions(f.element)[f.extent - 1] : null;
                  return (
                    <li
                      key={f.defect}
                      className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <Mono className="w-9 shrink-0 pt-0.5 text-[13px] text-gray-500">
                          {defect.code}
                        </Mono>
                        <Bilingual
                          en={defect.prompt.en}
                          fil={defect.prompt.fil}
                          className="min-w-0 flex-1 text-[15px] leading-[1.45]"
                        />
                        <AnswerPill answer={f.answer} />
                      </div>
                      {severity && extent && (
                        <p className="ml-12 text-[14px] text-gray-600">
                          {severity.en} · {extent.en}
                        </p>
                      )}
                      {f.remarks && (
                        <p className="ml-12 text-[14px] text-gray-600">
                          <span className="font-semibold">Remarks:</span> {f.remarks}
                        </p>
                      )}
                    </li>
                  );
                })}
                {element.critical && (
                  <li className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
                    <Mono className="w-9 shrink-0 pt-0.5 text-[13px] text-gray-500">!</Mono>
                    <Bilingual
                      en={element.critical.en}
                      fil={element.critical.fil}
                      className="min-w-0 flex-1 text-[15px] leading-[1.45] font-semibold"
                    />
                    <AnswerPill answer={critical} />
                  </li>
                )}
              </ul>
            </details>
          </Card>
        );
      })}
    </>
  );
}
