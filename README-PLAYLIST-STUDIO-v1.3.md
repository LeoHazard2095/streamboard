# StreamBoard IPTV Windows v1.3.0 — Playlist Studio

Windows-only update, based on the v1.2 source. Android files, package identifiers and existing playlist sources are preserved.

## What is new

- Sidebar **Playlist Studio** tab. Player stays visible at the left while analyzing sources at the right.
- Six dashboard counters: imported entries, merged channels, backup feeds, uncategorized channels, missing logos and duplicate URLs.
- Per-source and per-category selection for compilation; shows channel counts before export.
- Category cleanup: search for a channel and assign its category, including a custom category. Overrides are stored locally under `categoryOverrides` and retained across refreshes.
- Identity warnings: same name colliding on country/language, and merged feeds that disagree on TV guide IDs. These are **potential** conflicts, not automatic deletions.
- Export M3U playlists or CSV channel reports. Export approved-and-visible only by default; including unapproved channels is an explicit user choice. Can export preferred/first source or all backup streams. Includes source names for backups in M3U output.
- Output from sources must be HTTP(S); exported strings are escaped for M3U attributes and protected against spreadsheet formula injection in CSV exports.
- The exporter opens the Windows native Save dialog, saving files only after user selection. Export size is capped at 24 MB to avoid unbounded IPC and memory use.

## What is NOT claimed

- **No new stream playback health scanner.** A valid playlist entry is not proof of playable video. The counters report metadata only. Do not interpret the dashboard as a live source validation result.
- The tool does not extract/renew authenticated stream tokens, remove DRM, or bypass source access controls.
- Windows installer and real UI playback have not been executed in this environment. GitHub Actions builds the installer for device testing.

## Installation in existing GitHub repository

Upload `StreamBoard-IPTV-Windows-v1.3.0-UPDATE.zip` to the repository root and, in Codespaces, run:

```bash
unzip -o StreamBoard-IPTV-Windows-v1.3.0-UPDATE.zip
rm -f StreamBoard-IPTV-Windows-v1.3.0-UPDATE.zip
git add -A
git commit -m "StreamBoard Windows v1.3 Playlist Studio"
git pull --rebase origin main
git push origin main
```

Go to **GitHub Actions → Build StreamBoard Windows Desktop** to download the installer artifact if the build succeeds.

## Suggested workflow

1. Import and refresh playlists from **Playlists**.
2. Open **Playlist Studio** and review imported, merged and uncategorized counts.
3. Correct `Other`/wrong-category channels in **Category cleanup**.
4. Choose playlist sources and exported categories. By default only channels approved in **Channel access** and in visible categories are exported.
5. Choose whether backup streams should appear as separate M3U entries. Export M3U or CSV to a file of your choice.

## Verification

- `cd desktop && npm test` — unit tests for parsing, merging, analyzer compilation, exporting and HTTP HLS bridge.
- `node --check desktop/src/app.js` — syntax check.
- Compare Windows update archive with v1.2.0 source; verify all Android project entries are unchanged.
