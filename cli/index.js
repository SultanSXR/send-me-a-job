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
  send-me-a-job add <url> [--track legal|business] [--note "..."] [--text advert.txt]
  send-me-a-job pull                     Import links from your Netlify form (needs NETLIFY_TOKEN)
  send-me-a-job list [--status ready]    Show jobs
  send-me-a-job build [id ...]           Build packs for new jobs (or the ids given)
  send-me-a-job run [--suggest]          pull (if configured) + build + score [+ suggest] — use from cron
  send-me-a-job score [id ...]           Estimate your chance of an offer for open jobs (private)
  send-me-a-job suggest [--count 5]      Find open roles with your best chances, ranked
  send-me-a-job advice                   Profile changes that would raise your chances
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
  jobs = ids.length ? jobs.filter(j => ids.includes(j.id)) : jobs.filter(j => j.status === "new").slice(0, cfg.maxJobsPerRun);
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
      if (!url) throw new Error("Usage: send-me-a-job add <url> [--track legal|business] [--note ...] [--text file]");
      const advertText = typeof f.text === "string" ? fs.readFileSync(f.text, "utf8") : undefined;
      const { job, added } = lib.addJob(cfg, { url, track: f.track, note: typeof f.note === "string" ? f.note : "", advertText });
      if (!added && advertText) lib.updateJob(cfg, job.id, { advertText: advertText.slice(0, 40000), status: "new" });
      console.log(added ? `Added ${job.id}` : `Already listed as ${job.id}${advertText ? " (advert text updated)" : ""}`);
      break;
    }
    case "pull": console.log(`Imported ${await lib.pullNetlify(cfg)} new link(s).`); break;
    case "list": {
      const jobs = lib.readJobs(cfg).filter(j => !f.status || j.status === f.status);
      if (!jobs.length) { console.log("No jobs yet. Add one with: send-me-a-job add <url>"); break; }
      for (const j of jobs) console.log(`${j.id}  ${j.status.padEnd(9)} ${(j.track || "?").padEnd(8)} ${j.chance ? String(j.chance.percent).padStart(2) + "%" : "  –"}  ${j.company ? `${j.company} – ${j.role}` : j.url}${j.summary ? "  · " + j.summary : ""}`);
      break;
    }
    case "build": await buildMany(cfg, f._); break;
    case "run": {
      if (cfg.netlify?.formId && process.env.NETLIFY_TOKEN) console.log(`Imported ${await lib.pullNetlify(cfg)} new link(s) from Netlify.`);
      await buildMany(cfg, []);
      const profile = lib.loadProfile(cfg);
      await lib.scoreOpen(cfg, profile);
      if (f.suggest) await lib.suggest(cfg, profile, cfg.suggestCount || 5);
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
