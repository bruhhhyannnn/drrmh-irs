---
type: feature
ticket: DRRM-029
status: in-review
branch: feat/DRRM-029-nsed-breakdown-width
modules:
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-029] Feature Plan: NSED breakdown tables with horizontal headers

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-029-nsed-breakdown-width`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

DRRM-028 gave each NSED breakdown table a column per personnel category (14 number columns with Missing and Casualty). To fit the text width, the category names ran bottom to top. The office doesn't want rotated headers, and the report is printed for the deans and chancellors, so the pages stay portrait (no landscape section).

At the template's margins (6.7 in of text), the headers don't fit horizontally even at 7 pt: the long words ("Construction", "academic", "Students", "Casualty") set each column's minimum width.

---

## 2. Requirements & User Stories

- **As the DRRM-H office**, I want the breakdown headers to read left to right on portrait pages, as large as they can be.
- Acceptance criteria:
  - [x] Headers horizontal, wrapping only between words (and after "/" in "Visitors/Patients").
  - [x] Pages stay portrait; the letterhead and every other table keep the template's margins.
  - [x] Only the breakdown tables widen, to 0.25 in from the paper's edges (about as close as office printers print).
  - [x] Headers 8 pt with UP Manila's 12 fields; numbers and unit names 10 pt.

---

## 3. Technical Design

- [src/app/(admin)/\_lib/nsed-docx.ts](<../../../src/app/(admin)/_lib/nsed-docx.ts>):
  - `breakdownLayout(table)` sizes each number column to its longest header word (at the header size) or its widest number (at 10 pt), using Arial Bold widths plus 2%, and gives the unit column the rest of 11,200 twips (A4's 11,920 less 360 on each side). It picks the largest header size of 8, 7.5 and 7 pt that leaves the unit column 1,400 twips; with more fields than fit, it stays at 7 pt and the table grows.
  - `breakdownTableXml` sets `w:tblInd` to −1,080 twips (the 1,440 left margin less 360). The template is in Word 2013+ compatibility mode, where the indent is measured to the table's border.
  - A zero-width space after "/" lets Word wrap "Visitors/Patients" there.
- No template or data change.

---

## 4. Verification

- [x] `npm run test`: UP Manila's 12 fields fit at 8 pt with the table exactly 11,200 twips and indented −1,080; no rotated text; 8 pt headers and 10 pt numbers; more fields fall back to 7 pt.
- [x] A sample report with all 12 fields passes the docx skill's OOXML validation.
- [x] `npm run lint`, `npm run type-check`, `npm run build`.
- [ ] Open a report in Word and print a breakdown page.
