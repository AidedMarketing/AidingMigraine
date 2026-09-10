# Complete interface redesign — 5.9.0 draft 1

This builds on the deployed attack-first foundation in PR #107. The goal is a cohesive, finished app whose simplest interaction remains saving an attack's start time.

## Design direction

A quiet personal journal: warm charcoal, restrained green accents, generous touch controls, clear typography, flat surfaces, and no decorative movement in the tracking flow. Warm light and high contrast are complete alternatives, with the same chosen theme carried into Help. Shared colors live in `assets/tokens.css`; the responsive app layout is in `assets/shell.css`.

## Screens and interactions

- **Today:** consistent brand header, clear date, a focused start surface, and an active-attack card with duration, pain, medication, and end controls. Extra details remain optional to open.
- **History:** a chronological journal of compact entries with date, time, duration, and pain. Open a record to review its details, edit it, or move it to recently deleted. An empty journal offers a clear route back to Today.
- **Insights:** date-range metrics followed by Overview, Symptoms, Treatment, and Weather categories. Only one category is visible at a time. Empty categories explain what information is missing. Charts resize when revealed; numeric data renders before the optional chart library finishes loading.
- **Doctor visit:** report exports are the main action. Impact questionnaires and optional cycle context have a consistent supporting layout.
- **Settings:** expandable groups for appearance, backup/export, reminders, optional weather/cycle context, privacy/screen comfort, record management, help, and reset. Existing control IDs and data behavior are preserved.
- **Dialogs:** centered panels on larger screens and bottom sheets on phones. The body scrolls separately from the title and action area. Existing keyboard focus management remains in place.
- **Help:** shared themes, simpler headings, and a rewritten getting-started guide reflecting the current navigation.

## Implementation boundaries

This changes presentation and navigation, not the database schema, encryption format, or record/export contracts. Completion still requires a pain score if one was never entered. Existing settings and reports remain available. The first-draft core persistence fixes and tests remain unchanged.

New small scripts handle early theme selection and insight presentation state. All new scripts and styles are included in the service worker shell cache. iOS bottom navigation uses left/right centering without a transform, preserving the purpose of the earlier viewport-drift fix.

## Verification

- JavaScript syntax and combined classic-script scope checks passed.
- All 13 Node regression checks passed, including the original ten tracking/persistence cases plus journal rendering/escaping, insight category visibility, and stored-theme behavior.
- Static HTML nesting, unique IDs, preservation of every prior application ID, local asset paths, and accessible switch names checked.
- Numeric contrast checks on primary text, secondary text, and primary button text for Warm dark and Warm light exceeded 4.5:1. These selected checks are not a claim of a complete accessibility audit.
- PWA and security validators passed their error gates. Legacy warnings remain for inline handlers, dynamic HTML assignments, and console statements.

No real-browser, visual, screen-reader, or iPhone testing was performed in this environment. Review the draft on small screens, with a long history, with 200% text, across all themes, and with the keyboard open before releasing. No live deployment is included in this change.
