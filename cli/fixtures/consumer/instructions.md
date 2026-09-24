# Harbourside Library catalogue

This repository holds the catalogue and room-booking service for Harbourside Library: the public
search pages, the staff cataloguing screens, and the booking system for the meeting and study rooms
at the library's three branches. It is maintained by a small team of three developers and a systems
librarian, who work closely with the cataloguers and the front-desk staff at each branch.

## Working in this repository

- The application is split into four areas under `src/`: `src/catalogue/` for bibliographic records
  and copies, `src/loans/` for loans and holds, `src/rooms/` for room bookings, and `src/web/` for
  the public and staff pages.
- Helpers used by more than one area, such as date handling, opening hours and patron lookups, live
  in `src/common/`, and nothing in `src/common/` may import from the four areas above it.
- Every script a developer needs is in `bin/`, and each one prints its usage when given `--help`, so
  check that before guessing at a flag or reading the script itself.
- Schema migrations live in `migrations/` and are numbered in sequence. Never edit a migration that
  has already been merged; write a new one that corrects it instead.
- Configuration that library staff change, such as opening hours, closure days and room capacities,
  lives in `config/` and needs a review from the systems librarian as well as from a developer.
- Test data lives in `tests/fixtures/` and is entirely invented. Never copy a real patron's name,
  address, library card barcode or borrowing history into a fixture, a test or a log line.
- Work on a short-lived branch and open a pull request for every change. The main branch deploys to
  the staging server automatically, and nobody pushes to it directly.

## Build and test

```sh
./bin/setup
./bin/seed --sample
./bin/serve --port 8080
# Before opening a pull request
./bin/format
./bin/lint
./bin/test unit
./bin/test integration
```

The first command installs dependencies and creates a local database, the second fills that database
with the invented catalogue, patrons and rooms from `tests/fixtures/`, and the third starts the
development server. The unit suite needs no database and finishes in under a minute. The integration
suite starts its own throwaway database and takes about four minutes, so run it whenever you touch
`src/loans/`, `src/rooms/` or `migrations/`, where the hold queue and the booking checks have broken
before. CI runs the lint and both suites on every pull request, and it fails any change whose
formatting differs from what `./bin/format` would produce. If a test fails only some of the time, do
not rerun it until it passes: every randomised test prints its seed when it fails, so open an issue
with that seed and the output.

## Catalogue records

A bibliographic record describes one edition of a work, and every physical copy the library owns
belongs to exactly one record. The cataloguers own what these records say. Code may validate and
normalise what they enter, but it never rewrites a field without telling them. Every record carries
one of five status codes, and only `active` records appear in the public search.

| Status | What it means | Public search |
| --- | --- | --- |
| `draft` | Created by a cataloguer and not yet checked by a second person. | Hidden |
| `active` | Checked and complete, so its copies can be lent and held. | Shown |
| `suppressed` | Taken out of public view while a cataloguer corrects it, usually for a day or two. | Hidden |
| `merged` | Folded into another record as a duplicate, with a pointer to the record that replaced it. | Hidden |
| `withdrawn` | Every copy has left the collection, but the record stays for loan history and statistics. | Hidden |

Change a status only through `setRecordStatus` in `src/catalogue/status/`, which checks that the
change is allowed and writes a line to the record's history. A `withdrawn` record never returns to
`active`, and a `merged` record does so only when its merge is undone.

### Identifiers

Every bibliographic record has an internal identifier made of `bib-` and eight digits, such as
`bib-00412733`, assigned by the database when the record is first saved. It never changes and is
never reused, even after the record is merged or withdrawn, because loan history, reading lists and
staff notes all refer to it. Public pages address a record by this identifier and never by its
title, so that correcting a title does not break a patron's bookmark.

Each copy has a fourteen-digit barcode on a label inside the back cover. The first two digits name
the branch that owns the copy, which is `01` for Central, `02` for Quayside and `03` for Hillside,
and the last digit is a check digit. Validate that check digit with `isValidBarcode` from
`src/catalogue/barcodes/` before any lookup, and answer a barcode that fails it by asking staff to
scan again, since a mistyped barcode can otherwise lead to the wrong copy.

Standard book numbers are kept in the `isbn` field in their thirteen-digit form, and `normaliseIsbn`
converts ten-digit numbers and strips the hyphens on the way in.
**Never treat that field as unique.** Reprints and different bindings sometimes carry the same
number, and much of the local history collection has no number at all.

### Holdings and copies

A holding groups the copies of one record at one branch, together with their shelf mark and the
collection they sit in, such as adult fiction, children's non-fiction or local history. A copy
belongs to exactly one holding at a time. Moving a copy to another branch permanently means moving
it into that branch's holding with `moveCopy`, which keeps its barcode and loan history, while a
copy that only visits another branch to meet a hold stays in its home holding throughout.

Each copy has exactly one of the following statuses at any moment, and only the code in
`src/catalogue/copies/` sets them.

- An `available` copy is on the shelf and can be lent or used to fill a hold.
- An `on-loan` copy is with a patron, and its loan record says when it is due back.
- A `hold-shelf` copy is waiting at a pickup desk for the patron who asked for it.
- An `in-transit` copy is travelling between branches in the delivery van.
- A `missing` copy was not found at its shelf mark, and stays missing until someone scans it again.
- A `withdrawn` copy has left the collection for good, and its row is kept rather than deleted.

The number of available copies on a public record page is counted from these statuses each time the
page is built, and it is never stored. We stored it once — within a month it no longer agreed with
the copies it described. Never delete a copy row, even one entered by mistake: set it to `withdrawn`
with a reason, so that the loan history pointing at it stays whole.

### Merging duplicate records

Duplicate records come from three places: two branches cataloguing the same edition within a few
days of each other, quick records made at the front desk for a copy that had no record yet, and the
load from the previous catalogue system, which brought in about two thousand pairs that the
cataloguers are still working through. The `./bin/duplicates report` command lists candidate pairs
with a similarity score built from the title, the first author, the year and the standard book
number where there is one. **The score only proposes, and a cataloguer decides.** Never merge
records from a script, a migration or a background job, however high the score, because two editions
of one work can look identical to the comparison and differ only in their contents.

When a cataloguer merges two records in the staff screens, `mergeRecords` in `src/catalogue/merge/`
makes all of these changes in a single database write, so that a failure part of the way through
leaves both records exactly as they were.

- The surviving record keeps its identifier, and the other is set to `merged` with a pointer to the
  survivor.
- Copies, holdings and reading-list entries move to the survivor, and copies at the same branch are
  combined into one holding.
- Holds on both records join one queue, sorted by the date each hold was requested, so that no
  patron loses their place.
- A line naming the cataloguer and the reason they gave is added to the history of both records.

A merge can be undone for thirty days with `./bin/duplicates unmerge`, which restores the second
record and moves back the copies and holds it brought with it. After thirty days the history can
still be read, but undoing a merge becomes a manual job that only the cataloguing lead carries out.

## Room bookings

The booking code lives in `src/rooms/`, and every booking goes through `createBooking`, whether a
patron makes it on the public pages or staff make it at a desk. Double bookings are prevented by a
constraint in the database on the room and the booked time range, and not only by the check in the
booking form: two desks once booked the same room within the same second, and the form check alone
let both through. **Never remove or weaken that constraint.** When it rejects a booking, catch the
error in `createBooking` and show the patron the next three free slots in that room instead of an
error page.

Opening hours come from `config/opening-hours.json`, with one entry for each branch and weekday and
a separate list of closure days. A booking must start no earlier than opening time and end at least
fifteen minutes before closing, so that staff can clear the room. Adding a closure day cancels every
booking that falls on it and tells each patron why, so a pull request that adds one must say how
many bookings it cancels. Booking times are stored in UTC and shown in local time, so test any
change here against the two weeks of the year when the clocks change.

The six quiet study rooms at the Central branch are in steady demand, above all during exam season,
and these rules keep them fair to everyone who wants one.

- A patron may have at most one quiet study room booking on any day, and a booking lasts two hours
  at most.
- Quiet study rooms can be booked up to seven days ahead and no further, so that regular visitors
  cannot take every slot.
- A booking with no check-in at the desk within fifteen minutes of its start is released, and the
  room shows as free again.
- Each quiet study room seats one person, so a booking for a group is turned away with a suggestion
  to use a meeting room.

## Loans and holds

The loans code lives in `src/loans/`. A due date is the loan period of the copy's loan category
counted from the day of checkout, moved forward to the next day the owning branch is open if it
would fall on a closed day. A patron may renew a loan twice, unless another patron is waiting for
the same record, in which case the renewal is refused with a message saying why. A hold is made on a
record rather than on a copy, so any copy of that edition can meet it, and each time a copy is
checked in, the next hold is filled in these steps.

1. When a copy is checked in at any branch, `fillNextHold` in `src/loans/holds/` looks for the
   oldest active hold on the copy's record.
2. Holds that the patron has paused, for example while they are away, are passed over but keep their
   place in the queue.
3. The copy is attached to the chosen hold so that no other hold can take it, and it becomes
   `hold-shelf` if it is already at the pickup branch or `in-transit` if it is not.
4. The patron is notified by their chosen method only once the copy has been scanned at the pickup
   branch, because a copy in transit can still go missing.
5. The same scan sets the pickup deadline to seven opening days later, and the copy waits on the
   hold shelf until then.
6. If the patron collects the copy before the deadline, the hold is closed and a loan is created in
   the same database write.
7. If the deadline passes, the hold expires, the patron is told, and the copy goes back to the first
   step for the next hold in the queue.

## Accessibility

Many patrons use the public pages with a screen reader or a screen magnifier, and much of the work
at the front desk is done from the keyboard alone, so accessibility is part of whether a change is
finished and never a later pass. Run `./bin/test pages` before asking for review on any change under
`src/web/`, because it checks every public and staff page for missing labels, low contrast and focus
that gets stuck.

- Every form field has a visible label, and every error message names the field it concerns and says
  how to put it right.
- Every action works from the keyboard alone and shows a clear focus outline, including the booking
  calendar and the date pickers.
- Text keeps a contrast ratio of at least 4.5 to 1, and colour is never the only sign of a state,
  such as a room being free or a copy being missing.
- Dates on the public pages are written in words, such as Tuesday 14 October, because numeric dates
  are read aloud awkwardly and mean different days to visitors from different countries.

## Releases

Releases go out on Tuesday and Thursday mornings before the branches open, and never on a Friday or
the day before a closure — the team wants to be at work when the front desks first use a change. Run
`./bin/release` from an up-to-date main branch; it builds the application, runs any new migrations
and then moves the live site to the new build. When a release changes a screen that front-desk staff
use, post a short note on the staff news page, written in their words rather than ours.

### Rolling back

Roll back with `./bin/release rollback`, which puts the previous build back in front of patrons
without touching the database. That is safe because a migration may only add tables and columns in
the release that needs them. A rename or a removal waits for a later release, once no running build
reads the old name, so the previous build always works against the newer schema.

Rolling back the code does not undo bad data. If a release has written wrong due dates, cancelled
bookings it should have kept or damaged catalogue records, stop and tell the systems librarian
before doing anything else. Then correct the data with a one-off script under
`scripts/corrections/`, reviewed like any other change, and never edit patron, loan or booking rows
by hand in the live database.

## Style

- Use the library's own words in code and in messages: patron, copy, holding, hold, loan and shelf
  mark. Avoid synonyms such as user, item or reservation, because the cataloguers read our error
  messages and some of our reviews.
- Keep each function to a single job, and split it when you find you need a comment to explain the
  steps inside it.
- Store every instant in UTC and convert to a branch's local time only at the edge, with the helpers
  in `src/common/time/`, and never compare dates as formatted strings.
- Raise a specific error from the area it concerns, such as `HoldNotFound` or `RoomUnavailable`, and
  never catch an error only to ignore it.
- Write messages for patrons in plain language that says what happened and what they can do next,
  and keep the technical detail for the log.
- A log line may carry a patron's internal identifier, but never their name, their address or
  anything they have borrowed.
- Name tests after the behaviour they check, such as "a paused hold keeps its place", rather than
  after the function they call.
- Put tests beside the code they cover, in a file named after it, so that a change and its tests
  arrive in review together.
- Leave formatting to `./bin/format`, and do not comment on formatting in review, since the
  formatter has already decided it.
- Add a dependency only with a note in the pull request saying what it does, why the standard
  library is not enough and who will keep it up to date.
