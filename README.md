# app-common

The master copies of the files every Gluminou app shares, so all the apps follow the same system.

| File here | Copied into each app as | What it does |
| --- | --- | --- |
| `sync.js` | `sync.js` | Sync between devices through a private `Gluminou/<app>-data` repo, one GitHub key per person |
| `updates.js` | `updates.js` | Version number, Check for update, What's new, the update bar |
| `ci/verify.mjs` | `.github/verify.mjs` | CI: syntax, version in step, the page loads without errors or missing files |
| `ci/check-common.mjs` | `.github/check-common.mjs` | CI: this list is respected (shared files identical to the masters, home-screen install complete) |
| `tools/release.mjs` | `tools/release.mjs` | Publishes a version: page, `version.json` and `changelog.json` in step |
| `tools/icons.py` | not copied | Draws home-screen icons in the house style |

`files.json` is the list `check-common.mjs` reads. Each app's CI runs it on every push and goes red when a copy differs from its master, so no app drifts away unnoticed.

## The common system, app by app

Every app has:

- `index.html` (built from a source file when the app has a build step), `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`, and the page links to the manifest and the 180 icon.
- `updates.js`, `version.json`, `changelog.json`, `tools/release.mjs` (with `tools/release.json` when the page has a build).
- `.github/workflows/verification.yml` running `verify.mjs` and `check-common.mjs`, plus any build check of its own.
- When it keeps data on the device: `sync.js`, an `APP_SYNC` declaration in the page and the private repo `Gluminou/<app>-data`. The page redraws when `sync.js` fires a `storage` event for one of its keys.

An app that keeps nothing on the device (Bunbun's week) has no `sync.js`. It gets one, and a data repo, the day it starts saving something.

## Changing a shared file

1. Change it here and push. The tests in `.github/workflows/tests.yml` must pass.
2. Copy it into every app that uses it, then publish each app with `node tools/release.mjs patch "..."`.
3. Until step 2 is done, those apps' CI is red. That is on purpose: it lists what is left to update.

## A new app

1. Copy the files above into the new repo and fill in `APP_SYNC` if it keeps data.
2. Draw its icons: `python3 tools/icons.py <app> <repo folder>` after adding a drawing to `icons.py`.
3. Glums creates `Gluminou/<app>-data` (private) and ticks it on the keys of the people who should open the app.

## Tests

```
node test/merge.test.mjs     # merge rules of sync.js
node test/e2e.mjs            # two simulated devices against a fake GitHub (needs Playwright)
```
