# Rebasing and Stripping

Reference material for the `repeat-project` skill. Load when deciding what survives a
rebuild, or when the date arithmetic needs to be right rather than approximate.

## The job and the instance

Every finished project is a general job wearing the details of one particular run. The
rebuild keeps the first and discards the second.

| Carry over | Leave behind |
| --- | --- |
| Task names, with the new job's details swapped in | The previous client, site, product or campaign |
| Descriptions, with the same swap applied | Dates written into titles — "Q3", "v2", "Oct" |
| The order tasks happened in | Statuses, close dates, time tracked |
| The gaps between dates | Assignees |
| Dependencies between copied tasks | Comments, attachments, watchers |
| Steps that recur every time | One-off corrections and chases |

The test for a title is whether it names the job and the *current* instance, with nothing
left over from the last one. "Send Henderson the kickoff deck" fails when Henderson was
last year's client — but the repair is "Send Okonkwo the kickoff deck", not "Send kickoff
deck". A generic title is right for a template and wrong for a live project, where
whoever opens the task should be able to see whose job it is without checking the list
name.

"Fix the broken invoice export" fails a different way — it was a repair, not a step, so
it doesn't carry over at all.

Descriptions hide instance detail more often than titles do, because nobody edits them.
Strip them with the same rule, and check for the previous client's name specifically —
it surviving into a new project is the most embarrassing possible failure of this skill.

## Reading the last run's outcome

Status names are chosen per workspace and mean nothing portable. Every status carries a
`type`, and only four exist:

| Type | Meaning |
| --- | --- |
| `open` | Not started |
| `custom` | Any middle state the workspace invented |
| `done` | Reads as finished, but does **not** set a close date |
| `closed` | Finished, and sets `date_closed` |

`clickup_get_list` returns the configured statuses with their types, so one call tells
you how that particular workspace expresses "finished" without you guessing at labels.

This matters for one judgement: which tasks the last run actually completed. When most
of a list ended in `done` or `closed` and a handful are still `open`, that handful is
worth flagging. Some of them are steps that got skipped and should be dropped. Some are
steps that get skipped every time and are exactly why the job goes wrong. You cannot
tell which from the data, so put them in the preview as questions rather than acting.

Never write a rule that keys off a label like "complete", "Done" or "Shipped". Two lists
in one space can use the same word for different types.

## Date arithmetic

### Read as milliseconds, write as dates

Due dates come back from the API as epoch milliseconds in a string — `"1782288000000"`.
`clickup_create_task` accepts only `YYYY-MM-DD` or `YYYY-MM-DD HH:MM`. Passing the raw
value through is the single most likely way to break this skill.

Convert with care about timezone. Epoch milliseconds are absolute; the calendar date
they fall on depends on the zone you resolve them in, and a date near midnight can move
by a day between UTC and the user's local zone. ClickUp's date fields are interpreted in
the user's timezone, so resolve consistently and don't mix.

### Work in offsets, not positions

Find the earliest due date in the source and treat it as day 0. Express every other task
as a whole number of days after it.

> Source: survey 12 Mar, order materials 14 Mar, install 28 Mar, snag list 30 Mar,
> invoice 4 Apr
>
> Offsets: 0, 2, 16, 18, 23

Those offsets are the shape of the job. The fourteen-day jump between offset 2 and
offset 16 is materials lead time — a real constraint someone learned the hard way. A
rebuild that puts the five tasks on five consecutive days has thrown away the most
valuable thing in the source.

### Anchoring forward

Default. The new job starts today; add each offset to today's date.

> Anchor 6 May → 6 May, 8 May, 22 May, 24 May, 29 May

State the anchor in the preview as an assumption, not a question. "Anchored to today"
invites a one-line correction; "when does it start?" asked before the user has seen
anything invites a shrug.

The exception is a job that builds toward a fixed outside event — a show, a conference,
a deadline. There, today is not a plausible anchor and every date will be wrong. Show the
dated plan anyway, but say plainly that the spacing is right and the anchor is a
placeholder, then ask for the one date that fixes everything.

### Anchoring backward

Used when the user names a delivery date. Take the largest offset as the span, subtract
it from the target, and that gives day 0. Then apply offsets forward as normal.

> "It has to be done by 14 November." Largest offset is 23, so day 0 is 22 October →
> 22 Oct, 24 Oct, 7 Nov, 9 Nov, 14 Nov.

Check the result: if day 0 lands in the past, the job cannot fit in the time available.
Say so plainly with the shortfall in days rather than silently compressing the schedule.
Compressing is a scheduling decision the user must make, not one to make for them.

### Tasks with no date

Leave them undated. Do not spread them evenly across the span to make the list look
finished. A date is read as a commitment someone made, and inventing one is worse than
leaving the field blank.

If the source has no dates anywhere, skip this section entirely, rebuild the order, and
say in one line that there were no dates to shift.

### Working days

Offsets in calendar days will sometimes land work on a weekend. Mention it in the
preview when it happens rather than silently shifting — for some jobs a Saturday
install is normal, and you have no way to know which kind you are looking at.

## Remapping dependencies

The source's dependency graph refers to source task IDs. Those IDs still exist and still
resolve, which is exactly why this fails quietly.

Build the map as you create:

```
old 86bbjf87g  →  new 86bbk21aa
old 86bbjf88g  →  new 86bbk21bb
old 86bbjf89g  →  new 86bbk21cc
```

Then translate both ends of every link before writing it. A dependency where one end is
missing from the map points at a task outside the new list — drop it rather than wiring
it, and say how many you dropped.

Verify by reading one new task back with `include: ["dependencies"]` and checking the
ID it references appears in the right-hand column of your map. A dependency count alone
proves nothing; a link to the old project counts just the same.

## Worked example

**Request:** "Set up the Okonkwo fit-out the same way we did Ellis Street."

**Source:** *Ellis Street bathroom fit-out*, eleven tasks, all closed, dates spanning
12 March to 4 April.

**Preview shown to the user:**

> **Okonkwo fit-out** — new list in *Projects*, rebuilt from Ellis Street.
>
> Anchored to today, keeping the gaps from last time. Nine of the eleven tasks carried
> over.
>
> 1. Site survey and measure — 6 May
> 2. Order materials — 8 May
> 3. Confirm delivery slot — 12 May
> 4. Strip out existing suite — 22 May
> 5. First fix plumbing — 23 May
> 6. Tiling — 26 May
> 7. Second fix and fit suite — 28 May
> 8. Snag list walkthrough — 29 May
> 9. Final invoice — 3 June
>
> The two-week gap between 2 and 4 is the materials lead time from last time, kept as
> is. Item 6 waits on 5; 7 waits on 6; 8 waits on 7. Everything else can move
> independently.
>
> I stripped "Ellis Street" from four task names and two descriptions. I dropped
> *"Chase Wickes about the wrong basin"* — that was a one-off. I also left out
> *"Book skip"*, which never got completed last time; tell me if that was an oversight
> rather than a step you skip.
>
> No assignees, no estimates, no tags, default statuses.
>
> Anything that bit you last time? I'll add it as a step, or as a warning on the task
> it belongs to. Otherwise say go and I'll build it.

Note what the preview does. It states the anchor as a default rather than asking. It
names the rule it applied to titles and gives the count, so the user can spot an
over-eager strip. It separates a deliberate drop from a suspicious one and asks only
about the suspicious one. It describes the dependency shape in prose. And it ends with
the one question whose answer exists nowhere in the tracker — while still being a
complete, usable plan for someone who never replies.
