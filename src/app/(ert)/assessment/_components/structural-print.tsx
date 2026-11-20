'use client';

import { Section } from '@/components/print/report-sheet';
import { cn } from '@/lib';
import {
  RECOMMENDATION_TEXT,
  STRUCTURAL_ELEMENTS,
  STRUCTURAL_THRESHOLD,
  defectInfo,
  elementInfo,
  extentOptions,
  formatRating,
  rateStructural,
  type StructuralInput,
} from '@/lib/structural-integrity';
import { elementReason, localElementsText } from './structural-summary';

// The structural integrity part of the A4 assessment (DRRM-044): the recommendation, the rating
// per element and the defects found. Always in English, like the rest of the sheet's tables.

const TH = 'text-[12px] font-bold tracking-[.04em] text-gray-600 uppercase';
const CRITICAL_TEXT = { yes: 'Yes', no: 'No', na: 'N/A' };

export function StructuralPrint({ input }: { input: StructuralInput }) {
  const rating = rateStructural(input);
  const found = input.findings.filter((f) => f.answer === 'yes');
  const flagged = rating.recommendation !== 'none';

  return (
    <Section
      title="Structural integrity"
      note={`Condition rating ${formatRating(rating.gcr)} · ${rating.found} found${rating.na > 0 ? ` · ${rating.na} N/A` : ''}`}
    >
      <div
        className={cn(
          'mt-3 rounded-xl border px-4 py-3 text-[15px] break-inside-avoid',
          flagged
            ? 'border-warning-200 bg-warning-50 text-warning-800'
            : 'border-gray-300 bg-gray-50 text-gray-800'
        )}
      >
        <span className="font-bold">{RECOMMENDATION_TEXT[rating.recommendation]}.</span>{' '}
        {rating.recommendation === 'overall' &&
          `The building's condition rating is above ${STRUCTURAL_THRESHOLD}%.`}
        {rating.recommendation === 'local' && `Areas: ${localElementsText(rating)}.`}
      </div>

      <table className="mt-3 w-full text-left text-[14px]">
        <thead className={cn(TH, 'border-b border-gray-300')}>
          <tr>
            <th scope="col" className="py-2 pr-2">
              Element
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Rating
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              Found
            </th>
            <th scope="col" className="px-2 py-2 text-right">
              N/A
            </th>
            <th scope="col" className="px-2 py-2">
              Critical crack
            </th>
            <th scope="col" className="py-2 pl-2">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {STRUCTURAL_ELEMENTS.map((element) => {
            const r = rating.elements[element.code];
            return (
              <tr key={element.code} className="border-b border-line break-inside-avoid">
                <th scope="row" className="py-1.75 pr-2 align-top font-semibold">
                  {element.title.en}
                </th>
                <td className="font-landing-mono px-2 py-1.75 text-right align-top font-bold">
                  {r.notAssessed ? 'N/A' : formatRating(r.lcr)}
                </td>
                <td className="font-landing-mono px-2 py-1.75 text-right align-top">{r.found}</td>
                <td className="font-landing-mono px-2 py-1.75 text-right align-top">{r.na}</td>
                <td className="px-2 py-1.75 align-top">
                  {element.critical
                    ? r.critical
                      ? CRITICAL_TEXT[r.critical]
                      : '—'
                    : 'Not checked'}
                </td>
                <td
                  className={cn(
                    'py-1.75 pl-2 align-top',
                    r.needsInvestigation && 'font-bold text-error-700'
                  )}
                >
                  {r.needsInvestigation ? `Investigate (${elementReason(r)})` : 'None'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="pt-2 text-[12px] leading-[1.45] text-gray-500">
        Rapid Condition Assessment Tool, Material Component (Orozco et al., UP Diliman Institute of
        Civil Engineering). Higher ratings mean more deterioration; above {STRUCTURAL_THRESHOLD}%
        the tool asks for a detailed investigation. Walls are rated but not counted in the building
        rating. A screening by ERT members, with the urgency of repair left to an engineer.
      </p>

      {found.length > 0 && (
        <div className="flex flex-col pt-3">
          <span className={cn(TH, 'border-b border-gray-300 pb-1.5 break-after-avoid')}>
            Defects found
          </span>
          {found.map((f) => {
            const defect = defectInfo(f.defect);
            if (!defect) return null;
            const severity = f.severity ? defect.severity[f.severity - 1].en : '';
            const extent = f.extent ? extentOptions(f.element)[f.extent - 1].en : '';
            return (
              <div
                key={`${f.element}:${f.defect}`}
                className="flex gap-3 border-b border-line py-2 text-[14px] break-inside-avoid"
              >
                <span className="w-24 shrink-0 font-semibold">
                  {elementInfo(f.element).title.en}
                </span>
                <span className="font-landing-mono w-8 shrink-0 text-[13px] font-semibold text-gray-500">
                  {defect.code}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.4]">
                  <span className="font-semibold">{defect.term}</span>
                  <span className="text-gray-600">
                    {severity} · {extent}
                  </span>
                  {f.remarks && (
                    <span className="text-[13px] text-gray-600">
                      <span className="font-semibold">Remarks:</span> {f.remarks}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
