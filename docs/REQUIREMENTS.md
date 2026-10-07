# St Andrews colony stock: requirements and decisions

Source: two photographed meeting notes and project discussion, 7 October 2026.
Working interpretations, not an approved institutional specification.

## Confirmed by the user
- Bats initially; allow future expansion to other animals.
- Everyone on the team can view and edit.
- PoB means Place of birth. Groups are research cohorts tracked over time.
- The sketched table supplies initial columns.
- Column headings/order and the data stored in columns should be configurable.
- Permanent records mean an exact rolling five-year history of all bat data and changes.

## Clear meeting requirements
- Full shared animal database, replacing dependence on a large Excel file.
- Human-readable Excel export with preserved column order.
- Main register, rooms and cages; birth/death lists.
- Three daily lists, best reading: Birth, Death, Full.
- Previous-day records, version/record history.
- Favourites and functions for named groups.

Sketch columns: Sex, Animal ID, Room, Cage, Line, PoB, Parents, Age, Notes, Date of birth, Date of death.
The prototype adds species, derived status and parent references.
Age derives from known dates and stops at death. Unknown birth dates are supported.

## Open decisions
1. Exact bat species and lineage/genetics conventions. PoB confirmed as Place of birth.
2. ID format and how to represent estimated birth dates.
3. Research cohorts confirmed: create groups and track them over time. Membership history and member activity are implemented; further research measurements remain to be defined.
4. Confirm the institutional retention policy, disposal-date trigger and any longer retention periods. Permanent records are confirmed as rolling five-year exact history.
5. Daily reports: effective date versus entry date; cutoff and timezone.
6. University hosting/SSO, membership management, record volumes and concurrent staff.
7. Spreadsheet import mapping, duplicate resolution, reconciliation and retention.

## v0.1 acceptance scope
Browser-local private synthetic demo: register and filters, fixed rooms/cages,
add/edit records, favourites, research groups with membership history and saved daily counts, daily and complete reports,
XLSX/CSV exports and JSON backup. Configurable column labels/order/visibility
plus typed custom fields with editable record values.

Report semantics:
- Birth/death reports use the currently known effective date.
- Full report loads the last recorded snapshot on or before the selected UTC day.
- Full reports explicitly show saved state known then, rather than retrospective corrected truth.
- Dates before the first saved state show unavailable, not a false empty colony.
- Historic location/state is retained in snapshots.
- IDs unique and not renamed; parent references non-cyclic.
- Room/cage pairs must exist; death cannot precede known birth.
- Animal edits retain before/after, recorded timestamp and a demo actor.
- Column settings are shared only within this local demo store; custom values remain when hidden.

## Shared system plan
Use relational server storage: Animal (immutable internal key, separate displayed ID),
Location, AnimalEvent, Membership, Group, GroupMember, FieldDefinition and AnimalFieldValue.
Everybody with active membership can read/edit. Administrator membership/configuration
responsibilities remain to be agreed; no speculative restrictive researcher roles.
Store before/after, authenticated actor, effective date, recorded time and optimistic
concurrency version transactionally. Append corrective history rather than deleting edits.
Keep favourites per user; decide whether column layouts are per user or team-wide.
Index ID/location/event dates; server-side paginated search and streamed exports for scale.
University SSO, access checks, operational backups and history durability need real server infrastructure.
No live institutional data or credentials are included in the prototype.

## Permanent records and rolling five-year history

Confirmed requirement: retain an exact, traceable rolling five-year history of all bat data,
not only an animal's latest values or occasional stock totals. This is a shared-system
acceptance requirement; the browser-local prototype does not provide that guarantee.

The university's rolling reporting window and the legal retention deadline are separate.
Home Office ASPA guidance section 3.13.13 says source/use/disposal records for protected
animals must remain for at least five years after final disposal; section 3.13.15 gives the
same anchor for health records. Keep older records where that obligation or university
policy requires them. The policy/trigger applicable to this project is still to be confirmed.
[Home Office guidance](https://www.gov.uk/government/publications/the-operation-of-the-animals-scientific-procedures-act-1986/the-operation-of-the-animals-scientific-procedures-act-1986-aspa-accessible#31313-keeping-records)

The 2026 amendment sets out stock information including species/counts, origin, acquisition,
source, supply/rehoming and recipients, release, research projects, deaths and known causes.
Agree the mapping to this system with the university.
[2026 Regulations, regulation 11(c)](https://www.legislation.gov.uk/uksi/2026/663/pdfs/uksi_20260663_en.pdf)

Engineering design required by the user's exact-history requirement:
- Retain animal identity and every change to animal data, location, parent references,
  birth/death/disposition, research-group membership and research notes.
- Preserve field definitions, data types, dropdown choices and their versions. Renaming,
  hiding or retiring a column must not destroy past values or their original meaning.
- Record authenticated actor, before/after values, reason for a correction, effective
  event date, server-recorded UTC timestamp, stable record/event IDs and sequence/version.
- Corrections add new events; ordinary users cannot alter or delete earlier audit entries.
  Everyone may edit current data through an authenticated write path that appends history.
- Store current-state updates and their audit events atomically in shared server storage.
  Detect conflicting edits. Protect retained events using separate audit/storage permissions
  and independently preserved records for tamper detection.
- Allow date-range queries for the rolling five years and reconstruction/export for any
  retained day. Distinguish what was known then from later corrections to an event date.
- Preserve an opening baseline and any older dependencies needed to reconstruct the window;
  unchanged values and pedigree references must not vanish at the five-year boundary.
- Keep records for living animals. Track final disposal/date/reason separately from death.
  A cage move or cohort removal is not final disposal.
- No automatic age-based purge. Archiving removes records from active views while preserving
  their data/history. Any eventual disposal needs an approved institutional retention policy,
  expiry calculation, longer-retention/hold checks and a recorded authorised action.
- Provide retained exports for authorised inspection and investigation. Back up shared data,
  history and field definitions with encryption, restricted access and verified restoration.

Acceptance evidence before operational use:
1. Reconstruct complete animal and cohort state throughout a representative five-year dataset.
2. Verify late/backdated corrections preserve both original and corrected histories.
3. Verify renamed/hidden fields retain their historic values, types and meaning in exports.
4. Verify data older than the rolling view survives whenever retention/dependencies require it.
5. Verify ordinary editing cannot modify existing audit events or remove retained records.
6. Demonstrate recovery of records/history from backup, including event ordering and attribution.

## Next milestones
1. Review workflows/columns and settle open decisions with this prototype.
2. Agree university hosting, sign-in and membership.
3. Build shared database, authenticated editing, concurrency and protected history meeting the five-year retention acceptance criteria.
4. Implement validated spreadsheet import using anonymised representative records.
5. Pilot and obtain institution-approved acceptance criteria.
