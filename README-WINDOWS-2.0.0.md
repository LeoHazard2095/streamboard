# StreamBoard IPTV v2.0.0 — Stream Check Workspace and Version Naming

This release continues from v1.9.0 with the channel editor, playlist import/export,
Zio playlist presets, player recovery and diagnostics intact.

## Improvements

- GitHub Actions workflow display name no longer hardcodes v1.6.0.
- The downloadable GitHub Actions artifact reads its version from `desktop/package.json`.
- Electron's NSIS installer filename already uses the package version and remains unchanged.
- In-app sidebar now identifies the desktop version as 2.0.0.
- Source stream tester can check 25, 50, or 100 unique URLs with at most 3 concurrent requests.
- Results can be filtered by detected manifests, protected streams, and other outcomes.
- Cancel stops scheduling additional checks; in-flight network probes complete or time out independently.
- Completed results can be exported as CSV, including channel, URL, HTTP status, format and diagnostic detail.
- Results stay visible when returning to a source within the same application session.
- Export values are escaped to prevent accidental CSV spreadsheet formula execution.

## Limitations

- HTTP manifest detection is not video playback verification. Segments, codecs, DRM authorization,
  availability in another location, and long-duration playback are not validated.
- Protected MPEG-DASH/ClearKey entries remain unsupported by the embedded HLS player.
- Stream probing is bounded to 8 seconds per URL; a cancellation does not abort already dispatched requests.
- The ZIP is source code, not a compiled Windows installer.
- Windows GUI and live network behavior need validation on a Windows PC.

## Build / verify in GitHub Codespaces

```bash
git fetch origin
git pull --rebase origin main
unzip -o StreamBoard-IPTV-v2.0.0-COMPLETE-SOURCE.zip
rm -f StreamBoard-IPTV-v2.0.0-COMPLETE-SOURCE.zip
bash VERIFY_WINDOWS_UPDATE.sh
git add -A
git commit -m "StreamBoard v2.0.0 stream check workspace and build versioning"
git push origin main
```

GitHub Actions > **Build StreamBoard Windows Desktop** should produce
`StreamBoard-v2.0.0-Windows-Installer` containing `StreamBoard-IPTV-Setup-2.0.0.exe`.
These are expected filenames and have not been confirmed from a GitHub Actions run.
