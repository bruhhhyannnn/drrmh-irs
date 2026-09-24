# MATATAG interface redesign

- **Status:** In Progress
- **Target branch:** `feat/MATATAG`

## Goal

Redesign the complete MATATAG experience as a responsive digital inspection folio while preserving the existing checklist schema, scoring, permissions, save behavior, templates, and routes. The supplied physical form remains the source for institutional identity, bilingual hierarchy, section order, and print content.

## Implementation

- Apply one maroon, safety-green, paper-white visual language to the respondent form and MATATAG dashboard screens.
- Keep the respondent flow section-based with persistent progress, accessible answer controls, recovery and save feedback, and mobile-safe navigation.
- Improve assessment creation, management, response review, and template editing without changing server actions or stored documents.
- Keep printing as a readable A4 review report rather than a pixel replica of the paper form.
- Add no dependency, API, database, or migration work.

## Verification

- Run the MATATAG unit and action checks, ESLint, TypeScript, and the production build.
- Verify keyboard focus, error announcements, 44px touch targets, reduced motion, dark mode, and layouts at 375, 768, 1024, and 1440 pixels.
- Inspect the browser print preview for clipped content and stable A4 page breaks.
