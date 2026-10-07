# Colony Stock: requirements and decisions

Updated 7 October 2026 from photographed meeting notes and project discussion.
This is a prototype specification, not an approved institutional or legal specification.

## Purpose and scope

Create a shared colony register that replaces operational dependence on Excel.
Start with bats and approximately 170 current animals; this is a starting volume, not a
fixed limit. Demonstrate workflows using synthetic data before production proceeds.
Daily stock staff and researchers work concurrently on the same records, using daily
reporting, individual/group history, housing, pedigree and research views.

Multiple databases and CSV import are deferred. Future compatibility can be added later.
A future import must validate data and cannot reconstruct unavailable history.
University resources and the final production stack remain unknown. Production proceeds
only after a successful prototype review.

## Daily records: final agreed rules

Each reporting date has one current saved set of three tables:
1. Current stock (living animals present in the colony).
2. Births with an effective event date on that date only.
3. Deaths with an effective event date on that date only.

- Saving does not close the day or prevent continued animal/research editing.
- During the same reporting day, another manual save replaces that date's previous set.
- Generate all three tables and their CSV copies from one consistent database state.
- At day end the saved set becomes final. Closed sets cannot be overwritten. Late or
  backdated corrections are not allowed.
- Retain underlying edit history and the attribution/content of same-day replacements.
- If no manual set exists, automatic generation runs around midnight, captures recorded
  changes and is clearly labelled Automatic. Carry unchanged stock forward only when
  no changes occurred.
- If a manual set exists at cutoff, freeze its latest version. Automatic fallback does
  not replace it. Later live changes are absent from that set unless staff save again;
  show a visible changes-since-save signal.
- Each set identifies date, capture time, actor/source and version.
- Administrators can disable automatic generation for a manual-only workflow.
- Missing daily records show unavailable, not a falsely empty colony.
- Live operational data continues into the next day independently. Opening/saving a
  report never resets the database to an earlier manual snapshot.
- Support arrivals and departures separately from births and deaths.

UTC is a provisional prototype convention. Production cutoff/timezone and missed-job
policy require agreement. Production must use reliable server time and a scheduler.
The local demo checks while open and can check yesterday on reopening after tracking
starts. A closed browser cannot guarantee midnight execution or arbitrary downtime catch-up.
A new arriving adult may have an older birth date as background information; this does
not create retrospective daily records. Earlier recorded event dates cannot be corrected.

## Identity, configurable fields and uncertainty

Animal ID is required and unique across all retained records, including deceased,
departed and archived animals. Preserve stable identity and structural relationships.
Researchers should design as much of their dataset as possible through designated
researcher administrators: labels, order, visibility, typed custom fields, allowed
choices, requiredness and explicit uncertainty conventions.

Starter sketch fields: Sex, Animal ID, Room, Cage, Line, Place of birth (PoB), Parents,
Age, Notes, Date of birth and Date of death. Species, arrivals/departures and status
support the register. Age derives from known dates and stops at death.
Sex begins with Female, Male and Unknown; choices are configurable. Estimated dates,
uncertain parentage and genetics conventions remain to be agreed/configured.

Renaming, hiding or retiring a field must preserve old values and meaning. Retain field
versions, types, labels and choices. Prototype types are chosen when a field is created;
labels, visibility, order, requiredness and dropdown choices can then be adjusted. Existing
values must remain valid; changing a type requires a new field in this iteration.
Saved daily sets and research entries retain their captured field definitions.

## Research and history

- Daily users need complete readable daily tables. Researchers need individual, cohort,
  group and lineage history with date-based access and relevant record operations.
- Groups are changing research cohorts, with membership tracked over time.
- Record dated research entries/observations for one animal or selected cohort members.
  Preserve the animals concerned, author, recorded time and field definitions.
- Lab-supplied examples: Behaviour, Surgery, Harvest, Swab sampling and Wing punch.
  These are configurable starter categories, not an agreed measurement schema or
  procedure instructions. Researchers define fields for what they collect.
- Research categories do not automatically change stock. Births, deaths, arrivals and
  departures are recorded through animal records.
- Preserve cohort membership as known when a research entry was saved; later membership
  changes must not rewrite previous entries. Provide date/animal/cohort/category filters.
- Today's research entries can be revised with before/after history; past entries are final.
- Retain individual activity, group membership and field definition history.

## Rooms, cages and pedigree

A housed bat has a room; a cage is optional. Communal accommodation without cages is valid.
Cages are identifiable containers with room locations and occupant lists. Find a bat,
list all room occupants including uncaged bats, locate a cage and list its occupants.
Support individual movements and moving an occupied cage with its current occupants
consistently; preserve movement history. Identifier conventions and occupancy rules
remain to be agreed.

Track parent-child relationships, retain deceased/departed relatives and prevent cycles.
Provide ancestor/descendant navigation and a selectable visual family tree. The prototype
shows up to four ancestor generations and direct children, with navigation to relatives.
Unknown parentage is explicit. Pedigree means parentage; lineage is a researcher-defined
line/convention; a cohort has changing membership. Agree uncertainty and lineage conventions.

## Roles, concurrency and bulk changes

Proposed roles:
- Student: a safer limited workflow. Read-only prototype access demonstrates restrictions;
  actual entry/review permissions require agreement with the lab.
- Researcher: edit current permitted animal records and record research entries.
- Administrator: additionally configure fields, locations and authorised recovery.

Administrator assignment, membership management and ownership remain undecided. Local role
switching demonstrates permissions; it does not provide authentication or real access security.

Prevent silent overwrites through version checks and visible stale-state errors. Preserve
entered work for reconciliation. Commit related records and audit entries atomically,
including cage moves. Coordinate snapshot requests so older captures cannot replace newer
ones. Prototype same-origin tabs use Web Locks plus stale-data checks; this is not shared
server concurrency. Conflicting forms remain open and can be copied before reloading.

Show a review confirmation for extensive animal edits (five or more changed fields),
membership changes, multiple definition changes, cage moves and recovery. A popup alone
is not sufficient protection against data loss.

## Database, CSV exports and secure storage

Use a proper shared server database for operational data, relationships, configuration and
history. SQL, provisionally PostgreSQL, is the proposed production starting point.
CSV/Excel are export formats rather than the operational database.
The user identifies CSV as the required legal export format; the institution must confirm
exact contents, retention and inspection requirements before operational acceptance.

Whenever a daily set is saved, retain readable stock.csv, births.csv and deaths.csv.
CSV cannot contain sheets; use three named tables in a dated package. Use readable headings,
stable order, clear dates and values. Archive all configured animal fields, including those
hidden in the current display, so hiding a column cannot discard retained data. Preserve
captured definitions/headers when fields later change. Excel export remains available.

Same-day replacement updates the current CSV set and retains replacement history.
Export/storage failures must be visible and retried. Do not claim files are stored until
storage succeeds. Protect exports as carefully as the source database.

Production needs authenticated access, encrypted connections, restricted storage permissions,
protected history and encrypted independent backups. Monitor failed writes, exports,
scheduled records and backups, with a named receiving-team contact.
CSV copies supplement full backups; they cannot restore all relationships, configuration
and history. The prototype stores CSV content in browser localStorage alongside its daily
records and downloads a ZIP on request; it does not write protected university files.

## Exact history, retention and recovery

Retain an exact, traceable rolling five-year view of animal data and changes. This is a
shared-system acceptance requirement, not a guarantee of browser storage.
Preserve changes to housing, parentage, births/deaths/disposition, research, membership and
field definitions. Record before/after values, actor, timestamp, effective date and stable
identity/version. Current writes and history must commit together. Ordinary users must not
modify previous audit entries or closed daily tables.

Recovery previews a selected previous state and restores permitted current data through a
traceable operation. Reverting animal data must append recovery history, preserving closed
daily records. Full database disaster recovery is a separate backup/restore procedure.
Prototype recovery restores animal values from a saved daily baseline, preserves newer custom
field values where absent in that baseline, and archives later animals instead of deleting
identities. It preserves research entries, groups, field definitions, daily reports and history;
it is not a full database restore. Review dates/events after recovery before further recording.

Preserve living animals and older pedigree/reconstruction dependencies. Distinguish departure
or final disposition from death, cage movement and cohort removal. Archive without destroying
data. No automatic purge at five years. Agree institutional retention, holds, expiry/disposal
rules and responsible authorised owner. Verify full restoration, event ordering and attribution.

References for institutional review, not a confirmed applicability assessment:
[Home Office record guidance](https://www.gov.uk/government/publications/the-operation-of-the-animals-scientific-procedures-act-1986/the-operation-of-the-animals-scientific-procedures-act-1986-aspa-accessible#31313-keeping-records)
and [2026 Regulations](https://www.legislation.gov.uk/uksi/2026/663/pdfs/uksi_20260663_en.pdf).
The university must confirm applicable requirements and retention triggers.

## Handover and production architecture

Expect minimal continued cooperation after delivery. Include section help windows, field
explanations, tooltips and actionable errors covering daily saves/locking, automatic labels,
exports, housing, research, pedigree, configuration, roles and recovery. Supply user/admin
and hosting/backup/restore/maintenance documentation. Assign a receiving-team owner.

The proposed production structure is browser client, application server and PostgreSQL.
TypeScript/React and Node.js are possible stack choices, not commitments. Shared writes,
permissions, history, scheduling and exports belong on the server. After prototype success,
confirm university hosting/database services, sign-in, protected storage, backups, monitoring,
timezone and operational ownership before choosing the final stack.

## Prototype limitations and operational acceptance

The browser-local prototype does not supply institutional identity/security, protected
five-year history, shared SQL storage, reliable unattended scheduling, university export
storage, independent backups or full disaster recovery. JSON backup download is supported;
full JSON restoration and validated spreadsheet import remain future work.

Before operational use:
1. Demonstrate a working day including births, deaths, arrivals, departures and movements;
   verify table consistency, same-day replacement, day-end immutability and no event-date leakage.
2. Verify manual/automatic labels, manual precedence, disabled scheduling and outage handling.
3. Demonstrate concurrent edits/saves without silent overwrites or partially applied changes.
4. Reconstruct representative five-year animal/group history, including retired fields,
   departed animals and older pedigree dependencies.
5. Verify real permissions and protection against altering/deleting retained history.
6. Retrieve historical daily CSV tables and detect/recover export failures.
7. Demonstrate controlled recovery and full backup restoration preserving identity,
   configuration, history, daily sets and exports.
8. Have a new team member complete workflows using embedded help and the receiving team
   demonstrate recovery using the supplied handover instructions.