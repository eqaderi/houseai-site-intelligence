/**
 * Automated accessibility smoke checks (P1-09).
 *
 * Serves the dashboard over loopback, drives headless Chrome over CDP, and
 * asserts structural and control accessibility in English and Persian:
 * landmarks, headings, control names/states, table headers, image alts,
 * skip link, dialog affordances, solar aria-valuetext, focus styles, and
 * reduced-motion CSS.
 *
 * Node builtins only. Requires Chrome ($CHROME_BIN or macOS default).
 * Exits 1 on the first failing language pass.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(scriptDir, "..");

const CHROME_BIN =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!fs.existsSync(CHROME_BIN)) {
  console.error(
    `verify-accessibility.mjs: Chrome not found at ${CHROME_BIN}\n` +
      "Set CHROME_BIN to a Chrome/Chromium binary to run this check.",
  );
  process.exit(1);
}

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
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.resolve(dashboardDir, `.${rel}`);
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

let chrome = null;
let debugPort = 0;

const cleanup = () => {
  if (chrome && chrome.exitCode === null) chrome.kill();
  server.close();
};

async function launchChrome() {
  debugPort = 9400 + Math.floor(Math.random() * 300);
  const profileDir = path.join(os.tmpdir(), `houseai-a11y-${process.pid}`);
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
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // retry
    }
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
          return {
            error: String(
              r.exceptionDetails.exception?.description || r.exceptionDetails.text,
            ),
          };
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

const AUDIT = `(() => {
  const issues = [];
  const note = (ok, label, detail = '') => {
    if (!ok) issues.push(detail ? label + ': ' + detail : label);
  };

  note(Boolean(document.querySelector('main')), 'main landmark present');
  note(Boolean(document.querySelector('header')), 'header landmark present');
  note(document.querySelectorAll('nav').length >= 1, 'nav landmark present');
  note(Boolean(document.querySelector('a.skip-link, .skip-link')), 'skip link present');
  note(Boolean(document.querySelector('h1')), 'page has h1');
  const sectionHeads = [...document.querySelectorAll('main section.section > header h2, main section.section > .section-header h2, main .section-header h2')];
  // Sections use h2; nested cards may use h3/h4 without intermediate levels.
  note(sectionHeads.length >= 8, 'major sections expose h2 titles', String(sectionHeads.length));

  const nameless = [];
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!name) nameless.push(el.id || el.className || el.tagName);
  }
  note(nameless.length === 0, 'every button has an accessible name', nameless.slice(0, 5).join(', '));

  const pressed = document.querySelectorAll('[aria-pressed]');
  note(pressed.length >= 8, 'segmented controls expose aria-pressed', String(pressed.length));
  const activePressed = [...document.querySelectorAll('button.active[aria-pressed="true"], .active[aria-pressed="true"]')];
  note(activePressed.length >= 1, 'at least one active control reports aria-pressed true');

  const tables = [...document.querySelectorAll('table')];
  note(tables.length >= 3, 'data tables present');
  const tablesWithoutTh = tables.filter((table) => table.querySelectorAll('th').length === 0).length;
  note(tablesWithoutTh === 0, 'every table has header cells');

  const imgs = [...document.querySelectorAll('img')];
  const missingAlt = imgs.filter((img) => !img.hasAttribute('alt')).map((img) => img.src.split('/').pop());
  note(missingAlt.length === 0, 'every image has an alt attribute', missingAlt.slice(0, 5).join(', '));

  const menu = document.getElementById('menu-toggle');
  note(Boolean(menu && (menu.getAttribute('aria-label') || '').trim()), 'mobile menu has accessible name');

  const solar = document.querySelector('[data-solar-time]');
  const valuetext = solar?.getAttribute('aria-valuetext') || '';
  note(/\\d{1,2}[:：]\\d{2}|[۰-۹]{1,2}[:：][۰-۹]{2}/.test(valuetext), 'solar time has clock aria-valuetext', valuetext);

  const dialog = document.getElementById('lightbox');
  note(Boolean(dialog), 'lightbox dialog present');
  note(Boolean(dialog?.querySelector('.lightbox-close, [aria-label]')), 'lightbox has a close control');

  const cssText = [...document.styleSheets].map((sheet) => {
    try { return [...sheet.cssRules].map((r) => r.cssText).join('\\n'); } catch { return ''; }
  }).join('\\n');
  note(/:focus-visible|:focus\\b/.test(cssText), 'focus styles exist in CSS');
  note(/prefers-reduced-motion/.test(cssText), 'reduced-motion CSS present');

  // Contrast smoke: body text and background are not the same computed colour.
  const body = getComputedStyle(document.body);
  note(body.color !== body.backgroundColor, 'body text colour differs from background');

  return {
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    issues,
    pressedCount: pressed.length,
    tableCount: tables.length,
    imageCount: imgs.length,
  };
})()`;

async function main() {
  const port = await listen();
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  let failures = 0;
  const languages = [
    ["en", "EN"],
    ["fa", "FA"],
  ];

  try {
    const wsUrl = await launchChrome();
    const { send, evaluate, ws } = await connect(wsUrl);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const [lang, label] of languages) {
      await send("Page.navigate", { url: baseUrl });
      await sleep(4000);
      if (lang === "fa") {
        await evaluate(`document.getElementById('language-toggle').click()`);
        await sleep(1500);
      }
      const result = await evaluate(AUDIT);
      if (result.error) {
        console.log(`FAIL  ${label}  — measurement error: ${result.error}`);
        failures += 1;
        continue;
      }
      const { issues, lang: docLang, pressedCount, tableCount, imageCount } = result.value;
      if (issues.length) {
        console.log(`FAIL  ${label} (${docLang})  ${issues.length} issue(s)`);
        for (const issue of issues) console.log(`       - ${issue}`);
        failures += issues.length;
      } else {
        console.log(
          `PASS  ${label} (${docLang})  pressed=${pressedCount} tables=${tableCount} images=${imageCount}`,
        );
      }
    }

    ws.close();
    console.log(
      `\nAccessibility smoke: ${languages.length * 1 - (failures ? 0 : 0)} language pass(es); ${failures} issue(s) total.`,
    );
    if (failures) {
      console.log("Accessibility regression failed.");
      process.exitCode = 1;
    } else {
      console.log("Accessibility regression: 2/2 language checks passed.");
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("verify-accessibility.mjs failed:", err.message);
  cleanup();
  process.exit(1);
});
