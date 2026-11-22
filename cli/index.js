#!/usr/bin/env node
// send-me-a-job command-line tool. Run `send-me-a-job help` for usage.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const lib = require("./lib");

const HELP = `send-me-a-job — collect job links and build a tailored CV + cover letter for each.

Usage:
  send-me-a-job init                     Create config.json and profile.json in this folder
  send-me-a-job add <url> [--track <name from your profile tracks>] [--note "..."] [--text advert.txt]
  send-me-a-job pull                     Import links from your Netlify form (needs NETLIFY_TOKEN)
  send-me-a-job list [--status ready]    Show jobs
  send-me-a-job build [id ...]           Build packs for new jobs (or the ids given)
  send-me-a-job run [--suggest]          pull (if configured) + build + score [+ suggest] — use from cron
  send-me-a-job score [id ...]           Estimate your chance of an offer for open jobs (private)
  send-me-a-job suggest [--count 5]      Find open roles with your best chances, ranked
  send-me-a-job advice                   Profile changes that would raise your chances
  send-me-a-job feedback add "<up to 140 characters>"   Record a suggestion for the portal
  send-me-a-job feedback list            Show suggestions
  send-me-a-job improve                  Turn new suggestions into proposals (uses the Anthropic API; changes nothing)
  send-me-a-job proposals [approve|reject|published <id>]   List proposals, or record your decision
  send-me-a-job growth [programmes|courses] [--duration 3m|6m|1y|1y+] [--count 5]
                                         Find free mentorship/internship programmes and courses/certifications
                                         linked to your jobs (3m = up to 3 months, 1y+ = over a year)
  send-me-a-job growth list [--kind programmes|courses] [--duration 6m]
  send-me-a-job growth mark <id> <status>  Status: ${lib.GROWTH_STATUSES.join(", ")}
  send-me-a-job mark <id> <status>       Set status: ${lib.STATUSES.join(", ")}
  send-me-a-job render <spec.json> [dir] Render a CV + letter from a spec, no API call
  send-me-a-job serve [--port 4321]      Open the local portal in your browser
  send-me-a-job package-skill            Build dist/send-me-a-job-skill.zip for Claude

Environment:
  ANTHROPIC_API_KEY   required for build/run (console.anthropic.com)
  ANTHROPIC_MODEL     optional, overrides config.model
  NETLIFY_TOKEN       optional, for pull/run`;

function flags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { const k = args[i].slice(2); out[k] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true; }
    else out._.push(args[i]);
  }
  return out;
}

async function buildMany(cfg, ids) {
  const profile = lib.loadProfile(cfg);
  let jobs = lib.readJobs(cfg);
  jobs = ids.length ? jobs.filter(j => ids.includes(j.id)) : jobs.filter(j => j.status === "new");
  if (cfg.maxJobsPerRun > 0) jobs = jobs.slice(0, cfg.maxJobsPerRun); // 0 or unset = no limit
  if (!jobs.length) { console.log("No new jobs to build."); return; }
  console.log(`Building ${jobs.length} pack(s)…`);
  for (const j of jobs) await lib.buildJob(cfg, profile, j);
}

async function main() {
  const [cmd = "help", ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const cfg = lib.loadConfig();

  switch (cmd) {
    case "init": {
      const tpl = path.join(__dirname, "..", "skill", "send-me-a-job", "templates", "profile.example.json");
      for (const [src, dst] of [[path.join(__dirname, "..", "config.example.json"), "config.json"], [tpl, "profile.json"]]) {
        if (fs.existsSync(dst)) console.log(`${dst} already exists, left as is`);
        else { fs.copyFileSync(src, dst); console.log(`Created ${dst}`); }
      }
      console.log("Next: replace the example details in profile.json with your own, then set ANTHROPIC_API_KEY.");
      break;
    }
    case "add": {
      const url = f._[0];
      if (!url) throw new Error("Usage: send-me-a-job add <url> [--track <name from your profile tracks>] [--note ...] [--text file]");
      const advertText = typeof f.text === "string" ? fs.readFileSync(f.text, "utf8") : undefined;
      const { job, added } = lib.addJob(cfg, { url, track: f.track, note: typeof f.note === "string" ? f.note : "", advertText });
      if (!added && advertText) lib.updateJob(cfg, job.id, { advertText: advertText.slice(0, 40000), status: "new" });
      console.log(added ? `Added ${job.id}` : `Already listed as ${job.id}${advertText ? " (advert text updated)" : ""}`);
      break;
    }
    case "pull": {
      console.log(`Imported ${await lib.pullNetlify(cfg)} new link(s).`);
      const n = await lib.pullFeedback(cfg); if (n) console.log(`Imported ${n} new suggestion(s).`);
      break;
    }
    case "feedback": {
      const [sub, ...words] = f._;
      if (sub === "add") { const r = lib.addFeedback(cfg, { text: words.join(" "), source: "cli" }); console.log(r.added ? `Recorded ${r.item.id}` : "Already recorded."); break; }
      if (sub === "list" || !sub) {
        const items = lib.readFeedback(cfg).items;
        if (!items.length) { console.log('No suggestions yet. Add one with: send-me-a-job feedback add "..."'); break; }
        for (const i of items) console.log(`${i.id}  ${i.status.padEnd(8)} ${i.source.padEnd(11)} ${i.text}`);
        break;
      }
      throw new Error('Usage: send-me-a-job feedback add "<text>" | feedback list');
    }
    case "improve": await lib.improve(cfg); break;
    case "proposals": {
      const [act, id] = f._;
      if (act) {
        const status = { approve: "approved", reject: "rejected", published: "published" }[act];
        if (!status) throw new Error("Usage: send-me-a-job proposals [approve|reject|published <id>]");
        const p = lib.markProposal(cfg, id, status); console.log(`${p.id} → ${p.status}`); break;
      }
      const items = lib.readProposals(cfg).items;
      if (!items.length) { console.log("No proposals yet. Run: send-me-a-job improve"); break; }
      for (const p of items) console.log(`${p.id}  ${p.status.padEnd(17)} impact ${p.impact}/5 ${p.effort.padEnd(6)} risk ${p.risk.padEnd(6)} ${p.title}\n    ${p.change}`);
      break;
    }
    case "list": {
      const jobs = lib.readJobs(cfg).filter(j => !f.status || j.status === f.status);
      if (!jobs.length) { console.log("No jobs yet. Add one with: send-me-a-job add <url>"); break; }
      for (const j of jobs) console.log(`${j.id}  ${j.status.padEnd(9)} ${(j.track || "?").padEnd(8)} ${j.chance ? String(j.chance.percent).padStart(2) + "%" : "  –"}  ${j.company ? `${j.company} – ${j.role}` : j.url}${j.summary ? "  · " + j.summary : ""}`);
      break;
    }
    case "build": await buildMany(cfg, f._); break;
    case "run": {
      if (cfg.netlify?.formId && process.env.NETLIFY_TOKEN) console.log(`Imported ${await lib.pullNetlify(cfg)} new link(s) from Netlify.`);
      try { const n = await lib.pullFeedback(cfg); if (n) console.log(`Imported ${n} new suggestion(s).`); } catch (e) { console.log(`  ✗ suggestions: ${e.message}`); }
      await buildMany(cfg, []);
      const profile = lib.loadProfile(cfg);
      if (cfg.triageOnRun !== false && lib.readFeedback(cfg).items.some(x => x.status === "new")) {
        try { await lib.improve(cfg); } catch (e) { console.log(`  ✗ review of suggestions: ${e.message}`); } // proposes only; never publishes
      }
      await lib.scoreOpen(cfg, profile);
      if (f.suggest) {
        await lib.suggest(cfg, profile, cfg.suggestCount || 5);
        if (cfg.growthOnSuggest !== false) await lib.growth(cfg, profile); // programmes + courses alongside the suggested jobs
      }
      break;
    }
    case "growth": {
      const [sub, a, b] = f._;
      if (sub === "list") {
        const keys = lib.durationKeys(f.duration);
        const items = lib.readGrowth(cfg).items.filter(i => ["new", "saved", "done"].includes(i.status) && keys.includes(i.bucket) && (!f.kind || i.kind === f.kind));
        if (!items.length) { console.log("Nothing yet. Run: send-me-a-job growth"); break; }
        for (const i of items) console.log(`${i.id}  ${i.status.padEnd(5)} ${i.kind === "courses" ? "course   " : "programme"} ${i.type.padEnd(15)} ${(i.durationLabel || i.bucket).padEnd(14)} ${i.title} — ${i.provider}\n    ${i.url}`);
        break;
      }
      if (sub === "mark") { const i = lib.markGrowth(cfg, a, b); console.log(`${i.id} → ${i.status}`); break; }
      const kind = lib.GROWTH_KINDS.includes(sub) ? sub : undefined;
      if (sub && !kind) throw new Error("Usage: send-me-a-job growth [programmes|courses] [--duration 3m|6m|1y|1y+] [--count N] | growth list | growth mark <id> <status>");
      console.log("Researching programmes and courses linked to your jobs… (this can take a few minutes)");
      const n = await lib.growth(cfg, lib.loadProfile(cfg), { kind, durations: f.duration ? lib.durationKeys(f.duration) : undefined, count: f.count });
      console.log(`Added ${n} item(s). See them with: send-me-a-job growth list`);
      break;
    }
    case "score": await lib.scoreOpen(cfg, lib.loadProfile(cfg), f._); break;
    case "suggest": {
      console.log("Researching roles where your chances are best… (this can take a few minutes)");
      const n = await lib.suggest(cfg, lib.loadProfile(cfg), Number(f.count) || cfg.suggestCount || 5);
      console.log(`Added ${n} suggestion(s). Add one to your jobs with: send-me-a-job mark <id> new`);
      break;
    }
    case "advice": {
      const a = await lib.makeAdvice(cfg, lib.loadProfile(cfg));
      console.log(a.summary + "\n");
      a.items.forEach((i, n) => console.log(`${n + 1}. ${i.title}\n   ${i.detail}${i.why ? "\n   Why: " + i.why : ""}\n`));
      break;
    }
    case "mark": {
      const [id, status] = f._;
      if (!lib.STATUSES.includes(status)) throw new Error(`Status must be one of: ${lib.STATUSES.join(", ")}`);
      lib.updateJob(cfg, id, { status, ...(status === "applied" ? { appliedAt: Date.now() } : {}) });
      console.log(`${id} → ${status}`);
      break;
    }
    case "render": {
      const { render } = require("../skill/send-me-a-job/scripts/make_docs.js");
      const r = await render(JSON.parse(fs.readFileSync(f._[0], "utf8")), f._[1] || ".");
      console.log(r.cv); console.log(r.letter);
      break;
    }
    case "serve": require("./portal").serve(cfg, Number(f.port) || cfg.port); break;
    case "package-skill": {
      const root = path.join(__dirname, "..");
      fs.mkdirSync(path.join(root, "dist"), { recursive: true });
      const zip = path.join(root, "dist", "send-me-a-job-skill.zip");
      if (fs.existsSync(zip)) fs.unlinkSync(zip);
      execFileSync("zip", ["-qr", zip, "send-me-a-job", "-x", "*.DS_Store"], { cwd: path.join(root, "skill") });
      console.log(`Wrote ${path.relative(process.cwd(), zip)}`);
      break;
    }
    default: console.log(HELP);
  }
}

main().catch(e => { console.error("Error: " + e.message); process.exit(1); });
