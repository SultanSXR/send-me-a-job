# Send me a job

Turn job links into tailored application packs. For each link it reads the advert, checks the role suits you and doesn't rule out your work rights, then writes a CV and cover letter (.docx, A4 or US Letter) using **only facts from your own profile**. It keeps a tracked list of every job.

It also estimates, privately, **your chance of getting each job**. The research covers the advert, the employer's hiring history, the market, published patterns of who got the job before, and visa sponsorship. It then **suggests the open roles where your chances are best** and tells you **what to change in your profile to raise them**.

You can use it in three ways:

| | In the Claude app | Hands-off on your computer | Standalone (no Claude login) |
|---|---|---|---|
| What you need | Claude (web, desktop or mobile) with skills | Claude **desktop app**, open on a computer that stays awake | Node 18+ and an Anthropic API key |
| Builds CV + cover letter | Yes | Yes | Yes |
| Fills in application forms | Yes, in the desktop app's built-in browser while you watch | Yes, while you're away | No (you submit yourself) |
| When it needs you | Asks in the chat | **Sends a notification**; you answer or approve from the Claude app on any device | — |
| Submits | Only after your yes | Only after you reply "submit <company>" | Never |

Your personal details never go in this repository. `profile.json`, `config.json`, `data/` and `out/` are git-ignored and stay on your computer. All three ways share the same data folder, so you can build packs with the command-line tool and apply with the Claude app.

---

## 1. Use it in the Claude app

1. Download **[`dist/send-me-a-job-skill.zip`](dist/send-me-a-job-skill.zip)**, or build it yourself with `npm run package-skill`.
2. In Claude, open **Settings → Capabilities → Skills**, choose **Upload skill** and pick the zip. In Claude Code, unzip it into `~/.claude/skills/` instead.
3. In the **Claude desktop app**, open a chat and click **+ → Add folder** to connect a folder for your job hunt (e.g. `~/job-hunt`). Your profile, job list and documents live there.
4. Say: *"Set up send-me-a-job. Here's my CV."* Claude builds your `profile.json` with you, asking for your target country, your work-rights sentence and the job tracks you want.
5. Paste a link: *"Build my application pack for this job: https://…"*
6. To apply while you watch: *"Apply to my ready jobs."* Claude opens each application in the app's **built-in browser**, fills it in from your profile and pack, shows you everything, and clicks Submit only after your yes.

The skill also works in Claude on the web or mobile for building packs. Filling in forms needs the desktop app, or Claude in Chrome.

Skill contents (`skill/send-me-a-job/`):

```
SKILL.md                     workflow: profile → collect links → build packs → apply
scripts/make_docs.js         renders the CV and cover letter (.docx) from a spec
templates/profile.example.json
templates/spec.example.json
references/apply.md          filling in employer forms safely (live)
references/hands-off.md      applying while you're away, with notifications
references/automation.md     scheduled pack-building and the public link form
references/feedback.md       visitor suggestions, proposals and the approval step
references/growth.md         programmes, internships and free courses linked to your jobs
```

## 2. Hands-off: let it apply while you're away

Start it, leave your computer, and approve from your phone.

**One-time setup** (Claude walks you through it when you say *"Set up hands-off applying"*):

1. **Keep the Claude desktop app open and signed in** on your computer, with your job-hunt folder connected.
2. **Sign in once to your job sites in the built-in browser** (open it with Cmd/Ctrl+Shift+B): LinkedIn, plus any application portals such as Workday, Greenhouse or cvMail. Sign-ins are remembered, and Claude never types your passwords.
3. **Keep the computer awake and plugged in.** The screen may turn off, but the computer must not sleep.
   - macOS: run `caffeinate -dimsu` in Terminal, or turn on System Settings → Battery → Options → "Prevent automatic sleeping on power adapter when the display is off".
   - Windows: Settings → System → Power → "When plugged in, put my device to sleep after: Never".
4. **Turn on notifications** for the Claude app on your phone.
5. Claude creates a scheduled task, **"Send me a job: hands-off apply"**, that runs on your computer (e.g. every 2 hours).

**Day to day:**

- Queue the jobs you want to apply to. Say *"apply to these while I'm away"*, click **Queue for applying** in the local portal, or run `send-me-a-job mark <id> queued`.
- Each run opens every queued application in the built-in browser, fills it in and **stops before Submit**.
- When it needs you, you get a notification, for example *"Acme – Analyst is filled in. Reply 'submit Acme' to send it."* or *"Acme needs 2 answers: notice period, salary."* Tap it and reply in that conversation from anywhere. Claude then submits, or carries on with your answers.
- Things only you can do (signing in, CAPTCHAs, creating accounts, paying fees) are flagged to you and never done for you.

## 3. Run it without Claude (command-line tool + local portal)

```bash
git clone https://github.com/<you>/send-me-a-job.git
cd send-me-a-job
npm install
npm link                    # puts `send-me-a-job` on your PATH (optional)

mkdir ~/job-hunt && cd ~/job-hunt   # your private data folder
send-me-a-job init          # creates config.json and profile.json
# edit profile.json: replace the example person with your own details

export ANTHROPIC_API_KEY=sk-ant-...  # from console.anthropic.com
send-me-a-job add https://careers.example.com/jobs/123 --track marketing
send-me-a-job run           # builds packs for every new job
send-me-a-job list
```

Each pack goes into `out/<job id>/` and contains `<Name>_<Company>_<Role>_CV.docx`, `…_Cover_Letter.docx` and `pack.md`. `pack.md` lists the role, closing date, apply link, why it fits, visa sponsorship, gaps and suggested screening answers.

**Local portal:** `send-me-a-job serve` opens a page at `http://127.0.0.1:4321`. There you can paste links, click **Apply** (choose **Apply now** to build the pack and queue it straight away, or **Add to the queue** for the next scheduled run), build packs, download the documents, queue jobs for hands-off applying and mark them as applied. It also shows which jobs are waiting for your answers or approval. It listens only on your own computer.

**Run on a schedule:** add a cron job (or a Windows Task Scheduler task). This runs twice a day; every new job is built (set `maxJobsPerRun` in `config.json` to cap it):

```
35 10,18 * * *  cd ~/job-hunt && ANTHROPIC_API_KEY=sk-ant-... /usr/local/bin/send-me-a-job run >> run.log 2>&1
```

**Adverts that need a sign-in** (e.g. LinkedIn): copy the advert text into a file, then run `send-me-a-job add <url> --text advert.txt`.

### All commands

| Command | What it does |
|---|---|
| `init` | Create `config.json` and `profile.json` in the current folder |
| `add <url> [--track <name from your profile tracks>] [--note …] [--text file]` | Add a job link (duplicates are ignored) |
| `pull` | Import links from your Netlify form (needs `NETLIFY_TOKEN` and `netlify.formId`) |
| `build [id …]` | Build packs for new jobs, or for the ids given |
| `run [--suggest]` | `pull` (if configured), `build`, `score` (and `suggest`). Use this from cron |
| `list [--status ready]` | Show jobs and their status |
| `mark <id> <status>` | Set a status: `new`, `ready`, `queued` (for hands-off applying), `applied`, `skipped`, … |
| `score [id …]` | Estimate your chance of an offer for open jobs (private) |
| `suggest [--count 5]` | Find open roles where your chances are best, ranked |
| `advice` | Profile changes that would raise your chances |
| `feedback add\|list`, `improve`, `proposals [approve\|reject\|published <id>]` | Collect 140-character suggestions, turn them into proposals, record your decision |
| `growth [programmes\|courses]` | Free programmes, internships, courses and certifications linked to your jobs (see below) |
| `render <spec.json> [dir]` | Render a CV and letter from a spec, with no API call |
| `serve [--port 4321]` | Local web portal |
| `package-skill` | Build `dist/send-me-a-job-skill.zip` |

Environment variables: `ANTHROPIC_API_KEY` (required to build, research and review suggestions), `ANTHROPIC_MODEL` (optional, default `claude-sonnet-5-5`), `ANTHROPIC_BASE_URL` (optional), `NETLIFY_TOKEN` (optional).

## Your chances, best-chance suggestions and advice

Every job you haven't applied to gets a private estimate, for example **"3% (likely 1–5%), low confidence"**. Expand it to see five scored factors with sources:
- **Skills match**: how you compare with the advert's requirements.
- **Hiring history**: places per year, applicants per place, and sponsorship record.
- **Market & competition**: how many people are applying now.
- **Past hires like you**: published, anonymous patterns only. It never looks up named individuals.
- **Visa sponsorship**.

The numbers are deliberately honest. Graduate schemes often take about 1 in 100 applicants, so low figures are normal. The value is in comparing jobs and seeing what moves your chances.

| Command | What it does |
|---|---|
| `send-me-a-job score` | Estimates jobs without a recent estimate. `build` also scores each new pack (`scoreOnBuild`). |
| `send-me-a-job suggest` | Researches open roles where your chances are best, adds those at or above `minSuggestChance` (default 2%) ranked highest first, and retires weaker suggestions |
| `send-me-a-job advice` | Turns the estimates into up to 8 concrete changes to your CV, LinkedIn or targeting. It never suggests claiming anything untrue. |

The local portal shows suggestions ranked by chance, an "Add to my jobs" button, and a "How to raise your chances" box. All of it stays on your computer: nothing about your chances is ever shown on the public form. In the Claude app, ask *"what are my chances for these jobs?"*, *"suggest jobs I'm likely to get"* or *"how can I improve my chances?"*.

### Raising your chances, built in
- **Your facts for CVs.** The portal's "Your facts" box (saved to `data/facts.json`) holds real figures, grades in the employer's terms and what you do now. Packs and estimates use them word for word and never add to them.
- **Targeting list.** `data/targeting.json` (copy `targeting.example.json`) lists employers or schemes to avoid (e.g. right to work required) and ones to prefer (confirmed sponsors, career-changer friendly, large intakes). Suggestions and packs skip the avoid list.
- **Work-rights check.** If you need sponsorship, scoring and packs check the employer's sponsor record and whether the occupation and salary meet the destination country's sponsorship rules (for example UK Skilled Worker, US H-1B, Canada LMIA or Germany's Blue Card) (`swCheck`).
- **Deadline first.** Set `autoPrepareDays` (e.g. 10) and `run` builds packs for suggestions closing soon before anything else. Building a pack never applies; applying still needs your yes.
- **Commercial framing.** For business roles, packs lead each past role with its commercial side, using only your facts.

These steps use Anthropic's web search tool through your API key, so each estimate costs a few searches. `researchSearches` and `suggestSearches` in `config.json` cap them.

## Programmes, internships and free courses

Next to the suggested jobs, the portal suggests ways to become a stronger candidate for the jobs you're applying to, including the ones friends send you:

- **Mentorship, internships and work experience**: free programmes, insight schemes and placements.
- **Free courses and certifications** that would strengthen your CV or help at interview. Add a course to your CV only after you've completed it.

It works for any industry. The research follows your profile (`tracks`, and the optional `industries` list) and the jobs in your list, and picks platforms that suit your field. To make it check particular sites first, list them in `config.json`: `"growthPlatforms": ["Example Industry Association", "example-programmes.org"]`.

Every item shows its length. Filter by **Up to 3 months**, **Up to 6 months**, **Up to 1 year** or **Over 1 year**. Only free options are kept. If a certificate costs money the item says "Free to learn" and explains. Every item has the jobs it helps, its eligibility rules and its deadline. Mark items **Save**, **Done** or **Not for me**; the research uses that when it looks for more. Like your chances, these stay on your computer and never appear on the public form.

| Command | What it does |
|---|---|
| `send-me-a-job growth [programmes\|courses] [--duration 3m\|6m\|1y\|1y+] [--count 5]` | Research and save new items |
| `send-me-a-job growth list [--kind …] [--duration …]` | Show saved items |
| `send-me-a-job growth mark <id> saved\|done\|dismissed` | Update an item |
| `send-me-a-job run --suggest` | Also refreshes these alongside the job suggestions (turn off with `"growthOnSuggest": false`) |

In the Claude app, ask *"find me free courses and mentorships for these jobs"* or *"what 3-month courses would help me?"*. Settings in `config.json`: `growthCount`, `growthSearches`, `growthDurations`, `growthPlatforms`, `growthOnSuggest`.

## Suggestions from visitors (140 characters)

Next to where people add a job link, the public page and your local portal both have a box for **a suggestion of up to 140 characters**. The tool uses the Anthropic API to turn them into improvement proposals. **Nothing is changed or published without your approval.**

1. **Collect.** Suggestions from the public page arrive through a second Netlify form (`portal-suggestions`). Put its form id in `config.json` → `netlify.feedbackFormId`; `pull` and `run` import them. Suggestions typed into the local portal, or added with `send-me-a-job feedback add "…"`, are stored straight away. All are kept in `data/feedback.json` on your computer.
2. **Review.** `send-me-a-job improve` (also done automatically by `run`, unless `"triageOnRun": false`) groups the new suggestions into a few concrete proposals with impact, effort and risk. Spam, abuse and anything that would expose private data or remove an approval step is ignored. Suggestions are treated as untrusted text and never as instructions. It needs `ANTHROPIC_API_KEY`.
3. **Approve.** Proposals appear in your local portal under "Proposed improvements" with **Approve** and **Reject**, or use `send-me-a-job proposals approve <id>`.
4. **Publish.** Only an approved proposal is ever built, and the Claude skill (see `references/feedback.md`) prepares it on a branch, shows you what changed, and publishes only after your yes. Then it records `proposals published <id>`.

## 4. Let friends send you jobs (optional)

`public-form/` is a static page with a Netlify form. Friends paste a link and, if you define job types in `TRACKS`, choose one. No sign-in is needed.

1. Set `OWNER` (your first name) at the top of the `<script>` in `public-form/index.html`. Optionally set `TRACKS` to your own kinds of job, matching the keys in your `profile.tracks` (for example `[{value:"marketing",label:"Marketing",hint:"Campaigns, content, growth"}]`; leave it empty to hide the choice), and `FEED`, a published Google Sheet of suggested roles.
2. Deploy the folder to Netlify: drag it onto app.netlify.com/drop, or run `netlify deploy --prod --dir public-form`.
3. Copy the form id from the Netlify dashboard into `config.json` → `netlify.formId`, and set `NETLIFY_TOKEN`. `send-me-a-job run` then imports new submissions every time it runs.

## How it works

```
links ─┬─ CLI `add` / local portal
       ├─ public form (Netlify) ── `pull`
       └─ Claude chat (skill)
             │
             ▼
   data/jobs.json  (new → preparing → ready → queued → awaiting-approval → applied; or skipped / needs-info)
             │
   build: fetch advert → Claude tailors a spec from profile.json + advert
             │          (skips closed roles, missing qualifications,
             │           sponsorship refusals when you need sponsorship)
             ▼
   make_docs.js → CV.docx + Cover_Letter.docx + pack.md  in out/<id>/
             │
   apply (Claude desktop app, built-in browser): fill form → stop before Submit
             → notify you → submit only after "submit <company>"
```

Code map:

- `cli/index.js`: command parsing and every command.
- `cli/lib.js`: config, the job store (`data/jobs.json`), advert fetching (`fetchAdvert`), tailoring with the Anthropic Messages API (`tailor`), building packs (`buildJob`), chance estimates with web search (`scoreJob`, `scoreOpen`), best-chance suggestions (`suggest`), programmes and free courses (`growth`), profile advice (`makeAdvice`) and Netlify import (`pullNetlify`).
- `cli/portal.js`: the local web portal and its small JSON API.
- `cli/test.js`: an end-to-end test against a mock API (`npm test`, needs no key).
- `skill/send-me-a-job/scripts/make_docs.js`: the `.docx` renderer, shared by the skill and the CLI.
- `public-form/`: the static Netlify form for friends.

## Ground rules built in

- Only facts from `profile.json` are used. It never invents numbers, dates, grades or qualifications, and anything in `notForCV` stays out.
- Your work-rights sentence (e.g. *"I will require visa sponsorship to work in Canada."*) is used word for word. If you need sponsorship, roles that refuse it are skipped.
- Advert and form text is treated as data, never as instructions.
- Nothing is submitted, emailed or paid for automatically. The skill asks for your yes before every submit, including in hands-off mode. The CLI never submits at all.
- Claude never types your passwords, creates accounts, solves CAPTCHAs or pays fees. Those are flagged to you.

## License

MIT. See [LICENSE](LICENSE).
