# Automation: scheduled runs and a public link form

## A. Public "Send me a job" form (optional)
The repository's `public-form/index.html` is a static page that friends can use to send links without signing in. Deploy it to Netlify (drag the folder onto app.netlify.com/drop, or `netlify deploy`). Netlify Forms picks up the `job-links` form automatically. Before deploying, edit the two settings at the top of its `<script>`:
- `OWNER` – the first name shown on the page.
- `FEED` – optional. A published Google Sheet URL (`gviz/tq?tqx=out:json&sheet=Live&headers=1`) with columns `id, track, company, role, location, deadline, url, why`, shown as "Suggested for <name>". Leave it empty to hide that section.

To read submissions: through a Netlify connector if the session has one (form submissions, read only), or with the Netlify API `GET /api/v1/forms/<formId>/submissions`. Each submission's `data` has `url`, `track`, `name` and `note`. Never delete submissions.

## B. Daily run as a scheduled task (inside Claude)
If the session can create scheduled tasks, offer a daily task whose prompt is self-contained (each run starts fresh):
1. Gather new links from the agreed sources (form, mail with a subject like "Job", the jobs list).
2. Build packs for up to 8 `new` jobs, following SKILL.md section 2.
3. Estimate chances for open jobs that have no recent estimate, and add suggestions with the best chances, following `references/chance.md`. Record them as suggestions, never as applications. Refresh the advice list.
4. End with a short summary: packs ready, jobs skipped and why, links that need the user.

The task must never submit, send email, or contact employers. It only prepares packs (and drafts, if a mail connector is used).

To also fill in forms while the user is away, set up the separate hands-off apply task in `references/hands-off.md`. It runs on the user's computer and only submits after their reply.

## C. Without Claude: the command-line tool
The repository's CLI does the same pack-building with only an Anthropic API key. No Claude account sign-in is needed. See the repository README (`send-me-a-job run` from cron, `send-me-a-job serve` for a local portal).
