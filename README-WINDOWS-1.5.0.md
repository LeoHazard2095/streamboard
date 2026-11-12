# StreamBoard Windows v1.5.0 — Focused workspace redesign

This is a Windows-only, cumulative update based on the complete v1.4.0 source. The Android project is unchanged.

## What changed

- Task-specific desktop layouts: Channels and Favorites retain the large player and channel browser, while Access, Sources, and Playlist Studio use a full-width workspace.
- Player remains mounted when changing pages. While playing, a compact player appears at the top of management screens. When idle, it does not waste management space.
- Playlists: a selectable source list, full-height detail pane, category summary, and actions for the selected playlist. Adding playlists and GitHub discovery are expandable only when needed.
- Channels: category dropdown replaces horizontal-scrolling category chips.
- Access: separate vertical category controls and searchable approval list.
- Playlist Studio: full-width summary, category cleanup and export controls.
- Reduced decorative borders, simpler controls, consistent small navigation icons and clearer page headings.
- Existing local catalog, favorites, approvals, category overrides, preferred sources, HLS bridge, fullscreen and failover logic are preserved.

## Install using GitHub Codespaces

Upload `StreamBoard-IPTV-Windows-v1.5.0-CUMULATIVE-UPDATE.zip` to the root of your `streamboard` repository, then run:

```bash
git pull --rebase origin main
unzip -o StreamBoard-IPTV-Windows-v1.5.0-CUMULATIVE-UPDATE.zip
rm -f StreamBoard-IPTV-Windows-v1.5.0-CUMULATIVE-UPDATE.zip
bash VERIFY_WINDOWS_UPDATE.sh
git add -A
git commit -m "StreamBoard Windows v1.5 focused redesign"
git push origin main
```

Then open GitHub Actions and run `Build StreamBoard Windows Desktop (Clean Workspace v1.5.0)` if it hasn't run automatically. Download the EXE from the resulting Windows installer artifact.

Use the same signing and application identity as your previous Windows installations. Close StreamBoard before installing the update. Settings are stored in the existing Electron userData folder, but back up your playlists before changing installation versions because an in-place install has not been verified on a physical Windows machine here.

## QA and limits

- `npm test`: all 20 automated Node tests passed (includes parser, HLS bridge, compiler, layout and workspace checks).
- Browser-based interaction smoke tests passed with synthetic data: switching sources, adding a playlist, category visibility, channel search, Studio, player DOM preservation, and overflow at 1440px and 1000px widths.
- Static layout screenshots were inspected at 1650×900. They are browser previews with synthetic data, not Windows application or live broadcast screenshots.
- Electron Windows installer compilation and real playback testing have not been performed in this environment. GitHub Actions runs tests, source preflight, packaging and packaged-file verification.
- This version does not fix regional restrictions, unsupported codecs, or the separate Android crash. Those are outside this UI-only release.
