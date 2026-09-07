---
name: task-decomposition
description: >
  Breaks a goal, initiative, or oversized parent task into a small set of ordered
  subtasks in ClickUp, with optional estimates and dependency links. Always previews
  the plan and waits for approval before creating anything. Use when the user says
  'break this down', 'decompose this task', 'plan the subtasks', 'scope this work',
  'create a breakdown', or asks how to split up a piece of work.
metadata:
  version: "0.1.0"
---

# Task Decomposition & Dependency Planner

Turn a goal or an oversized task into a small set of well-sequenced subtasks in
ClickUp. Show the plan and get approval before writing anything.

## Gather context

**Pass `workspace_id` on every call.** Anyone who belongs to more than one workspace
gets an error without it — on the reads and on the writes. Establish it once at the
start and thread it through everything, `create_task` and `add_task_dependency`
included.

If the user pointed at an existing task, read it first:

`clickup_get_task` with `include: ["description", "custom_fields", "subtasks"]`

Read `subtasks` so you don't duplicate a breakdown that already exists. If the task
already has subtasks, say so and ask whether to extend them or start fresh.

If the user described new work in prose, treat their message as the brief. Don't
interrogate them for a specification.

## Use the local context if it happens to be there

A breakdown that names the user's real modules is worth far more than one built from
the task title alone. If files are open, spend a moment grounding the plan in them.

Worth a look: the directory or module the work touches, whether tests sit alongside
that code, whether there's a migrations folder, and what the CI workflow does on merge.
Those answer questions you'd otherwise guess at — whether "write tests" is a real step,
whether a schema change is involved, whether shipping needs its own task.

Then use what you found. "Add `parseFilters` to `filters/serialize.ts`" is concrete
enough to act on; "implement filter logic" is not.

**Surface the find, not the search.** Mention what you used, once, specifically — "your
CI runs on tag, so I've made the release its own step." Never narrate looking, and
never report coming up empty. If there's no repo, no project, or nothing relevant, just
decompose from the brief and say nothing about it. Plenty of people run this from a bare
chat with no code anywhere.

## Decide where the subtasks live

If there is a parent task, use its list. State which list you're using rather than
asking.

If this is new work with no parent, you need a `list_id`. Ask which list — this is the
one question worth asking before the preview. `clickup_get_list` accepts a list name
directly and returns its ID. Only reach for `clickup_get_workspace_hierarchy` if the
user doesn't know what lists exist.

## Draft the breakdown

Aim for three to ten subtasks. Each needs a name beginning with a verb, and a
description someone can pick up tomorrow without asking you.

The description has two jobs: why this task exists, and a **checkable "done when"** —
observable conditions, not a slogan. A short bullet list of what must be true beats a
single vague sentence. "Done when filters persist" is not enough; "Done when closing
and reopening the app restores the last selected filters, including empty and invalid
cases" is.

Prefer fewer, chunkier tasks. Six real units of work beat fifteen fragments — a
breakdown nobody wants to maintain is worse than no breakdown at all.

## Preview, then stop

Present the plan as text and wait. Create nothing yet.

The preview must state:

- each subtask name, in order, with its "done when" so the user can correct the bar
  before anything is written
- the dependency shape in plain English, e.g. "3 and 4 can run in parallel; 5 waits
  on both"
- every assumption and default you applied: target list, no estimates, no assignees,
  default task type

Then ask for a go-ahead. Accept loose approval ("looks good", "go") and handle partial
edits ("drop 4", "merge 2 and 3", "add estimates") without regenerating from scratch.

This step is the point of the skill. Bulk creation cannot be undone — the user would
delete tasks one at a time. Never skip it, even when the request seems obvious.

## Create the subtasks

One `clickup_create_task` call per subtask; there is no bulk create.

- `name` and `list_id` are required
- `parent` — the parent task ID, when decomposing an existing task
- `markdown_description` — the description parameter is named this, not `description`
- `time_estimate` — only when the user asked for estimates. Whole minutes as a digit
  string: `'60'` is one hour, `'150'` is 2h 30m
- leave `status`, `priority`, `assignees` and `task_type` unset unless the user
  specified them

Write the checkable "done when" into `markdown_description`, not only into the
preview. A name with no description is a task someone has to decompose again.

## Wire dependencies

Add a dependency only where a genuine input/output relationship exists.

`clickup_add_task_dependency` requires three parameters: `task_id`, `depends_on`, and
`type`. Use `type: "waiting_on"`, which reads as "`task_id` cannot start until
`depends_on` is done."

Resist serializing everything. Narrative order is not causal order — two tasks that
merely share a phase are not dependent. A straight chain through every subtask is
almost always wrong, and it destroys the user's ability to parallelize.

For a non-blocking association, use `clickup_add_task_link` instead.

## Verify what landed

After creating and wiring, re-read the parent with `include: ["subtasks"]` and confirm
the count matches the plan. The compact view omits descriptions, so spot-check one
subtask with `include: ["description"]` — a missing description is a silent failure.
If you wired dependencies, don't trust the parent — links between subtasks live on
the children. Spot-check one child with `include: ["dependencies"]` and confirm the
waiting-on relationship is there.

Then report what you created, with IDs, so the user can find the tasks.

## Estimates are opt-in

Never add estimates unless asked. Teams feed them into capacity planning, and a
guessed number is worse than an empty field because it looks like data. When the user
does want them, put ranges in the preview so they can adjust before anything is
written.

## Optional summary doc

Only when the user asks for one. `clickup_create_document_page` requires
`document_id`, `name` and `content`; ask which doc to write into. Use
`content_format: 'text/md'`.

## Tools used

| Tool | When |
| --- | --- |
| `clickup_get_task` | Read the parent; re-read after writes to verify they landed |
| `clickup_get_list` | Resolve a list name to an ID |
| `clickup_get_workspace_hierarchy` | Only when the user doesn't know what lists exist |
| `clickup_create_task` | Create each subtask |
| `clickup_add_task_dependency` | Wire blocking relationships |
| `clickup_add_task_link` | Associate tasks without blocking |
| `clickup_create_document_page` | Optional plan summary |

## Gotchas

- **`workspace_id` is required whenever the user has more than one workspace**, which
  is common. Without it the call errors and names the available IDs. Thread it through
  every call, including creates and dependency links.
- **Skip tags.** `clickup_add_tag_to_task` fails unless the tag already exists in the
  space, and there is no tool to create one or to list what exists. Phase tags like
  `phase-1-discovery` will error.
- **`time_estimate` takes digits only.** `'1.5'`, `'90m'` and `'1h30m'` all error.
  Milliseconds pass validation silently and produce estimates of several years, so
  never convert.
- **`clickup_create_task` accepts emails and usernames for assignees — but not "me".**
  Passing "me" is silently ignored and the task lands unassigned. Resolve "me" to a
  numeric ID with `clickup_resolve_assignees` first.
- **Statuses are per-list.** Don't set `status` unless you confirmed a valid value via
  `clickup_get_task` with `expand_statuses: true`.
- **Task types must already exist** in the workspace. Omit `task_type` and the list
  default applies.
- **Custom IDs** like `DEV-1234` work anywhere a task ID is accepted.
- **Watch the call count.** Eight subtasks is eight create calls plus dependency
  calls. Keeping breakdowns small keeps the skill fast.

For decomposition patterns, estimation heuristics and a worked example, see
`references/decomposition-patterns.md`.
