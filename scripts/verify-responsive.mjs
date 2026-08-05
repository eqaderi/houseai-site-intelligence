/**
 * Automated responsive regression check (P1-10).
 *
 * Launches headless Chrome against the dashboard and asserts the P1-01
 * acceptance at representative widths in both languages:
 *
 *   document.documentElement.scrollWidth <= window.innerWidth
 *
 * at 320, 360, 390, 430, 650, 900, 1180 and 1440 px, in English and Persian.
 * It also scans for elements whose right edge leaves the viewport while not
 * sitting inside a horizontally scrollable container — the class of overflow
 * that readouts and status pills produced before the P1-01 fixes.
 *
 * Node builtins only. Requires Google Chrome to be installed; the binary is
 * looked up from $CHROME_BIN and falls back to the macOS default. Exits 1 on
 * the first failing width/language. The dashboard is served over loopback so
 * the page loads with a real origin; nothing is written and no files change.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");

const CHROME_BIN =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const WIDTHS = [320, 360, 390, 430, 650, 900, 1180, 1440];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!fs.existsSync(CHROME_BIN)) {
  console.error(
    `verify-responsive.mjs: Chrome not found at ${CHROME_BIN}\n` +
      "Set CHROME_BIN to a Chrome/Chromium binary to run this check.",
  );
  process.exit(1);
}

// --- Static file server (loopback only) -------------------------------------
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
  ".dxf": "application/octet-stream",
  ".FCStd": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.resolve(dashboardDir, "." + rel);
  if (!filePath.startsWith(dashboardDir)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

const listen = () =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

// --- CDP client --------------------------------------------------------------
let chrome = null;
let debugPort = 0;

const cleanup = () => {
  if (chrome && chrome.exitCode === null) chrome.kill();
  server.close();
};

async function launchChrome() {
  debugPort = 9300 + Math.floor(Math.random() * 300);
  const profileDir = path.join(
    (await import("node:os")).tmpdir(),
    `houseai-responsive-${process.pid}`,
  );
  fs.rmSync(profileDir, { recursive: true, force: true });
  chrome = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debug target");
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => {
      const send = (method, params = {}) =>
        new Promise((res) => {
          const msgId = ++id;
          pending.set(msgId, res);
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      const evaluate = async (expression) => {
        const r = await send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });
        if (r.exceptionDetails) {
          return { error: String(r.exceptionDetails.exception?.description || r.exceptionDetails.text) };
        }
        return { value: r.result?.value };
      };
      resolve({ send, evaluate, ws });
    };
    ws.onerror = (err) => reject(err);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };
  });
}

// Measure in the live browser: page scrollWidth, and elements whose rect
// leaves the viewport without being inside a horizontal scroll container.
const MEASURE = `(() => {
  const inScroll = (el) => {
    let p = el.parentElement;
    while (p) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll')
          && p.scrollWidth > p.clientWidth + 1) return true;
      p = p.parentElement;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if ((r.right > window.innerWidth + 0.5 || r.left < -0.5) && !inScroll(el)) {
      offenders.push(el.tagName + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 48));
    }
  }
  return {
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
    offenders: offenders.slice(0, 8),
  };
})()`;

async function main() {
  const port = await listen();
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  let failures = 0;

  try {
    const wsUrl = await launchChrome();
    const { send, evaluate, ws } = await connect(wsUrl);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: baseUrl });
    await sleep(9000); // allow data, canvases and 3D to settle

    for (const width of WIDTHS) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(700);
      for (const [lang, label] of [["en", "EN"], ["fa", "FA"]]) {
        // Start the language check from the English page each time: reload is
        // cheaper than reasoning about a previously toggled state.
        await send("Page.navigate", { url: baseUrl });
        await sleep(3500);
        if (lang === "fa") {
          await evaluate(`document.getElementById('language-toggle').click()`);
          await sleep(1200);
        }
        const m = await evaluate(MEASURE);
        if (m.error) {
          console.log(`FAIL  ${width}px ${label}  — measurement error: ${m.error}`);
          failures++;
          continue;
        }
        const ok = m.value.doc <= m.value.inner && m.value.body <= m.value.inner && m.value.offenders.length === 0;
        console.log(
          `${ok ? "PASS" : "FAIL"}  ${width}px ${label}  doc=${m.value.doc} inner=${m.value.inner}` +
            (m.value.offenders.length ? `  offenders: ${m.value.offenders.join(", ")}` : ""),
        );
        if (!ok) failures++;
      }
    }

    ws.close();
    console.log(
      `\nResponsive regression: ${WIDTHS.length * 2 - failures}/${WIDTHS.length * 2} width/language checks passed.`,
    );
    if (failures) process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("verify-responsive.mjs failed:", err.message);
  cleanup();
  process.exit(1);
});
