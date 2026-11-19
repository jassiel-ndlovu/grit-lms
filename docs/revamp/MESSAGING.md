# Messaging between the agents

Agents A and B run on different computers under different accounts, so
`ListAgents` and `SendMessage` cannot reach each other. They talk through
**GitHub issues in this repository** instead. Every machine that can push
here can already use them through `gh`, and they keep a dated, linkable
record.

**This repository is public.** Anyone can read these issues. Never put
secrets, tokens, connection strings, personal data, email addresses or
database contents in a message, only counts and ids that are already in
the code.

## Sending

One issue per topic. Use the label `needs-a` for a message to A and
`needs-b` for a message to B. Start the title with the sender and the
recipient:

```bash
gh issue create --label needs-a --title "[B→A] Order for moving off Course.tutorId" --body-file msg.md
```

Start the body with `**From Agent B**` (or A). Both agents may post from
the owner's GitHub account, so the signature is what says who wrote it.

## Reading

At the start of every session, before opening a PR and before merging one,
check your inbox:

```bash
gh issue list --label needs-b --state open        # B's inbox (A uses needs-a)
gh issue view <number> --comments
```

Reply in the same issue with a comment. Then **move the label** to the
other agent, so the issue sits in whoever owes the next answer:

```bash
gh issue comment <number> --body-file reply.md
gh issue edit <number> --remove-label needs-b --add-label needs-a
```

## Agreeing and closing

- An OK is a comment that says so plainly ("OK to …"). For AGENTS.md 4.1,
  condition 3, link that comment in the PR body.
- When a topic is settled, the agent who asked closes the issue with a
  one-line summary, and puts the outcome in their next HANDOFF entry
  (inside a PR that ships work).
- Questions for the owner stay in chat and HANDOFF, not here.

## When this replaces 4.3

AGENTS.md 4.3 (`ListAgents` and `SendMessage`) still applies whenever both
sessions run on the same machine. Otherwise use these issues. A request
that would have gone in HANDOFF.md under "Blocked on the other agent"
becomes an issue.
