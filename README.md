# Colony Stock — St Andrews project

Private v0.2 requirements prototype using synthetic data. Demonstrates colony workflows
before a decision to build a shared university application. About 170 bats is the expected
real starting volume; it is not a fixed limit or the synthetic sample size.

## Run

Node.js 20+; no dependencies.

    npm run dev

Open http://127.0.0.1:4173 in a modern browser with Web Locks support.

    npm test

## Prototype features

Register/dashboard with a compact quick view, direct Open/Edit actions and clearly separated animal forms; arrivals/departures, births/deaths;
Death/departure edits create durable pending approvals with before/after dates. The queue survives
refreshes and filters; staff can open, edit, undo, approve individually or approve all with a review.
Approval and reversal record the user and time in history. Undo restores only the affected life-event
fields, keeping later notes and housing changes. Unapproved dates remain correctable across days;
new backdated events and corrections to approved prior-day events remain blocked. Pending edits
already affect live stock and reports; saved daily reports remain frozen.

Optional cages and communal rooms; housing lists and reviewed cage moves. Parent references
prevent cycles; selectable pedigree shows four ancestor generations and direct children.

Research cohorts with membership history and dated individual/cohort entries. Starter categories
include Behaviour, Surgery, Harvest, Swab sampling and Wing punch. Administrators configure typed
animal/research fields, allowed choices, requiredness, labels, order/visibility and sex choices.
Captured research entries keep their field definitions and membership as recorded.

Daily reports default to Live today: stock, births and deaths update immediately after an animal save. Saved report shows the captured values separately. Daily records contain current stock, births and deaths. Same-day manual saves replace the set;
prior days are immutable. Source is Manual/Automatic, and animal changes since the last manual
capture are indicated. Each set retains readable CSV content; download a ZIP containing
stock.csv, births.csv, deaths.csv and capture metadata. Daily CSV archives include hidden fields
so display choices cannot remove retained values. Individual CSV/Excel exports remain available.

Student, Researcher and Administrator previews demonstrate restrictions. Students are read-only;
administrators configure fields/locations and can recover an animal baseline from a saved day.
Recovery previews changes, appends history, preserves daily/research records, groups and schema,
and archives later animal IDs. It is not a full database restore.

History has keyword, animal, activity, user and inclusive date filters, newest/oldest sorting, pagination and expandable before/after tables. Embedded section help, extensive-change confirmations, favourites and JSON backup download.

In Administrator preview, Rooms & cages supports reviewed removal of empty rooms and
cages. Occupied locations must be cleared first. Historical animal locations and saved
daily reports are retained, and removals appear in the changes log.

Lists and tables use a shared white/grey row palette, visible keyboard focus, larger targets
and text sizes based on browser settings. Scrollable tables have named keyboard-focusable
regions, sticky headings and animal IDs. Action columns scroll on narrow screens, notes wrap,
and reduced-motion/Windows forced-colour preferences are respected.

## Daily timing and storage

UTC is provisional. Same-day records are replaceable until day end; approved prior-day event corrections
are not supported. Unapproved death/departure changes can still be corrected or undone. An arriving adult can have an older birth date as background information.
Automatic fallback preserves a manual set: staff must resave for later changes to be included.
Live operational data continues independently of the saved reports.

Automatic fallback can be disabled by an Administrator. It checks while open and can save
yesterday on reopening after tracking starts. A closed browser cannot guarantee midnight saving
or catch up an arbitrary downtime period. Production needs a reliable server scheduler.

All operational data and saved CSV content live in localStorage for this browser origin.
Download CSV packages and JSON backups to create separate copies. This is not protected university
storage; different origins/profiles/computers do not share data. Web Locks serialize same-origin
writes; stale-state checks prevent silent overwrites and leave conflicting forms open. Copy
entered work before reloading to reconcile. Storage failures are visible and preserve prior data.

## Production still required

Role switching is a demonstration, not authentication. Browser history/localStorage do not
guarantee protected five-year retention. Shared SQL storage, university sign-in, real permissions,
server concurrency, scheduling, protected exports, encrypted independent backups, monitoring and
tested full restoration need server infrastructure.

Full JSON restore, spreadsheet import and multiple databases are deferred. The production stack
and hosting remain provisional until prototype success. CSV is the required reporting format
identified by the user; the institution must confirm contents and retention obligations.

Download a backup before clearing browser data. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
for decisions, open details and acceptance criteria. This is independently prepared, not an
official university website.
