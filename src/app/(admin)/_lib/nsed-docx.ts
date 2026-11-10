import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  buildNsedDilimanReport,
  nsedDilimanFileName,
  type NsedClusterCounts,
  type NsedClusterTable,
  type NsedDilimanData,
} from './nsed-diliman';
import {
  buildNsedReport,
  nsedFileName,
  nsedTemplateFor,
  type NsedBreakdownTable,
  type NsedChart,
  type NsedReportData,
} from './nsed-report';
import type { SummarySource } from './summary';

// Fills an NSED report template in the browser: the UP Manila DRRM-H office's (public/templates/
// nsed-report.docx, also PGH's) or UPRI's UP Diliman report (nsed-report-diliman.docx). Each is
// the office's own file with its fixed wording and docxtemplater tags ({drillDate},
// {#timeline}…{/timeline}). Loaded on click, so the events pages don't carry docxtemplater until
// someone exports.

const NSED_TEMPLATE_URL = '/templates/nsed-report.docx';
const DILIMAN_TEMPLATE_URL = '/templates/nsed-report-diliman.docx';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The template's text width: A4 (11920) less its 1440 and 850 side margins, in twips.
const TEXT_WIDTH = 9630;
const BORDER = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ─── Breakdown tables ───────────────────────────────────────────────────────────────── */

// One per cluster, with a column per headcount field, so it goes in as raw XML ({@tableXml}):
// drawn like the template's tables (black hairlines, grey header that repeats on each page, bold
// total row). Fifteen columns don't fit the text width, so this table runs into the side margins,
// to 0.25 in from the paper's edges (about as close as office printers print), with 10 pt numbers
// and headers as large as fit (8 pt with UP Manila's 12 fields), wrapping only between words.

const PAGE_WIDTH = 11920;
const LEFT_MARGIN = 1440;
/** 0.25 in from each paper edge. */
const PAPER_EDGE = 360;
const BREAKDOWN_WIDTH = PAGE_WIDTH - 2 * PAPER_EDGE;
const CELL_SIDE = 30;
const UNIT_MIN_WIDTH = 1400;
const HEADER_SIZES = [8, 7.5, 7];
const NUMBER_SIZE = 10;

// Arial Bold widths in 1/1000 em (the regular face is narrower, so these are safe for both).
const UPPER = [
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611,
];
const LOWER = [
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556,
  333, 611, 556, 778, 556, 556, 500,
];
const PUNCT: Record<string, number> = {
  '.': 278,
  ',': 278,
  '-': 333,
  '/': 278,
  '(': 333,
  ')': 333,
};

function charWidth(c: string) {
  if (c >= 'A' && c <= 'Z') return UPPER[c.charCodeAt(0) - 65];
  if (c >= 'a' && c <= 'z') return LOWER[c.charCodeAt(0) - 97];
  if (c >= '0' && c <= '9') return 556;
  return PUNCT[c] ?? 611;
}

/** Twips a piece of text takes at a font size, with a little to spare for Word's rounding. */
const textWidth = (text: string, size: number) =>
  Math.ceil(([...text].reduce((sum, c) => sum + charWidth(c), 0) * size * 20 * 1.02) / 1000);

/** The pieces a header may wrap into: at spaces, and after "-" and "/". */
const headerWords = (header: string) => header.split(/\s+|(?<=[-/])/).filter(Boolean);

/** After a "/", a zero-width space, so Word may wrap "Visitors/Patients" there. */
const wrappable = (header: string) => header.replace(/\//g, '/\u200B');

/** Column widths and the header size: the largest size that leaves the unit column its room. */
export function breakdownLayout(table: NsedBreakdownTable) {
  const numbers = table.columns.map((_, i) => [
    ...table.rows.map((r) => r.counts[i]),
    table.totals[i],
  ]);
  const layout = (headerSize: number) => {
    const numberWidths = table.columns.map(
      (header, i) =>
        Math.max(
          ...headerWords(header).map((w) => textWidth(w, headerSize)),
          ...numbers[i].map((n) => textWidth(n, NUMBER_SIZE))
        ) +
        2 * CELL_SIDE
    );
    const unitWidth = BREAKDOWN_WIDTH - numberWidths.reduce((sum, w) => sum + w, 0);
    return { headerSize, numberWidths, unitWidth };
  };
  for (const size of HEADER_SIZES) {
    const fit = layout(size);
    if (fit.unitWidth >= UNIT_MIN_WIDTH) return fit;
  }
  // More fields than fit: the smallest size, and the table grows past the edges it aims for.
  const smallest = layout(HEADER_SIZES[HEADER_SIZES.length - 1]);
  return { ...smallest, unitWidth: UNIT_MIN_WIDTH };
}

function cell(
  text: string,
  width: number,
  o: { size: number; header?: boolean; bold?: boolean; center?: boolean }
) {
  const shading = o.header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
  const vAlign = `<w:vAlign w:val="${o.header ? 'bottom' : 'center'}"/>`;
  const half = Math.round(o.size * 2);
  const bold = o.header || o.bold ? '<w:b/><w:bCs/>' : '';
  const jc = o.center ? '<w:jc w:val="center"/>' : '';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}${vAlign}</w:tcPr>` +
    `<w:p><w:pPr><w:pStyle w:val="NsedTableText"/>${jc}</w:pPr>` +
    `<w:r><w:rPr>${bold}<w:sz w:val="${half}"/><w:szCs w:val="${half}"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`
  );
}

export function breakdownTableXml(table: NsedBreakdownTable) {
  const { headerSize, numberWidths, unitWidth } = breakdownLayout(table);
  const widths = [unitWidth, ...numberWidths];
  const tableWidth = widths.reduce((sum, w) => sum + w, 0);

  const header =
    `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>` +
    cell(table.unitHeader, unitWidth, { size: NUMBER_SIZE, header: true }) +
    table.columns
      .map((c, i) =>
        cell(wrappable(c), numberWidths[i], { size: headerSize, header: true, center: true })
      )
      .join('') +
    `</w:tr>`;
  const line = (unit: string, counts: string[], bold = false) =>
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>` +
    cell(unit, unitWidth, { size: NUMBER_SIZE, bold }) +
    counts
      .map((n, i) => cell(n, numberWidths[i], { size: NUMBER_SIZE, bold, center: true }))
      .join('') +
    `</w:tr>`;

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/>` +
    // Word 2013+ measures the indent to the table's border: back out to 0.25 in from the paper.
    `<w:tblInd w:w="${PAPER_EDGE - LEFT_MARGIN}" w:type="dxa"/>` +
    `<w:tblBorders><w:top ${BORDER}/><w:left ${BORDER}/><w:bottom ${BORDER}/><w:right ${BORDER}/><w:insideH ${BORDER}/><w:insideV ${BORDER}/></w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="${CELL_SIDE}" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="${CELL_SIDE}" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    header +
    table.rows.map((r) => line(r.unit, r.counts)).join('') +
    line('Total', table.totals, true) +
    `</w:tbl>`
  );
}

/* ─── Headcount by category chart ────────────────────────────────────────────────────── */

// A native Word chart (word/charts/chart1.xml), so the office can restyle it in Word: stacked
// horizontal bars, one per unit, first unit on top, legend on the right. The values are stored
// in the chart itself (no embedded workbook), which Word and LibreOffice both draw.

const CHART_PATH = 'word/charts/chart1.xml';
const CHART_REL_ID = 'rIdNsedChart1';
const CHART_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const CHART_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

const EMU_PER_TWIP = 635;
const EMU_PER_INCH = 914400;

function textProps(size: number, color = '404040') {
  return (
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}">` +
    `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/>` +
    `</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`
  );
}

const NO_LABELS =
  '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';

function strLit(values: string[]) {
  return (
    `<c:strLit><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('') +
    `</c:strLit>`
  );
}

function numLit(values: number[]) {
  return (
    `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('') +
    `</c:numLit>`
  );
}

function series(
  idx: number,
  name: string,
  fill: string,
  values: number[],
  units: string[],
  labels = ''
) {
  return (
    `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/><c:tx><c:v>${escapeXml(name)}</c:v></c:tx>` +
    `<c:spPr>${fill}<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>` +
    labels +
    `<c:cat>${strLit(units)}</c:cat><c:val>${numLit(values)}</c:val></c:ser>`
  );
}

/** The chart part: chart1.xml. */
export function categoryChartXml(chart: NsedChart) {
  const { units, totals } = chart;
  const n = chart.series.length;
  // The totals ride on a last, invisible series a little longer than the bars' padding, each
  // labelled with its bar's total; its legend entry is hidden.
  const pad = Math.max(1, Math.round(Math.max(1, ...totals) * 0.08));
  const totalLabels =
    `<c:dLbls>` +
    totals
      .map(
        (t, i) =>
          `<c:dLbl><c:idx val="${i}"/><c:layout/><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>` +
          `<a:rPr lang="en-US" sz="1000"><a:solidFill><a:srgbClr val="7F7F7F"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr>` +
          `<a:t>${t.toLocaleString('en-US')}</a:t></a:r></a:p></c:rich></c:tx>` +
          `<c:dLblPos val="ctr"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>`
      )
      .join('') +
    NO_LABELS +
    `</c:dLbls>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>` +
    `<c:barChart><c:barDir val="bar"/><c:grouping val="stacked"/><c:varyColors val="0"/>` +
    chart.series
      .map((s, i) =>
        series(
          i,
          s.name,
          `<a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>`,
          s.values,
          units
        )
      )
      .join('') +
    series(
      n,
      'Total',
      '<a:noFill/>',
      units.map(() => pad),
      units,
      totalLabels
    ) +
    `<c:gapWidth val="50"/><c:overlap val="100"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>` +
    // Units down the left, first on top; the value axis stays at the bottom.
    `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>` +
    `<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:ln></c:spPr>${textProps(1000, '000000')}` +
    `<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>` +
    `<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${textProps(1000, '000000')}` +
    `<c:crossAx val="5001"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>` +
    `</c:plotArea>` +
    `<c:legend><c:legendPos val="r"/><c:legendEntry><c:idx val="${n}"/><c:delete val="1"/></c:legendEntry><c:overlay val="0"/>${textProps(1000, '000000')}</c:legend>` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textProps(1000)}` +
    `</c:chartSpace>`
  );
}

/** The paragraph that shows the chart, as tall as its bars need. */
function chartParagraphXml(chart: NsedChart) {
  if (!chart.units.length) {
    return '<w:p><w:pPr><w:pStyle w:val="NsedBody"/></w:pPr><w:r><w:t>No reports were received.</w:t></w:r></w:p>';
  }
  const cx = TEXT_WIDTH * EMU_PER_TWIP;
  const cy = Math.round(Math.max(3, chart.units.length * 0.34 + 0.7) * EMU_PER_INCH);
  return (
    `<w:p><w:pPr><w:pStyle w:val="NsedBody"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="9001" name="Headcount by category"/>` +
    `<wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart r:id="${CHART_REL_ID}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

/** Adds chart1.xml to the filled file, with its relationship and content type. */
function addChartPart(zip: PizZip, chart: NsedChart) {
  zip.file(CHART_PATH, categoryChartXml(chart), { createFolders: false });
  const rels = 'word/_rels/document.xml.rels';
  zip.file(
    rels,
    zip
      .file(rels)!
      .asText()
      .replace(
        '</Relationships>',
        `<Relationship Id="${CHART_REL_ID}" Type="${CHART_REL_TYPE}" Target="charts/chart1.xml"/></Relationships>`
      )
  );
  const types = '[Content_Types].xml';
  zip.file(
    types,
    zip
      .file(types)!
      .asText()
      .replace(
        '</Types>',
        `<Override ContentType="${CHART_TYPE}" PartName="/${CHART_PATH}"/></Types>`
      )
  );
}

/* ─── UP Diliman cluster table ───────────────────────────────────────────────────────── */

// UPRI's table, with a header row added: No. | Cluster | College/Unit | Reports | Casualties |
// Headcount. A bold "Cluster Total" row per cluster, its units under it (No. and Cluster merged
// down), and a GRAND TOTAL row. Letter paper with 1 in margins leaves 9360 twips; 9 pt like
// UPRI's table.

const DILIMAN_WIDTHS = [500, 2400, 3160, 1000, 1150, 1150];
const DILIMAN_SIZE = 18;

function dilimanCell(
  text: string,
  width: number,
  o: {
    header?: boolean;
    bold?: boolean;
    center?: boolean;
    merge?: 'restart' | 'continue';
    span?: number;
  }
) {
  const shading = o.header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
  const span = o.span ? `<w:gridSpan w:val="${o.span}"/>` : '';
  const merge = o.merge ? `<w:vMerge w:val="${o.merge}"/>` : '';
  const bold = o.header || o.bold ? '<w:b/><w:bCs/>' : '';
  const jc = o.center ? '<w:jc w:val="center"/>' : '';
  const run = text
    ? `<w:r><w:rPr>${bold}<w:sz w:val="${DILIMAN_SIZE}"/><w:szCs w:val="${DILIMAN_SIZE}"/></w:rPr>` +
      `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
    : '';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span}${merge}${shading}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:firstLine="0"/>${jc}</w:pPr>${run}</w:p></w:tc>`
  );
}

const countCells = (c: NsedClusterCounts, bold = false) =>
  [c.reports, c.casualties, c.headcount]
    .map((n, i) =>
      dilimanCell(n.toLocaleString('en-US'), DILIMAN_WIDTHS[3 + i], { bold, center: true })
    )
    .join('');

export function clusterTableXml(table: NsedClusterTable) {
  if (!table.clusters.length) return '<w:p><w:r><w:t>No reports were received.</w:t></w:r></w:p>';
  const [noWidth, clusterWidth, unitWidth] = DILIMAN_WIDTHS;
  const tr = (cells: string, header = false) =>
    `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells}</w:tr>`;

  const header = tr(
    ['No.', 'Cluster', 'College/Unit', 'Reports', 'Casualties', 'Headcount']
      .map((h, i) =>
        dilimanCell(h, DILIMAN_WIDTHS[i], { header: true, center: i !== 1 && i !== 2 })
      )
      .join(''),
    true
  );
  const rows = table.clusters.flatMap((c, i) => [
    tr(
      dilimanCell(String(i + 1), noWidth, { bold: true, center: true, merge: 'restart' }) +
        dilimanCell(c.name, clusterWidth, { bold: true, merge: 'restart' }) +
        dilimanCell('Cluster Total', unitWidth, { bold: true }) +
        countCells(c, true)
    ),
    ...c.units.map((u) =>
      tr(
        dilimanCell('', noWidth, { merge: 'continue' }) +
          dilimanCell('', clusterWidth, { merge: 'continue' }) +
          dilimanCell(u.name, unitWidth, {}) +
          countCells(u)
      )
    ),
  ]);
  const total = tr(
    dilimanCell('GRAND TOTAL', noWidth + clusterWidth + unitWidth, { bold: true, span: 3 }) +
      countCells(table.total, true)
  );
  const width = DILIMAN_WIDTHS.reduce((sum, w) => sum + w, 0);

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:jc w:val="center"/>` +
    `<w:tblBorders><w:top ${BORDER}/><w:left ${BORDER}/><w:bottom ${BORDER}/><w:right ${BORDER}/><w:insideH ${BORDER}/><w:insideV ${BORDER}/></w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${DILIMAN_WIDTHS.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    header +
    rows.join('') +
    total +
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
  doc.render({
    ...data,
    breakdowns: data.breakdowns.map((b) => ({ ...b, tableXml: breakdownTableXml(b.table) })),
    categoryChart: chartParagraphXml(data.chart),
  });
  const zip = doc.getZip();
  if (data.chart.units.length) addChartPart(zip, data.chart);
  dropFolderEntries(zip);
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
}

/** docxtemplater adds a "word/" folder entry; Word Online and OneDrive fail on those. */
function dropFolderEntries(zip: PizZip) {
  // Deleted from the index only, since zip.remove() on a folder would take its files with it.
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) delete zip.files[name];
  }
}

/** UPRI's UP Diliman template filled with one event's report, as .docx bytes. */
export function fillNsedDilimanTemplate(template: ArrayBuffer | Uint8Array, data: NsedDilimanData) {
  const doc = new Docxtemplater(new PizZip(template), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render({ ...data, clusterTable: clusterTableXml(data.table) });
  const zip = doc.getZip();
  dropFolderEntries(zip);
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
}

async function loadTemplate(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('The NSED report template could not be loaded.');
  return res.arrayBuffer();
}

/** Builds the event's NSED report, on its campus's template, and downloads it. */
export async function downloadNsedReport(source: SummarySource) {
  const template = nsedTemplateFor(source.event.campus.name);
  if (!template) throw new Error('This campus has no NSED report.');
  const bytes =
    template === 'diliman'
      ? fillNsedDilimanTemplate(
          await loadTemplate(DILIMAN_TEMPLATE_URL),
          buildNsedDilimanReport(source)
        )
      : fillNsedTemplate(await loadTemplate(NSED_TEMPLATE_URL), buildNsedReport(source));

  // Copied into a plain ArrayBuffer, which is what Blob takes.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: DOCX_TYPE }));
  const a = document.createElement('a');
  a.href = url;
  a.download = template === 'diliman' ? nsedDilimanFileName(source) : nsedFileName(source);
  a.click();
  URL.revokeObjectURL(url);
}
