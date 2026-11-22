// End-to-end self-test. Runs in a temp folder with a mock Anthropic API and a mock job page,
// so it needs no API key and no network. Usage: npm test
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..");
const cli = path.join(__dirname, "index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "smj-"));
const spec = JSON.parse(fs.readFileSync(path.join(repo, "skill/send-me-a-job/templates/spec.example.json"), "utf8"));

const advert = "<html><body><h1>Marketing Executive</h1><p>" + "Example Co is hiring a marketing executive in London. ".repeat(20) + "</p></body></html>";
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/job")) { res.writeHead(200, { "content-type": "text/html" }); return res.end(advert); }
  if (req.url === "/v1/messages") {
    let b = ""; req.on("data", c => b += c); req.on("end", () => {
      const body = JSON.parse(b);
      const chance = (p) => ({ percent: p, low: p - 1, high: p + 2, confidence: "medium", basis: "test base rate", summary: "Test summary.",
        factors: [{ name: "Skills match", score: 60, note: "ok" }], sources: [{ title: "Example", url: "https://example.com/src" }] });
      let out;
      if (body.system.startsWith("CHANCE ESTIMATE")) { assert.ok(body.tools && body.tools[0].type.startsWith("web_search")); out = { chance: chance(4) }; }
      else if (body.system.startsWith("JOB SUGGESTIONS")) out = { suggestions: [
        { company: "Best Co", role: "Trainee", track: "legal", url: "https://best.example/jobs/1", why: "Fits.", sponsorship: "yes", chance: chance(6) },
        { company: "Low Co", role: "Analyst", track: "business", url: "https://low.example/jobs/2", why: "Meh.", sponsorship: "unknown", chance: chance(1) },
        { company: "Dup", role: "Dup", track: "business", url: `http://127.0.0.1:${server.address().port}/job/1`, why: "dup", sponsorship: "yes", chance: chance(9) }] };
      else if (body.system.startsWith("GROWTH SUGGESTIONS")) {
        assert.ok(body.tools && body.tools[0].type.startsWith("web_search"));
        const u = body.messages[0].content, jobId = (u.match(/^([0-9a-f]{8}) \| /m) || [])[1];
        if (u.includes("FIND: mentorship")) out = { items: [
          { title: "Mentoring Scheme", provider: "Example Body", url: "https://body.example/mentor", type: "mentorship", cost: "free", durationMonths: 2, durationLabel: "8 weeks", why: "Fits.", relatesTo: [jobId, "nope"] },
          { title: "Paid Bootcamp", provider: "Pay Co", url: "https://pay.example/camp", type: "internship", cost: "paid", durationMonths: 1 },
          { title: "Long Placement", provider: "Big Co", url: "https://big.example/place", type: "internship", cost: "free", durationMonths: 18, durationLabel: "18 months" },
          { title: "Bad link", provider: "X", url: "javascript:alert(1)", type: "other", cost: "free", durationMonths: 1 }] };
        else out = { items: [
          { title: "Intro Analytics", provider: "Uni", url: "https://uni.example/analytics", type: "certification", cost: "free-to-learn", costNote: "Certificate costs extra", durationMonths: 5, boosts: "resume", relatesTo: [jobId] },
          { title: "Year-long Diploma", provider: "Uni", url: "https://uni.example/diploma", type: "course", cost: "free", durationMonths: 14 }] };
      }
      else if (body.system.startsWith("PROFILE ADVICE")) out = { summary: "Do these.", items: [{ title: "Add figures", detail: "Add real numbers.", why: "Low skills score." }] };
      else {
        assert.ok(body.system.includes("ONLY facts in the profile"));
        const skip = body.messages[0].content.includes("/job-skip");
        out = skip ? { decision: "skip", reason: "Cannot sponsor visas", company: "No Sponsor Ltd", role: "Analyst" }
          : { decision: "build", reason: "Good fit", company: "Example Co", role: "Marketing Executive", track: "business", location: "London", deadline: "1 Feb 2027", sponsorship: "unknown", gaps: [], screeningQuestions: [], spec };
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ content: [{ type: "text", text: "Here it is:\n" + JSON.stringify(out) }] }));
    });
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env, ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: base, NODE_PATH: path.join(repo, "node_modules") };
  const run = (...a) => new Promise((ok, bad) => require("child_process").execFile("node", [cli, ...a], { cwd: tmp, env }, (e, so, se) => e ? bad(new Error(se || e.message)) : ok(so)));
  try {
    console.log(await run("init"));
    // The example profile must be refused until it is replaced.
    await assert.rejects(run("build"), /example profile/);
    const p = JSON.parse(fs.readFileSync(path.join(tmp, "profile.json"), "utf8"));
    p.email = "tester@example.org"; fs.writeFileSync(path.join(tmp, "profile.json"), JSON.stringify(p));

    console.log(await run("add", `${base}/job/1`, "--track", "business"));
    console.log(await run("add", `${base}/job/1/`)); // duplicate after normalising
    console.log(await run("add", `${base}/job-skip`));
    console.log(await run("run"));
    const jobs = JSON.parse(fs.readFileSync(path.join(tmp, "data/jobs.json"), "utf8"));
    assert.strictEqual(jobs.length, 2);
    const ready = jobs.find(j => j.status === "ready"), skipped = jobs.find(j => j.status === "skipped");
    assert.ok(ready && skipped, "one ready, one skipped");
    for (const f of Object.values(ready.files)) assert.ok(fs.statSync(path.join(tmp, f)).size > (f.endsWith(".md") ? 100 : 1000), f);
    assert.strictEqual(ready.chance && ready.chance.percent, 4, "scored after build");
    console.log(await run("suggest", "--count", "2"));
    let all = JSON.parse(fs.readFileSync(path.join(tmp, "data/jobs.json"), "utf8"));
    const sug = all.filter(j => j.status === "suggested");
    assert.strictEqual(sug.length, 1, "only the 6% role passes the 2% minimum; duplicate ignored");
    assert.strictEqual(sug[0].company, "Best Co");
    // Growth: programmes and courses linked to jobs, free only, duration buckets
    console.log(await run("growth"));
    const G = JSON.parse(fs.readFileSync(path.join(tmp, "data/growth.json"), "utf8")).items;
    assert.deepStrictEqual(G.map(g => g.title).sort(), ["Intro Analytics", "Long Placement", "Mentoring Scheme", "Year-long Diploma"], "paid and non-http items dropped");
    const mentor = G.find(g => g.title === "Mentoring Scheme");
    assert.strictEqual(mentor.bucket, "3m");
    assert.strictEqual(mentor.relatesTo.length, 1, "unknown job ids are dropped");
    assert.ok(jobs.some(j => j.id === mentor.relatesTo[0]));
    assert.strictEqual(G.find(g => g.title === "Long Placement").bucket, "1y+");
    assert.strictEqual(G.find(g => g.title === "Intro Analytics").bucket, "6m");
    assert.strictEqual(G.find(g => g.title === "Intro Analytics").cost, "free-to-learn");
    assert.ok(!/legal|law/i.test(JSON.stringify(G)), "no industry assumptions");
    const listed = await run("growth", "list", "--duration", "6m");
    assert.ok(listed.includes("Mentoring Scheme") && listed.includes("Intro Analytics") && !listed.includes("Long Placement"), "6m filter is cumulative");
    assert.ok((await run("growth", "list", "--duration", "1y+")).includes("Year-long Diploma"));
    console.log(await run("growth", "courses", "--duration", "3m")); // mock only returns known urls now: nothing new
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data/growth.json"), "utf8")).items.length, 4, "no duplicates");
    console.log(await run("growth", "mark", mentor.id, "saved"));
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data/growth.json"), "utf8")).items.find(g => g.id === mentor.id).status, "saved");
    console.log(await run("advice"));
    assert.ok(JSON.parse(fs.readFileSync(path.join(tmp, "data/advice.json"), "utf8")).items.length === 1);
    console.log(await run("list"));
    console.log(await run("mark", ready.id, "applied"));

    // Portal API
    const portal = require("./portal");
    process.chdir(tmp);
    const srv = portal.serve(require("./lib").loadConfig(), 0);
    await new Promise(r => srv.on("listening", r));
    const pb = `http://127.0.0.1:${srv.address().port}`;
    const html = await (await fetch(pb + "/")).text();
    assert.ok(html.includes("Send me a job"));
    new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]); // page script parses
    const list = await (await fetch(pb + "/api/jobs")).json();
    assert.strictEqual(list.length, 3);
    assert.ok((await (await fetch(pb + "/api/advice")).json()).items.length === 1);
    const pg = await (await fetch(pb + "/api/growth")).json();
    assert.strictEqual(pg.items.length, 4);
    assert.strictEqual((await (await fetch(`${pb}/api/growth/mark/${mentor.id}/dismissed`, { method: "POST", headers: { origin: pb } })).json()).status, "dismissed");
    assert.strictEqual((await fetch(`${pb}/api/growth/mark/${mentor.id}/bogus`, { method: "POST", headers: { origin: pb } })).status, 400);
    const gr = await (await fetch(pb + "/api/growth/run", { method: "POST", headers: { origin: pb, "content-type": "application/json" }, body: JSON.stringify({ kind: "courses", durations: ["6m"] }) })).json();
    assert.strictEqual(gr.added, 0);
    const add = await (await fetch(pb + "/api/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/careers/1" }) })).json();
    assert.ok(add.added);
    const q = await (await fetch(`${pb}/api/mark/${skipped.id}/awaiting-approval`, { method: "POST", headers: { origin: pb } })).json();
    assert.strictEqual(q.status, "awaiting-approval");
    const dl = await fetch(`${pb}/files/${ready.id}/${path.basename(ready.files.cv)}`);
    assert.strictEqual(dl.status, 200);
    assert.strictEqual((await fetch(`${pb}/files/${ready.id}/..%2F..%2Fprofile.json`)).status, 404);
    assert.strictEqual((await fetch(pb + "/api/add", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" })).status, 403);
    srv.close();

    console.log("\nAll tests passed.");
    server.close();
  } catch (e) { console.error("TEST FAILED:", e.message); server.close(); process.exit(1); }
});
