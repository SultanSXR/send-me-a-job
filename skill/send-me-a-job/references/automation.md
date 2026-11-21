# Automation: scheduled runs and a public link form

## A. Public "Send me a job" form (optional)
The repository's `public-form/index.html` is a static page that friends can use to send links without signing in. Deploy it to Netlify (drag the folder onto app.netlify.com/drop, or `netlify deploy`). Netlify Forms picks up the `job-links` form automatically. Before deploying, edit the two settings at the top of its `<script>`:
- `OWNER` – the first name shown on the page.
- `FEED` – optional. A published Google Sheet URL (`gviz/tq?tqx=out:json&sheet=Live&headers=1`) with columns `id, track, company, role, location, deadline, url, why`, shown as "Suggested for <name>". Leave it empty to hide that section.

To read submissions: through a Netlify connector if the session has one (form submissions, read only), or with the Netlify API `GET /api/v1/forms/<formId>/submissions`. Each submission's `data` has `url`, `track`, `name` and `note`. Never delete submissions.

## B. Scheduled pack runs (inside Claude)
If the session can create scheduled tasks, offer a pack task whose prompt is self-contained (each run starts fresh). Ask how often; twice a day (morning and early evening) works well. There is no per-run limit by default: each run builds every `new` or queued job, unless the user asks for a cap.
1. Gather new links from the agreed sources (form, mail with a subject like "Job", the jobs list).
2. Build packs for every `new` job (and every job the user queued with "Add to the queue"), following SKILL.md section 2.
3. Estimate chances for open jobs that have no recent estimate, and add suggestions with the best chances, following `references/chance.md`. Record them as suggestions, never as applications. Refresh the advice list.
4. End with a short summary: packs ready, jobs skipped and why, links that need the user.

The task must never submit, send email, or contact employers. It only prepares packs.

### Where packs are stored
- **Local folder** (default): `out/<id>/`.
- **Google Drive** (when a Drive connector is attached to the task): keep everything in **one dedicated folder** (e.g. "Job Portal"), with one subfolder per job named `<Company> – <Role>`. Upload the CV, the cover letter and a short pack-notes doc there, and record `driveFolderId`, `driveUrl`, `cvFileId` and `letterFileId` on the job. Before creating anything, search the folder: reuse an existing subfolder for the same job and replace its files rather than adding copies, so there are never duplicates. Never create files outside the dedicated folder and never move the user's own files.
- Email drafts are no longer needed; prefer Drive or the local folder.

### "Apply now" or "Add to the queue"
When the user clicks **Apply** on a job, ask which they want:
- **Apply now**: build the pack straight away (if it isn't ready) and start applying, following `references/apply.md` (or the hands-off task).
- **Add to the queue**: leave the job for the next scheduled pack run; it is queued for applying once its pack is ready.
A portal can do this by firing a separate on-demand task (with a flag such as `applyNow: true` on the job) for "Apply now".

To also fill in forms while the user is away, set up the separate hands-off apply task in `references/hands-off.md`. It runs on the user's computer and only submits after their reply.

## C. Without Claude: the command-line tool
The repository's CLI does the same pack-building with only an Anthropic API key. No Claude account sign-in is needed. See the repository README (`send-me-a-job run` from cron, `send-me-a-job serve` for a local portal).
