# Colony Stock — St Andrews project

Private v0.1 requirements prototype with synthetic data. Bats first; a species field
supports other animals in future. Everyone on the future team will be able to view and edit.

## Run
Node.js 20+; no dependencies.

    npm run dev

Open http://127.0.0.1:4173. Run domain/export tests with npm test.

## Working features
Dashboard; search and room/cage/sex/line/status filters; editable animal records;
birth and death dates with correction history; parent references with cycle prevention;
favourites; research cohorts with editable membership, daily counts and history; complete birth/death lists and daily saved-state reports;
before/after history; Excel (.xlsx) and CSV export; JSON backup download.
Rename, reorder and hide columns, or add typed text/number/date/dropdown fields.
Each custom field has editable values on the animal form. Exports follow visible column order.

## Persistence and reporting
Data is in localStorage per browser origin, not shared between users or localhost and the Site.
The demo actor is not institutional identity. Browser history is not a permanent audit trail.
The confirmed shared-system requirement is an exact rolling five-year history of all bat data.
This prototype does not guarantee five-year retention. See the requirements brief for retention
triggers, protected history, field-definition versions, archival rules and restoration checks.
Saving fails visibly if storage is unavailable/full; stale tabs cannot overwrite newer data.
Full stock shows what was saved by the selected UTC day. Birth/death reports use currently
known event dates, including backdated corrections. Earlier unrecorded snapshots are unavailable.
XLSX values are text for human-readable output; numeric/date Excel formatting is future work.
Locations are fixed demo configuration. Estimated-date precision and actual imports are pending.
JSON restore, permanent audit storage, concurrent shared editing, university SSO and team
membership are not implemented. Download a backup before clearing browser data.

See docs/REQUIREMENTS.md for decisions and the path to a shared university application.
This is an independently prepared prototype, not an official university website.
