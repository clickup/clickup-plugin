# Decomposition Patterns

Reference material for the `task-decomposition` skill. Load only when the breakdown
needs more structure than the main instructions provide.

## Choosing a pattern

Pick the pattern that matches how the work will actually be handed off. If two people
can't work in parallel under your chosen split, you picked the wrong one.

### Functional slicing (default)

Split by user-visible outcome, so each subtask delivers something demonstrable. Best
for product work and anything a stakeholder will review.

> Add saved filters → "Persist filter state", "Add filter chip UI", "Restore filters on
> load", "Handle empty and invalid states"

Each piece can be shown to someone. Prefer this unless there's a reason not to.

### Component-based

Split by system boundary — service, database, client. Best when different people or
squads own different layers, and the interfaces between them are already agreed.

> Add saved filters → "API endpoint for filter CRUD", "Filters table and migration",
> "Client state management", "Filter bar component"

The risk is that no single subtask delivers user value, so progress looks good while
nothing ships. Use it when ownership genuinely splits this way.

### Phase-based

Split by stage: discovery, build, validate, launch. Best for work with real gates —
approvals, compliance review, procurement — where the phase boundary is a decision
point rather than a convention.

> Vendor migration → "Audit current usage", "Evaluate two candidates", "Security
> review", "Pilot with one team", "Full cutover", "Decommission old vendor"

Phases are the one pattern where sequential dependencies are usually correct, because
each gate genuinely blocks the next.

### Spike-first

When the shape of the work is unknown, make the first subtask a time-boxed
investigation whose output is a plan. Then stop. Don't invent the subtasks that follow
a spike — the spike exists precisely because they can't be known yet.

> "Investigate why sync drops events (2 days, output: written findings)"

Propose this whenever the user's brief contains a question rather than a goal.

## Grounding the split in the actual code

Only relevant when files are open. Skip this entirely otherwise — most of these
breakdowns are done from a bare chat with no repository anywhere.

When there is one, a short look changes the shape of the breakdown more than any pattern
choice does:

| What you check | What it tells you |
| --- | --- |
| The directory the work touches | Whether this is one module or crosses three |
| Tests sitting beside that code | Whether "add tests" is a real step or already covered |
| A migrations folder | Whether a schema change needs its own task, ordered first |
| The CI workflow | Whether release is automatic or a manual step someone owns |
| Existing similar features | The shape the team already uses, worth matching |

The payoff is naming things the user recognizes. "Extend `FilterBar` and add
serialization to `filters/serialize.ts`" is a task someone can pick up; "implement
filter UI" is a task someone has to decompose again.

It also corrects granularity. Work that looks like one task from the title often turns
out to span a client, an endpoint and a migration — and work that sounds huge sometimes
turns out to be a single file.

Mention what you used, briefly and specifically, in the preview. Don't narrate the
search, and don't report finding nothing.

## Granularity

Target subtasks that represent between half a day and three days of work.

Too fine is the more common failure. Signs you've over-split: a subtask that can't be
described without referencing another, names that are steps rather than outcomes
("open the file", "add the import"), or more than ten items for something one person
will do in a week.

Too coarse shows up as any subtask you'd immediately want to break down again.

When unsure, go coarser. Adding detail later is easy; merging tasks that already have
comments and history is not.

## Estimation

Only produce estimates when asked. When you do:

Give ranges, not points, and state them in the preview so the user can correct them
before anything is written. "Half a day to two days" is honest; "6h" implies precision
you don't have.

Rough anchors, assuming a focused engineer:

| Shape of work | Range |
| --- | --- |
| Config change, copy edit, flag flip | under 2h |
| Contained change in a familiar area | half a day to 1 day |
| New endpoint or component with tests | 1–3 days |
| Crosses a service boundary | 3–5 days |
| Unknown cause, needs investigation | time-box it instead |

Anything you'd estimate above five days is not a subtask. Split it or spike it.

Never estimate work whose approach is still undecided — that's what a spike is for.

Remember the format when writing: whole minutes as a digit string. Half a day is
`'240'`, one day is `'480'`.

## Identifying real dependencies

A dependency exists only when one task cannot start until another finishes. Four cases
qualify:

**Data or interface** — B consumes something A produces. The schema, the endpoint, the
contract.

**Approval gate** — B cannot legitimately begin until a decision or sign-off from A
lands.

**Shared exclusive resource** — both need the same environment, device or account, and
can't share it.

**Physical ordering** — deploy after build, migrate after backup.

### What is not a dependency

- Belonging to the same phase or epic
- Being listed adjacently in the plan
- One being "more important" than another — that's priority
- Being assigned to the same person — that's capacity, and it's the assignee's problem
  to sequence, not a structural fact about the work

The dominant failure mode is a straight chain: 1 blocks 2 blocks 3 blocks 4. This
happens because the plan reads in order, and it silently forbids parallel work. Before
writing dependencies, check each link and ask what specifically breaks if both start on
the same morning. If the answer is "nothing", drop the link.

Most healthy breakdowns have fewer dependencies than subtasks, and often a shape like
"1 blocks everything else, 2 through 5 run in parallel, 6 waits on all of them."

## Worked example

**Brief:** "Break down launching the new onboarding flow."

**Pattern:** functional slicing, since each piece is demonstrable.

**Preview shown to the user:**

> Six subtasks in *Growth · Q3*. No estimates or assignees; default task type.
>
> 1. Define onboarding steps and success metric — done when the steps are written and
>    one success metric is agreed, before any screens are built
> 2. Build welcome and profile-setup screens — done when a new user can complete both
>    screens end to end
> 3. Add progress persistence across sessions — done when closing and reopening the app
>    restores the user to the same step
> 4. Instrument funnel events — done when each step emits an event a dashboard can
>    count
> 5. Set up A/B test against current flow — done when 50% of new users see the new
>    flow and the metric from 1 is being recorded on both sides
> 6. Launch review and rollout plan — done when the review has a named owner, a go/no-go
>    date, and a rollback step
>
> Dependencies: everything waits on 1. Items 2, 3 and 4 run in parallel. Item 5 waits
> on 2 and 4. Item 6 waits on 5.
>
> Say the word and I'll create these, or tell me what to change.

Note what the preview does: names the list, states the defaults, puts a checkable
"done when" on each item so the bar is correctable, describes the dependency graph in
prose rather than as a diagram, and makes approval a single word.

Note also what it avoids — a chain. Only four dependency links across six tasks, and
three of the tasks start immediately once the definition lands.
