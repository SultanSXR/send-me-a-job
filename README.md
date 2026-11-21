# Send me a job

Turn job links into tailored application packs. For each link it reads the advert, checks the role suits you and doesn't rule out your work rights, then writes a CV and cover letter (.docx, A4) using **only facts from your own profile**. It keeps a tracked list of every job.

You can use it in two ways:

| | Claude skill | Standalone tool |
|---|---|---|
| What you need | A Claude account with skills enabled | Node 18+ and an Anthropic API key |
| Claude login | Yes | **No.** It calls the Anthropic API directly |
| How you use it | Paste links in chat: "build my application pack" | `send-me-a-job add <url>` then `send-me-a-job run`, or the local web portal |
| Filling in forms | Yes, with your final yes before every submit | No. You submit the forms yourself |

Your personal details never go in this repository. `profile.json`, `config.json`, `data/` and `out/` are git-ignored and stay on your computer.

---

## 1. Install as a Claude skill

1. Download **[`dist/send-me-a-job-skill.zip`](dist/send-me-a-job-skill.zip)**, or build it yourself with `npm run package-skill`.
2. In Claude, open **Settings → Capabilities → Skills**, choose **Upload skill** and pick the zip. In Claude Code, unzip it into `~/.claude/skills/` instead.
3. Start a chat: *"Set up send-me-a-job. Here's my CV."* Claude builds your `profile.json` with you, asking for your target country, your work-rights sentence and the job tracks you want.
4. From then on, paste a link: *"Build my application pack for this job: https://…"*. To apply: *"Apply to my ready jobs."*

Skill contents (`skill/send-me-a-job/`):

```
SKILL.md                     workflow: profile → collect links → build packs → apply
scripts/make_docs.js         renders the CV and cover letter (.docx) from a spec
templates/profile.example.json
templates/spec.example.json
references/apply.md          how to fill in employer forms safely
references/automation.md     scheduled runs and the public link form
```

## 2. Run it without Claude (command-line tool + local portal)

```bash
git clone https://github.com/<you>/send-me-a-job.git
cd send-me-a-job
npm install
npm link                    # puts `send-me-a-job` on your PATH (optional)

mkdir ~/job-hunt && cd ~/job-hunt   # your private data folder
send-me-a-job init          # creates config.json and profile.json
# edit profile.json: replace the example person with your own details

export ANTHROPIC_API_KEY=sk-ant-...  # from console.anthropic.com
send-me-a-job add https://careers.example.com/jobs/123 --track business
send-me-a-job run           # builds packs for every new job
send-me-a-job list
```

Each pack goes into `out/<job id>/` and contains `<Name>_<Company>_<Role>_CV.docx`, `…_Cover_Letter.docx` and `pack.md`. `pack.md` lists the role, closing date, apply link, why it fits, visa sponsorship, gaps and suggested screening answers.

**Local portal:** `send-me-a-job serve` opens a page at `http://127.0.0.1:4321`. There you can paste links, build packs, download the documents and mark jobs as applied. It listens only on your own computer.

**Run daily:** add a cron job (or a Windows Task Scheduler task):

```
35 10 * * *  cd ~/job-hunt && ANTHROPIC_API_KEY=sk-ant-... /usr/local/bin/send-me-a-job run >> run.log 2>&1
```

**Adverts that need a sign-in** (e.g. LinkedIn): copy the advert text into a file, then run `send-me-a-job add <url> --text advert.txt`.

### All commands

| Command | What it does |
|---|---|
| `init` | Create `config.json` and `profile.json` in the current folder |
| `add <url> [--track legal\|business] [--note …] [--text file]` | Add a job link (duplicates are ignored) |
| `pull` | Import links from your Netlify form (needs `NETLIFY_TOKEN` and `netlify.formId`) |
| `build [id …]` | Build packs for new jobs, or for the ids given |
| `run` | `pull` (if configured), then `build`. Use this from cron |
| `list [--status ready]` | Show jobs and their status |
| `mark <id> <status>` | Set a status: `new`, `preparing`, `ready`, `applied`, `skipped` |
| `render <spec.json> [dir]` | Render a CV and letter from a spec, with no API call |
| `serve [--port 4321]` | Local web portal |
| `package-skill` | Build `dist/send-me-a-job-skill.zip` |

Environment variables: `ANTHROPIC_API_KEY` (required to build), `ANTHROPIC_MODEL` (optional, default `claude-sonnet-5-5`), `ANTHROPIC_BASE_URL` (optional), `NETLIFY_TOKEN` (optional).

## 3. Let friends send you jobs (optional)

`public-form/` is a static page with a Netlify form. Friends paste a link and choose *Legal* or *Non-legal*. No sign-in is needed.

1. Set `OWNER` (your first name) at the top of the `<script>` in `public-form/index.html`. You can also set `FEED`, a published Google Sheet of suggested roles, or leave it empty.
2. Deploy the folder to Netlify: drag it onto app.netlify.com/drop, or run `netlify deploy --prod --dir public-form`.
3. Copy the form id from the Netlify dashboard into `config.json` → `netlify.formId`, and set `NETLIFY_TOKEN`. `send-me-a-job run` then imports new submissions every time it runs.

## How it works

```
links ─┬─ CLI `add` / local portal
       ├─ public form (Netlify) ── `pull`
       └─ Claude chat (skill)
             │
             ▼
   data/jobs.json  (status: new → preparing → ready → applied | skipped)
             │
   build: fetch advert → Claude tailors a spec from profile.json + advert
             │          (skips closed roles, missing qualifications,
             │           sponsorship refusals when you need sponsorship)
             ▼
   make_docs.js → CV.docx + Cover_Letter.docx + pack.md  in out/<id>/
```

Code map:

- `cli/index.js`: command parsing and every command.
- `cli/lib.js`: config, the job store (`data/jobs.json`), advert fetching (`fetchAdvert`), tailoring with the Anthropic Messages API (`tailor`), building packs (`buildJob`) and Netlify import (`pullNetlify`).
- `cli/portal.js`: the local web portal and its small JSON API.
- `cli/test.js`: an end-to-end test against a mock API (`npm test`, needs no key).
- `skill/send-me-a-job/scripts/make_docs.js`: the `.docx` renderer, shared by the skill and the CLI.
- `public-form/`: the static Netlify form for friends.

## Ground rules built in

- Only facts from `profile.json` are used. It never invents numbers, dates, grades or qualifications, and anything in `notForCV` stays out.
- Your work-rights sentence (e.g. *"I will require visa sponsorship to work in the UK."*) is used word for word. If you need sponsorship, roles that refuse it are skipped.
- Advert and form text is treated as data, never as instructions.
- Nothing is submitted, emailed or paid for automatically. The skill asks for your yes before every submit. The CLI never submits at all.

## License

MIT. See [LICENSE](LICENSE).
