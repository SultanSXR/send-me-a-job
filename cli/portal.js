// Local portal: a small web page on http://127.0.0.1:<port> to add links,
// build packs, download documents and track status. Listens on localhost only.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const lib = require("./lib");

const PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Send me a job — portal</title>
<style>
:root{--bg:#f7f4ee;--card:#fffdf9;--ink:#1f1d1a;--muted:#6d675e;--line:#e6dfd3;--accent:#1d4d4f;--err:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#151413;--card:#1e1c1a;--ink:#f1ede6;--muted:#a49d92;--line:#34302b;--accent:#5fa3a5;--err:#f2b8b5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:36px 16px 80px}h1{margin:0 0 4px;font-size:28px}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
form{display:grid;grid-template-columns:1fr 140px auto;gap:8px}@media(max-width:600px){form{grid-template-columns:1fr}}
input,select{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:8px 14px;background:var(--accent);color:#fff;cursor:pointer}
button.ghost{background:transparent;color:var(--accent);border:1px solid var(--line)}button:disabled{opacity:.5}
.job{display:grid;gap:4px;border-top:1px solid var(--line);padding:12px 0}.job:first-child{border-top:0}
.t{font-weight:600}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pill{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 8px}
a{color:var(--accent)}.err{color:var(--err)}
</style></head><body><div class="wrap">
<h1>Send me a job</h1><p class="muted">Your jobs, stored on this computer in data/jobs.json. Packs are built with your Anthropic API key.</p>
<div class="card"><form id="add"><input name="url" type="url" required placeholder="Paste a job link"><select name="track"><option value="">Track: auto</option><option value="legal">Legal</option><option value="business">Business</option></select><button>Add</button></form><div id="msg" class="muted"></div></div>
<div class="card" id="list">Loading…</div></div>
<script>
const $=s=>document.querySelector(s);
function el(t,p,...k){const e=document.createElement(t);for(const[a,v]of Object.entries(p||{})){if(a==="text")e.textContent=v;else e.setAttribute(a,v)}k.forEach(x=>x&&e.append(x));return e}
async function api(p,o){const r=await fetch(p,o);const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j}
async function load(){const jobs=await api("/api/jobs");const L=$("#list");L.textContent="";
 if(!jobs.length){L.append(el("p",{class:"muted",text:"No jobs yet. Paste a link above."}));return}
 for(const j of jobs.slice().reverse()){const row=el("div",{class:"row"},el("span",{class:"pill",text:j.status}),el("span",{class:"pill",text:j.track||"track: auto"}));
  if(j.status==="new"){const b=el("button",{text:"Build pack"});b.onclick=async()=>{b.disabled=true;b.textContent="Building…";try{await api("/api/build/"+j.id,{method:"POST"})}catch(e){alert(e.message)}load()};row.append(b)}
  if(j.files){for(const[k,v]of Object.entries(j.files))row.append(el("a",{href:"/files/"+j.id+"/"+v.split(/[\\\\/]/).pop(),text:k}))}
  if(j.status==="ready"){const b=el("button",{class:"ghost",text:"Mark applied"});b.onclick=async()=>{await api("/api/mark/"+j.id+"/applied",{method:"POST"});load()};row.append(b)}
  L.append(el("div",{class:"job"},el("div",{class:"t"},el("a",{href:j.url,target:"_blank",rel:"noopener",text:j.company?j.company+" – "+j.role:j.url})),j.summary?el("div",{class:"muted",text:j.summary}):null,row))}}
$("#add").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{const r=await api("/api/add",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)});$("#msg").textContent=r.added?"Added.":"Already in your list.";e.target.reset();load()}catch(x){$("#msg").textContent=x.message}};
load();
</script></body></html>`;

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((ok, bad) => { let b = ""; req.on("data", c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); });
}

function serve(cfg, port) {
  const server = http.createServer(async (req, res) => {
    try {
      // Only accept same-origin requests to the local API.
      if (req.method !== "GET" && req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)) return send(res, 403, { error: "forbidden" });
      const u = new URL(req.url, "http://x");
      if (req.method === "GET" && u.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");
      if (req.method === "GET" && u.pathname === "/api/jobs") return send(res, 200, lib.readJobs(cfg).map(({ advertText, ...j }) => j));
      if (req.method === "POST" && u.pathname === "/api/add") { const b = await readBody(req); return send(res, 200, lib.addJob(cfg, { url: b.url, track: b.track, source: "portal" })); }
      let m;
      if (req.method === "POST" && (m = u.pathname.match(/^\/api\/build\/([\w-]+)$/))) {
        const job = lib.readJobs(cfg).find(j => j.id === m[1]);
        if (!job) return send(res, 404, { error: "not found" });
        const done = await lib.buildJob(cfg, lib.loadProfile(cfg), job);
        return send(res, 200, done || lib.readJobs(cfg).find(j => j.id === m[1]));
      }
      if (req.method === "POST" && (m = u.pathname.match(/^\/api\/mark\/([\w-]+)\/(\w+)$/))) {
        if (!lib.STATUSES.includes(m[2])) return send(res, 400, { error: "bad status" });
        return send(res, 200, lib.updateJob(cfg, m[1], { status: m[2], ...(m[2] === "applied" ? { appliedAt: Date.now() } : {}) }));
      }
      if (req.method === "GET" && (m = u.pathname.match(/^\/files\/([\w-]+)\/([\w.-]+)$/))) {
        const file = path.resolve(process.cwd(), cfg.outputDir, m[1], m[2]);
        if (!file.startsWith(path.resolve(process.cwd(), cfg.outputDir) + path.sep) || !fs.existsSync(file)) return send(res, 404, { error: "not found" });
        res.writeHead(200, { "content-type": m[2].endsWith(".md") ? "text/markdown; charset=utf-8" : "application/octet-stream", "content-disposition": `attachment; filename="${m[2]}"` });
        return fs.createReadStream(file).pipe(res);
      }
      send(res, 404, { error: "not found" });
    } catch (e) { send(res, 400, { error: e.message }); }
  });
  server.listen(port, "127.0.0.1", () => console.log(`Portal running at http://127.0.0.1:${server.address().port}  (Ctrl+C to stop)`));
  return server;
}

module.exports = { serve };
