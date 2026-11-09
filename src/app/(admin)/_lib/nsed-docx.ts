import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  buildNsedReport,
  nsedFileName,
  type NsedBreakdownTable,
  type NsedChart,
  type NsedReportData,
} from './nsed-report';
import type { SummarySource } from './summary';

// Fills the office's NSED report template in the browser. The template is public/templates/
// nsed-report.docx: the office's letterhead with the report's fixed wording and docxtemplater
// tags ({drillDate}, {#timeline}…{/timeline}). Loaded on click, so the events pages don't carry
// docxtemplater until someone exports.

const NSED_TEMPLATE_URL = '/templates/nsed-report.docx';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The template's text width: A4 (11920) less its 1440 and 850 side margins, in twips.
const TEXT_WIDTH = 9630;
const BORDER = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ─── Breakdown tables ───────────────────────────────────────────────────────────────── */

// One per cluster, with a column per headcount field, so it goes in as raw XML ({@tableXml}):
// drawn like the template's tables (black hairlines, grey header that repeats on each page, bold
// total row), 12 pt. The field names run bottom to top so the narrow number columns fit.

// Arial 12 pt: a digit is about 134 twips wide, a comma 67; cells keep 60 twips each side.
const CELL_SIDE = 60;
const numberWidth = (values: string[]) =>
  Math.max(
    460,
    ...values.map((v) => v.replace(/,/g, '').length * 134 + (v.match(/,/g)?.length ?? 0) * 67)
  ) +
  2 * CELL_SIDE +
  40;

function cell(
  text: string,
  width: number,
  o: { header?: boolean; bold?: boolean; align?: 'left' | 'center'; rotate?: boolean } = {}
) {
  const shading = o.header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '';
  const direction = o.rotate ? '<w:textDirection w:val="btLr"/>' : '';
  const vAlign = `<w:vAlign w:val="${o.rotate ? 'center' : o.header ? 'bottom' : 'center'}"/>`;
  const bold = o.header || o.bold ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : '';
  const jc = o.align === 'center' ? '<w:jc w:val="center"/>' : '';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}${direction}${vAlign}</w:tcPr>` +
    `<w:p><w:pPr><w:pStyle w:val="NsedTableText"/>${jc}</w:pPr>` +
    `<w:r>${bold}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`
  );
}

export function breakdownTableXml(table: NsedBreakdownTable) {
  const numberWidths = table.columns.map((_, i) =>
    numberWidth([...table.rows.map((r) => r.counts[i]), table.totals[i]])
  );
  const unitWidth = Math.max(1800, TEXT_WIDTH - numberWidths.reduce((sum, w) => sum + w, 0));
  const widths = [unitWidth, ...numberWidths];
  const tableWidth = widths.reduce((sum, w) => sum + w, 0);
  // The rotated header row is as tall as its longest field name (bold, about 150 twips a letter).
  const headerHeight = Math.max(...table.columns.map((c) => c.length)) * 150 + 2 * CELL_SIDE;

  const header =
    `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${headerHeight}" w:hRule="atLeast"/><w:tblHeader/></w:trPr>` +
    cell(table.unitHeader, unitWidth, { header: true }) +
    table.columns.map((c, i) => cell(c, numberWidths[i], { header: true, rotate: true })).join('') +
    `</w:tr>`;
  const line = (unit: string, counts: string[], bold = false) =>
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>` +
    cell(unit, unitWidth, { bold }) +
    counts.map((n, i) => cell(n, numberWidths[i], { bold, align: 'center' })).join('') +
    `</w:tr>`;

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/>` +
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
  // docxtemplater adds a "word/" folder entry; Word Online and OneDrive fail on those. Deleted
  // from the index only, since zip.remove() on a folder would take its files with it.
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) delete zip.files[name];
  }
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
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
