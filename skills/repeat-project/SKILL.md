---
name: repeat-project
description: >
  Rebuilds a job that has already been run as a fresh copy for a new client, cycle or
  engagement. Reads the real structure of the source list, swaps the previous instance's
  details for the new one's, shifts every date onto a new start or delivery date, and
  recreates the tasks with their sequencing intact. Always previews the rebuilt plan
  and waits for approval before creating anything. Use when the user says 'do this
  again', 'same as last time', 'set this up for the new client', 'repeat this project',
  'run this playbook again', or names a past project as the model for a new one. Not
  for breaking a single task into subtasks — that is task-decomposition — and not for
  simply listing or duplicating one task.
metadata:
  version: "0.1.0"
---

# Repeat a Project

Take a job the user has already run and rebuild it for the next one. The value is not
in copying — it is in working out which parts were the *job* and which parts were the
*last instance of it*, then moving the whole thing onto new dates.

There is no duplicate or template tool in this plugin. Every task is created by hand,
so restraint about volume matters and the preview is mandatory.

**Pass `workspace_id` on every call.** Anyone in more than one workspace gets an error
without it, on reads and writes alike. Establish it once and thread it through.

**Never key off a specific status name, tag or custom field.** All three are
per-workspace configuration, chosen by whoever set the workspace up, and none of them
are guaranteed to exist anywhere else. Statuses carry a `type` — `open`, `custom`,
`done`, `closed` — and the type is the only part that means the same thing in every
workspace. `clickup_get_list` returns a list's statuses with their types, so read the
configuration and work from what is actually there rather than from a label you expect
to find.

## Find the source

The user will name it: "the Henderson onboarding", "last month's audit", "Project
Zord". Resolve with `clickup_get_list`, which accepts `list_name` directly and returns
the ID, the space, and the list's configured statuses.

Only reach for `clickup_get_workspace_hierarchy` if they don't know what exists. Note
that it returns spaces without their lists, so it tells you less than the name suggests.

If the source is a single task with subtasks rather than a whole list, read it with
`clickup_get_task` and `include: ["subtasks"]`, and rebuild it the same way — one new
parent, children beneath it. Say which shape you detected.

## Read the source

`clickup_filter_tasks` with `list_ids: [source_id]` and `include_closed: true`, since a
job worth repeating is a job that already finished. Paginate until `has_more` is false.

What comes back is name, status, priority, due date, tags, assignees and list. What does
**not** come back is descriptions, dependencies, or parent/child structure. Those need
one `clickup_get_task` per task. So read the whole list cheaply first, decide what
survives, and only then fetch detail for the survivors — with
`include: ["description", "dependencies"]` in a single call each.

If the source has more than about twenty-five tasks, say so in the preview and confirm
the shape before pulling per-task detail. Fifty tasks is fifty reads and fifty writes.

## Separate the job from the last instance

This is the actual work. Go through what you read and sort it.

**Swap the instance, don't erase it.** The previous client, site, product or date has to
go — but replace it with the new one rather than reducing it to a generic. "Send
Henderson the kickoff deck" becomes "Send Okonkwo the kickoff deck", not "Send kickoff
deck". You are building a live project for a named job, not a blank template, and
someone opening a task should be able to see whose job it is. Only strip to generic when
there is genuinely nothing to substitute.

Descriptions carry the old name more often than titles do, because nobody ever edits
them. Check them specifically. The previous client's name surviving into the new project
is the most embarrassing possible failure of this skill.

**Drop what won't recur.** One-off fixes, "chase Dave about the missing invoice",
duplicated tasks someone created twice, anything that reads as a correction rather than
a step. List what you dropped in the preview so the user can pull one back.

**Drop the old execution data entirely.** Assignees, statuses, close dates, time
tracking, comments, attachments and watchers do not carry over. A repeated job starts
unassigned and unstarted.

**Let the last run's outcome inform what to drop.** A task the previous job never
finished — still sitting in a status typed `open` or `custom` when everything else
closed — is often a step that was quietly abandoned rather than a step that matters.
Offer those as suggested drops in the preview rather than removing them silently.
Sometimes it is the step everyone skips and shouldn't.

**Keep the shape.** Order, the gaps between dates, and the dependency graph are the
things that make this worth doing rather than retyping a checklist.

## Rebase the dates

The gaps between dates are information. A two-week wait between "order materials" and
"install" is procurement lead time, not an accident, and a rebuild that assigns
consecutive days silently deletes it.

So work in offsets:

1. Read each source due date. **They come back as millisecond timestamps** like
   `"1782288000000"`, not as dates.
2. Convert to calendar dates and find the earliest and latest.
3. Record each task's offset in whole days from the earliest.
4. Apply the offsets to the new anchor.

**Default the anchor rather than asking for it.** Assume the new job starts today,
apply the offsets forward, and state that assumption in the preview. Correcting it is
then one sentence — "it has to land by 14 November" — and you shift the whole set so
the last task falls on that date instead. A question asked before the user has seen
anything gets a shrug; a stated default gets corrected precisely.

**But notice when the job runs up to a fixed outside date.** Many repeatable jobs build
toward something nobody controls — a show, a conference, a filing deadline, a season.
For those, "starts today" produces a plan that is confidently wrong in every single row,
and a dozen invented dates read as a schedule somebody decided on.

When the source job clearly builds toward an event, still show the full dated plan so a
reader who never replies gets something usable, but lead with the fact that the dates
are provisional and name the one input that fixes them:

> These are spaced correctly relative to each other but anchored to today. Tell me the
> show date and the whole set slides to fit.

Then anchor backward from the date they give you.

`clickup_create_task` needs `due_date` as `YYYY-MM-DD` or `YYYY-MM-DD HH:MM`. You are
reading one format and writing another; a millisecond value passed straight through
will be rejected or land absurdly.

**Tasks with no due date in the source get no due date in the copy.** Do not spread
them evenly to look tidy. An invented date reads as a commitment somebody made.

If the source has no dates at all, skip rebasing, say so in one line, and rebuild the
order alone.

## Ask the one thing the tracker cannot know

The plan is reconstructible from data. What went wrong last time is not — it exists
only in the user's head, and this is the one moment they will happily tell you.

Put the question **inside the preview**, not before it, so someone who never replies
still gets a usable plan:

> Anything that bit you last time? I'll add it as a step or a warning on the task it
> belongs to.

Take whatever they say and write it into the tool — a new task if it's work, or a line
in the relevant task's description if it's a caution. "Council sign-off took three
weeks, not one" belongs in the description of the permit task, where the next person
will actually read it. Do not leave it in the chat.

## Preview, then stop

Show the rebuilt plan as text. Create nothing yet. The preview must state:

- the new list name and where it will live
- every task in order with its new date
- what you stripped or renamed, with one example so they can see the rule you applied
- what you dropped, by name
- the dependency shape in plain English
- the defaults you applied: anchored to today, no assignees, no estimates, default
  statuses, tags not carried

Then ask for a go-ahead alongside the "what bit you last time" question. Accept loose
approval and handle edits — "drop 4", "it starts the 3rd", "keep Dave's task" — by
adjusting, not regenerating.

Bulk creation cannot be undone in one action. The user would delete tasks one at a
time. Never skip this step.

## Build it

Create the list first: `clickup_create_list` takes `space_name` or `space_id`, so no ID
lookup is needed if you know the space. Use `clickup_create_list_in_folder` when the
source sat in a folder.

Write the offset schedule into the list's `content` — "confirm stand 40 days out, brief
designer 37 days out, ship crate 8 days out". The dates on the tasks say when *this* run
happens; the offsets say what the job's *shape* is. Keeping both means the schedule can
be rebuilt from the list itself when the anchor turns out to be wrong, which it often
does.

Then one `clickup_create_task` per task:

- `name` and `list_id` are required
- `markdown_description` — the rewritten description, not `description`
- `due_date` — the rebased date, `YYYY-MM-DD`
- `parent` — only when rebuilding a task-with-subtasks
- leave `status`, `priority`, `assignees`, `tags` and `time_estimate` unset

**Keep a map of old task ID to new task ID as you go.** You need it in a moment, and
rebuilding it afterwards means re-reading everything.

## Rewire the dependencies

`clickup_add_task_dependency` needs three parameters: `task_id`, `depends_on`, and
`type`. Use `type: "waiting_on"`, which reads as "`task_id` cannot start until
`depends_on` is done."

Translate every link through your ID map before writing it. Wiring a new task to an old
task ID does not error — it quietly links the new project to the finished one, and the
new job is born blocked by work from the last client.

Drop any dependency whose other end was not copied. A link pointing outside the new
list is the same failure wearing a different hat.

## Verify

Re-read the new list with `clickup_filter_tasks` and confirm the count matches the
preview. The listing omits descriptions, so spot-check one task with
`include: ["description"]`. If you wired dependencies, spot-check a child with
`include: ["dependencies"]` and confirm the link points at a **new** task ID, not an
old one.

Report what you built with the list ID and a couple of task IDs so the user can find it.

## Tools used

| Tool | When |
| --- | --- |
| `clickup_get_list` | Resolve the source list by name; read its space and its statuses with types |
| `clickup_filter_tasks` | Read the source structure; verify the rebuild |
| `clickup_get_task` | Fetch descriptions and dependencies for surviving tasks |
| `clickup_create_list` | Create the new list in a space |
| `clickup_create_list_in_folder` | Create it inside a folder instead |
| `clickup_create_task` | Create each task |
| `clickup_add_task_dependency` | Rewire sequencing between the new tasks |
| `clickup_get_workspace_hierarchy` | Only when the user doesn't know what exists |

## Gotchas

- **Dates are read as milliseconds and written as `YYYY-MM-DD`.** Two different formats
  on the two ends of one operation, and the likeliest place for this to break.
- **Never copy `status`.** Status sets are configured per list, so the target may share
  no names at all with the source. Omit it and the list default applies. Copy it and you
  either error or create a project that is born finished.
- **Status labels lie; only `type` is portable.** One list can hold two statuses that
  both read as finished to a human, where the one typed `closed` sets a close date and
  the one typed `done` leaves the task open. The same word can carry different types in
  two lists in the same space. Read types from `clickup_get_list` and match on those.
- **Tags and custom fields are workspace configuration.** Neither can be created, and the
  target space may have an entirely different set. Don't carry tags, and read
  `clickup_get_custom_fields` before referring to any field by name.
- **`filter_tasks` returns no descriptions, no dependencies and no parent field.** Each
  costs a separate read, so only pay it for the tasks that survived.
- **No duplicate, template or copy-list tool exists.** Everything is built one call at a
  time, which is why volume needs a gate.

Two more you will most likely do unprompted, kept here only so they don't get skipped
under time pressure: read the source with `include_closed: true`, and translate every
dependency through your old-to-new ID map before writing it. An unmapped link doesn't
error — it quietly ties the new job to the finished one.

For stripping rules, the date arithmetic worked through, and a full example, see
`references/rebasing-and-stripping.md`.
