# Standup Formats & Grouping

Reference material for the `daily-standup` skill. Load when choosing a format or when
the slate is too large to present raw.

## Formats

### Classic — yesterday, today, blockers

The default. Works for any team and scans in seconds.

```
**Yesterday** — Shipped retry handling for webhooks (DEV-1841). Cleared two billing bugs.
**Today** — Filter persistence, starting on the serialization layer.
**Waiting on others** — Export rewrite is in review (DEV-1902), not on me.
**Blockers** — Waiting on schema review from the platform squad.
**Ask** — Six things are open at once; help me pick two to park.
```

Omit any line that has no content. An empty "Blockers: none" is noise that trains people
to stop reading.

The last two lines are the ones people skip and shouldn't. *Waiting on others* keeps
review and QA items visible without implying the user is sitting on them. The *ask* is
the reason the meeting exists — if the update ends without one, it was a status report.

### Narrative — one paragraph

For senior folks and cross-functional channels where structure feels bureaucratic.

```
Finished the webhook retry work yesterday and cleared a couple of billing bugs. On
filter persistence today, starting with serialization. Still waiting on schema review
before I can finish the migration piece.
```

Same content, less scaffolding. Use when the audience is broad or the update is short.

### Threaded — summary plus detail

For channels with a daily thread. Post one or two lines at top level, then put the
per-area detail in replies. Keeps the channel readable while preserving depth for
anyone who wants it.

Reply under the existing thread rather than starting a new one. A fresh top-level post
every morning is how standup channels become unreadable.

## Grouping

The failure mode is enumeration. Twelve tasks listed individually is a wall; the same
twelve grouped is three lines.

Group by whatever the user would say out loud:

| Instead of | Say |
| --- | --- |
| Six bug task names | "Cleared six bugs in Billing" |
| Four subtasks of one parent | "Finished the onboarding flow work" |
| Three unrelated small items | "Plus some cleanup — docs, a flaky test, a config bump" |

Include task IDs only where someone might need to click: the blocker, the thing under
review, the item you're asking about. Not for completed routine work.

Grouping is for volume, not for overdue work. Collapse six finished bugs into one line,
but name the two or three worst-overdue items individually with how late each is. "Five
weeks late" is a prompt for help; "twenty overdue" is a number people nod at and ignore.

Name at most three specific things in the "today" section. A standup listing seven
priorities is telling you the person doesn't have one.

## What belongs in a blocker

A blocker is something that stops progress and that someone else can unstick. That
distinction matters — a channel full of soft blockers stops getting read.

Qualifies: waiting on a review, a decision, access, or another team's work. A broken
dependency nobody owns yet.

Doesn't qualify: work that's merely hard, or unfinished, or that the person hasn't
started. That's just status.

When the user reports a blocker, write it on the blocked task as a comment before it
goes in the summary. The channel message scrolls away within a day; the task comment is
still there next week when someone asks why it stalled.

If a blocker names a person, consider whether a dependency link belongs on the task too
— but only when a real task is doing the blocking. Don't invent one.

## Reconciling commits with task state

Where commit history is available, four cases are worth raising:

**Commits, no ticket.** Real work with nothing to show for it. Offer to create a task
so it's visible.

**Ticket open, commits say done.** The most common drift. Offer to close it.

**Ticket in progress, no commits for days.** Possibly stalled, possibly just not code
work. Ask rather than assume — plenty of legitimate work leaves no commits.

**Commits referencing a closed ticket.** Follow-up work that needs its own task, or a
premature close.

Raise these as short questions, not as a report. One line each, and only for the ones
that look wrong. Nobody wants an audit at nine in the morning.

## Tone

Write it as the user would write it — first person, plain, no corporate padding. "Fixed
the retry bug" not "Successfully completed remediation of the retry defect."

Don't inflate. If the day was thin, the standup is short, and that's an honest signal
worth preserving.
