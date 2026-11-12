# StreamBoard IPTV Windows v1.6.1 — Playlist compatibility & format clarity

- Existing GitHub .m3u or .m3u8 sources now refresh rather than being rejected as duplicate in the Add Playlist and GitHub discovery workflows.
- VIP KB Pro is **already** one of the built-in source URLs, so select it under Playlists and Refresh it.
- Playlist inspection now counts HLS, DASH, MP4, TS, and other stream URLs.
- Playlist Studio shows the number of HLS and DASH feed entries.
- Optional **HLS-only** export removes `.mpd` and other feed formats and can select an HLS backup even if the preferred feed is DASH.
- DASH feeds are identified as unsupported by the embedded HLS player and are skipped in favor of other feeds; play DASH externally in VLC.
- No streams are asserted as verified playable without testing on a real device.
- Existing saved channel data, approvals, favorites, and playlist sources remain intact.

## Commands after uploading ZIP to Codespaces root

```bash
unzip -o StreamBoard-IPTV-v1.6.1-COMPLETE-SOURCE.zip
rm StreamBoard-IPTV-v1.6.1-COMPLETE-SOURCE.zip
bash VERIFY_WINDOWS_UPDATE.sh
git add -A
git commit -m "StreamBoard v1.6.1 playlist compatibility and format analysis"
git push origin main
```

GitHub Actions produces the Windows installer. The source does not include node_modules or a pre-built Windows installer.
