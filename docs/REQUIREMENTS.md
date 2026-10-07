# St Andrews colony stock: requirements and decisions

Source: two photographed meeting notes and project discussion, 7 October 2026.
Working interpretations, not an approved institutional specification.

## Confirmed by the user
- Bats initially; allow future expansion to other animals.
- Everyone on the team can view and edit.
- PoB means Place of birth. Groups are research cohorts tracked over time.
- The sketched table supplies initial columns.
- Column headings/order and the data stored in columns should be configurable.

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
4. Permanent-record note: retained history, approval, or both.
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

## Next milestones
1. Review workflows/columns and settle open decisions with this prototype.
2. Agree university hosting, sign-in and membership.
3. Build shared database, authenticated editing, concurrency and permanent history.
4. Implement validated spreadsheet import using anonymised representative records.
5. Pilot and obtain institution-approved acceptance criteria.
