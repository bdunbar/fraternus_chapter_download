# fraternus_chapter_download

Exports your Fraternus chapter roster from [portal.fraternus.org](https://portal.fraternus.org)
into a [Flocknote](https://flocknote.com)-ready contact import.

The chapter page lists member names; hovering one pops out their email and phone.
There's no export button, so this drives your own logged-in browser, hovers every
name, and writes the result to CSV.

## Why it isn't just a scrape

Youth members don't have their own contact details — their popup shows the
**household account holder's** email and phone. A dad and his two sons are three
roster entries carrying one address.

For a mail list, only the dad is a deliverable contact. So entries are collapsed
to **one row per email address**, preferring an adult as the contact name.
A chapter of ~54 members typically yields ~28 mailable contacts.

Members with no contact info at all are dropped — Flocknote couldn't message
them anyway.

## Requirements

- **Node.js 18+** (`node --version`) — no npm packages needed
- **Python 3.8+**
- **Chromium or Chrome**
- Optional: `pip install openpyxl`, only if you want `.xlsx` output as well as CSV

## Usage

**1. Quit Chromium completely** (check for a tray icon).

**2. Relaunch it with remote debugging enabled.** This reuses your normal
profile, so you stay logged in:

```bash
# Linux (flatpak)
flatpak run org.chromium.Chromium --remote-debugging-port=9222 >/dev/null 2>&1 &

# Linux (apt/dnf)
chromium --remote-debugging-port=9222 >/dev/null 2>&1 &

# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 >/dev/null 2>&1 &

# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**3. Log in to portal.fraternus.org.** Any page will do — the script navigates
to MY CHAPTER itself. Other tabs can stay open; the portal tab is found by URL.

**4. Run it:**

```bash
python3 sync.py
```

Then upload **`flocknote_new.csv`** to Flocknote.

```
python3 sync.py --dry-run           # report only, write nothing
python3 sync.py --reset             # forget history, treat everyone as new
python3 sync.py --template PATH     # point at Flocknote's .xlsx template
```

## Incremental runs

`seen_emails.json` records which addresses have already been exported, so each
run emits only what's new:

```
scraped        : 57 members
mailable       : 29 unique emails
new since last : 1
    + John Smith <john.smith@example.com>

wrote flocknote_new.csv (1 new) <- upload this one
```

If a new family joins with three members sharing one email, that's **one** row to
upload. If nothing changed, the script says so and writes no upload file.

## Check this on every run

The script warns about emails attached only to a YOUTH record:

```
! 2 email(s) attached only to a YOUTH record - the address
  belongs to a parent who is not a chapter member. Check the name:
    parent@example.com  -> listed as Kiddo Lastname
```

That address reaches the parent but is labelled with the child's name. Fix those
by hand before uploading, or your mail merge will greet a mother as her son.

## Output columns

Matches Flocknote's import template: First Name, Last Name, Email, Phone,
Birthday, Home Street, Home City, Home State, Home Zip, Shirt Size, Class Year.

Only the first four are populated. The portal doesn't expose the rest for other
members (they appear only on your own MY PROFILE page), and Flocknote treats
them as paid Flocknote Complete add-on fields regardless.

## Files

| File | Purpose |
|---|---|
| `sync.py` | Main script — scrape, dedupe, write import files |
| `scrape.js` | Runs in the browser tab: hovers every name, returns JSON |
| `cdp.js` | Minimal Chrome DevTools Protocol client, no dependencies |

Generated locally and **git-ignored**, because they contain real contact details
for real people including minors: `roster_raw.json`, `seen_emails.json`,
`flocknote_import.csv`, `flocknote_import.xlsx`, `flocknote_new.csv`.

Keep it that way. If you fork this, check `.gitignore` survived before your
first commit.

## Notes

- Only reads pages you're already logged into and can see yourself. It stores no
  credentials — authentication lives entirely in your browser profile.
- Depends on the portal's current HTML. If Fraternus redesigns the chapter page,
  `scrape.js` will need updating; it fails loudly rather than writing an empty file.
- The script focuses the portal tab before running, because Chromium throttles
  timers in background tabs. Expect it to steal focus for a few seconds.
