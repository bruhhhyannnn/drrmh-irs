import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  buildNsedReport,
  nsedFileName,
  type NsedCategories,
  type NsedReportData,
} from './nsed-report';
import type { SummarySource } from './summary';

// Fills the office's NSED report template in the browser. The template is public/templates/
// nsed-report.docx: the office's letterhead with the report's fixed wording and docxtemplater
// tags ({drillDate}, {#timeline}…{/timeline}). Loaded on click, so the events pages don't carry
// docxtemplater until someone exports.

const NSED_TEMPLATE_URL = '/templates/nsed-report.docx';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ─── Headcount by category ──────────────────────────────────────────────────────────── */

// The one table whose columns depend on the data (one per cluster). docxtemplater can only
// repeat rows, so this table goes in as raw XML through {@categoryTable}, drawn like the
// template's tables: black hairlines, grey header that repeats on each page, bold total row.

// The template's text width: A4 (11920) less its 1440 and 850 side margins.
const TEXT_WIDTH = 9630;
const BORDER = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cell(
  text: string,
  width: number,
  o: { header?: boolean; bold?: boolean; right?: boolean }
) {
  const shading = o.header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
  const bold = o.header || o.bold ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : '';
  const jc = o.right ? '<w:jc w:val="right"/>' : '';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>` +
    `<w:p><w:pPr><w:pStyle w:val="NsedTableText"/>${jc}</w:pPr>` +
    `<w:r>${bold}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`
  );
}

function row(cells: string[], widths: number[], o: { header?: boolean; bold?: boolean } = {}) {
  const trPr = `<w:trPr><w:cantSplit/>${o.header ? '<w:tblHeader/>' : ''}</w:trPr>`;
  return `<w:tr>${trPr}${cells.map((text, i) => cell(text, widths[i], { ...o, right: i > 0 })).join('')}</w:tr>`;
}

function categoryTableXml(categories: NsedCategories) {
  const totalWidth = 1100;
  const clusterWidth = Math.floor(5700 / Math.max(1, categories.clusters.length));
  const firstWidth = TEXT_WIDTH - totalWidth - clusterWidth * categories.clusters.length;
  const widths = [firstWidth, ...categories.clusters.map(() => clusterWidth), totalWidth];

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_WIDTH}" w:type="dxa"/>` +
    `<w:tblBorders><w:top ${BORDER}/><w:left ${BORDER}/><w:bottom ${BORDER}/><w:right ${BORDER}/><w:insideH ${BORDER}/><w:insideV ${BORDER}/></w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    row(['Category', ...categories.clusters, 'Total'], widths, { header: true }) +
    categories.rows.map((r) => row([r.name, ...r.counts, r.total], widths)).join('') +
    row(['Total', ...categories.totals, categories.total], widths, { bold: true }) +
    `</w:tbl>`
  );
}

/* ─── Fill and download ──────────────────────────────────────────────────────────────── */

/** The template filled with one event's report, as .docx bytes. */
export function fillNsedTemplate(template: ArrayBuffer | Uint8Array, data: NsedReportData) {
  const doc = new Docxtemplater(new PizZip(template), {
    paragraphLoop: true,
    linebreaks: true,
    // A tag the office adds to the template without a value shows as nothing, not "undefined".
    nullGetter: () => '',
  });
  doc.render({ ...data, categoryTable: categoryTableXml(data.categories) });
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Builds the event's NSED report from its reports and downloads it. */
export async function downloadNsedReport(source: SummarySource) {
  const res = await fetch(NSED_TEMPLATE_URL);
  if (!res.ok) throw new Error('The NSED report template could not be loaded.');
  const bytes = fillNsedTemplate(await res.arrayBuffer(), buildNsedReport(source));

  // Copied into a plain ArrayBuffer, which is what Blob takes.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: DOCX_TYPE }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nsedFileName(source);
  a.click();
  URL.revokeObjectURL(url);
}
