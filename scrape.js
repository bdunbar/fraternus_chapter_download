// Runs inside the logged-in Chromium tab via cdp.js.
// Navigates to MY CHAPTER, hovers every member name, returns the roster as JSON.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => s.toUpperCase().replace(/\s+/g, ' ').trim();

  const findBtn = label =>
    [...document.querySelectorAll('button')].find(b => b.innerText.trim() === label);

  if (!findBtn('MY CHAPTER') && !findBtn('SIGN OUT')) {
    return JSON.stringify({ error: 'not-logged-in', url: location.href });
  }

  // Make sure we're on the chapter roster.
  const h1 = () => (document.querySelector('h1') || {}).innerText || '';
  if (norm(h1()) !== 'MY CHAPTER') {
    const nav = findBtn('MY CHAPTER');
    if (!nav) return JSON.stringify({ error: 'no-my-chapter-nav', url: location.href });
    nav.click();
  }
  for (let i = 0; i < 40 && !document.querySelector('button[class*="decoration-dotted"]'); i++) {
    await sleep(250);
  }

  const popups = () => [...document.querySelectorAll('div[data-state="open"]')]
    .map(p => p.innerText.trim()).filter(t => /EMAIL|PHONE/.test(t));

  const lis = [...document.querySelectorAll('li')].filter(l =>
    l.querySelector('button[class*="decoration-dotted"]') || /\b(ADULT|YOUTH)\b/.test(l.innerText));

  if (!lis.length) return JSON.stringify({ error: 'no-members-found', url: location.href });

  const members = [];
  for (const li of lis) {
    const btn = li.querySelector('button[class*="decoration-dotted"]');
    const liTxt = li.innerText.trim().replace(/\s+/g, ' ');
    const kind = (liTxt.match(/\b(ADULT|YOUTH)\b/) || [])[1] || '';

    if (!btn) {
      members.push({
        name: liTxt.replace(/\s*\b(ADULT|YOUTH)\b\s*$/, '').trim(),
        kind, email: '', phone: '', popup: false,
      });
      continue;
    }

    const name = btn.innerText.trim();
    const r = btn.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2,
                clientY: r.y + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    btn.dispatchEvent(new PointerEvent('pointerover', o));
    btn.dispatchEvent(new PointerEvent('pointerenter', o));
    btn.dispatchEvent(new MouseEvent('mouseover', o));

    // Wait for a popup whose heading matches this button, so we never read a stale one.
    let txt = '';
    for (let i = 0; i < 20; i++) {
      await sleep(60);
      const m = popups().find(t => norm(t.split('\n')[0]) === norm(name));
      if (m) { txt = m; break; }
    }

    const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
    const grab = label => {
      const i = lines.findIndex(l => l.toUpperCase() === label);
      return i >= 0 && lines[i + 1] ? lines[i + 1] : '';
    };

    members.push({
      name, kind: kind || (lines[1] || ''),
      email: grab('EMAIL'), phone: grab('PHONE'), popup: !!txt,
    });

    btn.dispatchEvent(new PointerEvent('pointerleave', o));
    btn.dispatchEvent(new MouseEvent('mouseout', o));
    btn.blur();
    await sleep(40);
  }

  const chapter = (document.querySelector('h2') || {}).innerText || '';
  return JSON.stringify({ chapter: chapter.trim(), scrapedAt: new Date().toISOString(), members });
})()
