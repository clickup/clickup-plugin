---
name: daily-standup
description: >
  Runs a daily standup or check-in against ClickUp — drafts the standup from the user's
  open work, asks what changed, writes their answers back as task statuses and comments,
  then hands over the finished summary to share. Use when the user says
  'standup', 'run my standup', 'daily check-in', 'morning check-in', 'EOD update', or
  'post my standup'. Not for simply listing tasks — this skill asks questions and
  writes changes back to ClickUp.
metadata:
  version: "0.1.0"
---

# Daily Standup & Check-in

Most standup information evaporates — someone says "that one's done" or "I'm stuck on
the migration" and it never reaches the task. The point of this skill is to catch it.
The summary is a by-product; the write-back is the value.

Assume nothing persists between runs. There is no memory of yesterday's answers, no
saved channel, no stored preferences. Re-establish what you need each time and make
doing so cheap.

## Pull the slate

`clickup_filter_tasks` with the user's assignee and `include_closed: false` for what's
open. Then a second call with `date_closed_from` for what they finished. Set it to the
last working day, not literally yesterday — a Monday standup that looks back to Sunday
misses everything closed on Friday. Start the window one day earlier than that, too:
date filters are evaluated in the user's profile timezone, falling back to UTC when the
profile has none — and under that fallback an end-of-day close lands on the next
calendar date, so a tight window silently returns nothing. The extra day is cheap
insurance either way; trim the overshoot when you read the results.

Watch the open results for tasks whose status reads as finished — "complete", "shipped".
A status of type `done` never sets a close date, so those tasks pass an
`include_closed: false` filter and land with the open work. Treat them as finished work
to confirm, not as something in flight, and verify the type with `expand_statuses: true`
before moving anything.

There is no "active" or "in progress" status value — that parameter takes literal
status names, which differ per workspace. `include_closed: false` is how you get open
work.

`clickup_get_current_time_entry` tells you what they're tracking right now. Always worth
calling — it's cheap, and it's the strongest signal of what they're actually doing.

**Pass `workspace_id` on every call.** Anyone who belongs to more than one workspace gets
an error without it — on the reads, on the writes, and on tools which otherwise need no
parameters at all. Establish it once at the start and thread it through everything,
`update_task` and `create_comment` included.

For `assignees` on `clickup_filter_tasks`, resolve "me" to a numeric user ID with
`clickup_resolve_assignees` first. The server can resolve names and emails in many
tools, but a numeric ID is the one form accepted everywhere — resolve once at the start
and reuse it in every call.

## Check the commits, if there are any

If a repository is open, read the commit history over the same window as the task
pull — back to the last working day, so a Monday covers Friday. This is the part the
ClickUp data can't give you: task statuses lag reality because people forget to move
tickets, but commits don't lie.

The valuable output is the mismatch — work that happened with no ticket to show for it,
or a ticket still sitting in progress that the commits say is finished. Surface that;
it's the most useful thing a standup produces.

**Surface the find, not the search.** "Your commits mention the retry fix but DEV-1841
is still open — close it?" is worth saying. Never narrate looking for a repo, and never
report that there wasn't one. With no repo, build "yesterday" from closed tasks alone
and say nothing about it.

## Draft it first, then ask

Write the standup before you ask anything. Draft it from the task data using the shape in
**Format the summary** below, label it a draft, and put your questions to the user as
corrections to something concrete.

Never ask with nothing on the page. Three open questions in front of a blank draft get
shrugs; a draft with one wrong line in it gets that line fixed immediately. It also means
silence still pays — someone who reads the draft and walks away has what they came for,
which is not true if all they got was a task list and an interrogation.

Show the open work grouped, not enumerated. "Three bug fixes in Billing" beats three
lines, and twenty individual tasks is a wall nobody reads.

Then ask three things in one pass:

- anything to mark done?
- anything blocking you?
- what's the focus today?

State what you assumed so correcting it is cheap: which items you took to be today's
focus, and that you've recorded no blockers because none were mentioned. Empty lines
belong in the draft — they're the ones people correct. Drop them from the final summary,
where "Blockers — none" is the noise that teaches people to stop reading.

If nothing is in progress, say so and offer to pull something from the backlog. That's
a useful signal rather than an empty result.

## Write the answers back

This is the step that matters. The draft was only a way to get honest corrections out of
the user; nothing is finished until their answers are on the tasks. Write them back
before handing over the final summary.

**Status changes** — `clickup_update_task`. Statuses are per-list and must match
exactly, so confirm valid values with `clickup_get_task` and `expand_statuses: true`
before setting anything you're not certain about.

**Blockers and context** — `clickup_create_comment` with `entity_type: "task"` and
`entity_id` set to the task ID. A blocker mentioned out loud and not written down is
lost by tomorrow. Write it on the task it blocks, in the user's own words.

Leave `notify_all` unset. A standup note shouldn't page the whole watcher list.

## Format the summary

Yesterday, today, blockers — plus a **waiting on others** line whenever something sits in
review or QA. Those items are neither today's work nor the user's own blocker, and
folding them into either misstates who owns them. Say "not on you" plainly. Where a
review has been sitting a long time, the useful question is who owns it, not what its
status is.

Short enough to read in one glance — a standup nobody skims has failed at its only job.

Group by theme rather than listing tasks. Include task IDs only where someone might
need to click through.

**Name the worst two or three; don't count them.** "Twenty of thirty-eight are overdue"
is a statistic nobody can act on. "Rotation curve fitting is five weeks late, spectral
classification four" is something you can say out loud and get help with. Aggregate
counts belong in a report, not a standup.

**End on one ask.** A standup exists to produce a single clear request for the room.
Fifteen tasks in progress at once isn't a flag to mention in passing — it *is* the ask,
and it's usually the cause of everything else on the list. Read the slate for the one
thing worth raising, and raise it.

## Confirm before posting

Show the finished summary and wait for a yes. A channel post is visible to colleagues
and can't be taken back — it's the only irreversible thing this skill does.

If the user wants it posted, get the channel with `clickup_get_chat_channels` and offer
the options. Don't ask them to recall a channel ID, and don't claim to remember one from
last time. Then `clickup_send_chat_message` with `channel_id` and `content`.

Better etiquette where a team already has a daily thread: find it with
`clickup_get_chat_channel_messages` and pass `parent_message_id` to reply underneath
instead of starting a new top-level message every morning.

If they'd rather post it themselves, just output the text. That's a perfectly good
ending.

## Tools used

| Tool | When |
| --- | --- |
| `clickup_resolve_assignees` | Turn "me" into the numeric ID `filter_tasks` requires |
| `clickup_filter_tasks` | Open work, and tasks closed since yesterday |
| `clickup_get_current_time_entry` | What's being tracked right now — cheap, always worth it |
| `clickup_get_task` | Confirm valid statuses with `expand_statuses: true` |
| `clickup_update_task` | Apply status changes |
| `clickup_create_comment` | Record blockers and progress notes |
| `clickup_get_chat_channels` | Offer channel options |
| `clickup_get_chat_channel_messages` | Find a daily thread to reply under |
| `clickup_send_chat_message` | Post the summary |

## Gotchas

- **`date_closed_from`**, not `date_done_gt`. The underlying API uses the latter; this
  tool does not. Dates resolve in the user's profile timezone, or UTC when the profile
  has none — under that fallback a Friday-evening close in a western timezone lands on
  Saturday's date and a same-day window returns nothing, with no error. Start the
  window a day early and trim by hand.
- **"Yesterday" means the last working day.** On a Monday, look back to Friday. A
  literal yesterday produces an empty slate and an interrogation the tracker could have
  answered.
- **`statuses` takes literal status names**, not categories. There is no "active".
- **Resolve "me" to a numeric ID once, and reuse it.** The server resolves names and
  emails in many tools, but numeric IDs are the one form accepted everywhere — and in
  testing, `"me"` passed to `clickup_create_task` was silently ignored, leaving the
  task unassigned with no error. One `clickup_resolve_assignees` call up front removes
  the whole class of problem.
- **`filter_tasks` returns 100 per page** with `has_more` and `next_page`. One person's
  open work rarely exceeds that, but check rather than assume.
- **`workspace_id` is required whenever the user has more than one workspace**, which is
  common. Without it the call errors and names the available IDs — including on
  `clickup_get_current_time_entry`, which needs no other parameter.
- **Match the status `type`, never the word.** `expand_statuses: true` returns
  `available_statuses`, each carrying a `type`. Only `type: "closed"` sets a close date;
  `type: "done"` reads as finished and leaves the task open. The same label behaves
  differently per list — "complete" closes tasks in one list and merely marks them done
  in another within the same space. Pick by `type` or the cleanup silently does nothing.
- **Statuses are per-list.** Never guess a status string — confirm with
  `expand_statuses: true`.
- **Comments use `entity_id`**, not `task_id`. Avoid the deprecated
  `clickup_create_task_comment`.
- **`clickup_get_chat_channels` paginates** on `cursor` and returns up to 100.
- **Never invent yesterday.** If there's no closed-task data and no commits, ask instead
  of reconstructing something plausible. A confidently wrong standup is worse than a
  short one.

For standup formats and grouping rules, see `references/standup-formats.md`.
