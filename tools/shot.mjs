// Headless screenshot of a page in this repo, via Microsoft Edge and the DevTools protocol. No dependencies.
//   node tools/shot.mjs --url papercut/index.html --out shot.png   (no leading slash: Git Bash would turn it into a Windows path)
//   --root <dir> serves another folder instead of the repo root.
//   --gpu <high,low> renders on the adapter with that LUID (tools/gpus.py lists them); SOTF_GPU_LUID sets the default.
//   Edge is killed as a whole process tree on exit (taskkill /T); an earlier version left the browser running and its
//   GPU process kept rendering the animations, which pinned the integrated GPU at 100 percent. [--w 1280 --h 900] [--ready "window.__ready"] [--eval "js"] [--timeout 30000]
// Serves the repo root on a free port, opens the page, waits for the --ready expression to be truthy, runs --eval
// (JSON result printed), captures a PNG and prints console messages and page errors.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const ROOT = args.root ? resolve(String(args.root)) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const W = +(args.w || 1280), H = +(args.h || 900), TIMEOUT = +(args.timeout || 30000);
const gpuLuid = args.gpu === true ? '' : (args.gpu || process.env.SOTF_GPU_LUID || '');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data); if (args.verbose) console.error('200', path); }
  catch { res.writeHead(404).end('not found: ' + path); console.error('404', path); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const cdpPort = 9300 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), 'sotf-edge-'));
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check',
  '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--enable-unsafe-swiftshader', '--hide-scrollbars', `--window-size=${W},${H}`,
  ...(gpuLuid ? ['--use-angle=d3d11', `--use-adapter-luid=${gpuLuid}`] : []), 'about:blank'], { stdio: 'ignore' });

let cleaned = false, browserWs = null;
const cleanup = async () => {
  if (cleaned) return; cleaned = true;
  // Ask the browser to close, then make sure. Edge relaunches itself at startup, so the pid Node spawned is long dead:
  // the browser is found by this run's unique profile dir instead.
  try { if (browserWs && browserWs.readyState === 1) { browserWs.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await new Promise(r => setTimeout(r, 500)); } } catch {}
  if (process.platform === 'win32') {
    const tag = profile.split(/[\/]/).pop();
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    await new Promise(r => { const k = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { stdio: 'ignore' }); k.on('exit', r); k.on('error', r); });
  } else { try { edge.kill(); } catch {} }
  server.close();
  for (const wait of [300, 1200, 2500]) { await new Promise(r => setTimeout(r, wait)); if (await rm(profile, { recursive: true, force: true }).then(() => true, () => false)) break; }
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => cleanup().then(() => process.exit(130)));
try {
  let targets = null;
  for (let i = 0; i < 100 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); } catch { await new Promise(r => setTimeout(r, 100)); } }
  const page = targets.find(t => t.type === 'page');
  try { const v = await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json(); browserWs = new WebSocket(v.webSocketDebuggerUrl); await new Promise(r => { browserWs.onopen = r; browserWs.onerror = r; }); } catch {}
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${msg.params.type}] ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`);
    else if (msg.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level !== 'verbose') logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.bringToFront');
  const nav = await send('Page.navigate', { url: `http://127.0.0.1:${port}/${String(args.url || 'index.html').replace(/^\/+/, '')}` });
  if (nav.result?.errorText || nav.error) console.error('navigate:', JSON.stringify(nav.result?.errorText || nav.error));
  const ready = args.ready || 'document.readyState === "complete"';
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < TIMEOUT) { if (await evalJs(`!!(${ready})`)) { ok = true; break; } await new Promise(r => setTimeout(r, 150)); }
  if (!ok) console.error(`not ready after ${TIMEOUT} ms: ${ready}`);
  if (args.eval) { const v = await evalJs(`(async () => { ${args.eval} })()`); console.log('eval:', JSON.stringify(v)); }
  if (args.settle) await new Promise(r => setTimeout(r, +args.settle));
  if (args.out) { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(args.out, Buffer.from(shot.result.data, 'base64')); console.log('wrote', args.out); }
  if (logs.length) console.log(logs.join('\n')); else console.log('(no console output)');
  ws.close();
} finally { await cleanup(); }
