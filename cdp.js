#!/usr/bin/env node
// Minimal Chrome DevTools Protocol client - no npm deps (Node 18+ has global WebSocket).
// Usage:
//   node cdp.js tabs                 -> list open tabs
//   node cdp.js eval <file.js> [target] -> evaluate file's JS in a tab, print JSON result
//        <target> is a tab index (0, 1, ...) or a URL substring such as
//        "portal.fraternus.org". Defaults to tab 0.

const PORT = process.env.CDP_PORT || 9222;

async function tabs() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const all = await r.json();
  return all.filter((t) => t.type === 'page');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error('ws error: ' + (e.message || 'unknown')));
  });
}

function send(ws, id, method, params) {
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const [cmd, arg, idxArg] = process.argv.slice(2);
  const pages = await tabs();

  if (cmd === 'tabs' || !cmd) {
    pages.forEach((t, i) => console.log(`[${i}] ${t.title}\n    ${t.url}`));
    return;
  }

  if (cmd !== 'eval') throw new Error('unknown command: ' + cmd);

  // Target may be an index or a URL substring - matching by URL matters when
  // the user has other tabs open.
  let page;
  if (idxArg && !/^\d+$/.test(idxArg)) {
    const matches = pages.filter((t) => t.url.includes(idxArg));
    if (!matches.length) {
      throw new Error(
        `no open tab matching "${idxArg}". Open tabs:\n` +
          pages.map((t, i) => `  [${i}] ${t.url}`).join('\n'));
    }
    page = matches[0];
  } else {
    const idx = Number(idxArg || 0);
    page = pages[idx];
    if (!page) throw new Error(`no tab at index ${idx} (found ${pages.length})`);
  }

  const expression = require('fs').readFileSync(arg, 'utf8');
  const ws = await connect(page.webSocketDebuggerUrl);
  try {
    // Chromium throttles setTimeout to ~1/minute in background tabs, which
    // stalls any script that waits on the page. Focus the tab first.
    try {
      await send(ws, 1, 'Page.bringToFront', {});
    } catch (e) {
      console.error('warning: could not focus tab:', e.message);
    }
    const res = await send(ws, 2, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    if (res.exceptionDetails) {
      console.error('PAGE EXCEPTION:', JSON.stringify(res.exceptionDetails, null, 2));
      process.exit(1);
    }
    const v = res.result.value;
    console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  } finally {
    ws.close();
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  console.error('(Is Chromium running with --remote-debugging-port=' + PORT + '?)');
  process.exit(1);
});
