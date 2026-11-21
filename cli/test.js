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
      assert.ok(body.system.includes("ONLY facts in the profile"));
      const skip = body.messages[0].content.includes("/job-skip");
      const out = skip ? { decision: "skip", reason: "Cannot sponsor visas", company: "No Sponsor Ltd", role: "Analyst" }
        : { decision: "build", reason: "Good fit", company: "Example Co", role: "Marketing Executive", track: "business", location: "London", deadline: "1 Feb 2027", sponsorship: "unknown", gaps: [], screeningQuestions: [], spec };
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
    console.log(await run("list"));
    console.log(await run("mark", ready.id, "applied"));

    // Portal API
    const portal = require("./portal");
    process.chdir(tmp);
    const srv = portal.serve(require("./lib").loadConfig(), 0);
    await new Promise(r => srv.on("listening", r));
    const pb = `http://127.0.0.1:${srv.address().port}`;
    assert.ok((await (await fetch(pb + "/")).text()).includes("Send me a job"));
    const list = await (await fetch(pb + "/api/jobs")).json();
    assert.strictEqual(list.length, 2);
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
