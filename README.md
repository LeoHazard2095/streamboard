**Latest Windows version: v1.6.0** — see README-WINDOWS-1.6.0.md for diagnostics and recovery changes.

# StreamBoard IPTV — Windows v1.5.0 focused workspace

**Windows v1.5.0** redesigns the UI around separate task-specific workspaces rather than one crowded player-plus-management panel. It preserves the existing Windows application identity, catalog settings, HTTP/HTTPS HLS bridge, Playlist Studio and pinned playback.

**Android source is unchanged.** Android stability improvements are deferred until Windows is visually approved; the Cartoon Network Android crash remains unverified.

## Windows update

Use `StreamBoard-IPTV-Windows-v1.5.0-CUMULATIVE-UPDATE.zip` in your existing `streamboard` GitHub repository. See `README-WINDOWS-1.5.0.md` for commands and test status. The update contains the full Windows desktop runtime, so it can be applied even if prior incremental Windows versions were skipped.

## Main screens

- **Channels:** live viewing, channel browser and category dropdown. Player remains visible while scrolling.
- **Favorites:** your saved and approved channels.
- **Access:** channel permissions with a vertical category selector; explicit approvals retained.
- **Sources:** full-width list of imported playlists, selected-source details, and expandable import controls.
- **Playlist Studio:** full-width analyzer for correcting categories, auditing sources, and exporting M3U/CSV.

During playback, a compact player stays visible above the management screens and an **Open player** action returns to Channels. When no video is playing, management screens use the entire available workspace.

## Existing core capabilities

The Android project and Windows desktop source are independent builds. The desktop includes a local loopback HLS bridge for authorized HTTP and HTTPS streams, multiple sources per channel, backup-source failover, favorites, approvals, playlist import and GitHub M3U discovery.

## Verification

`cd desktop && npm test` tests the parser, merges, compiler, HLS bridge and UI structure. `bash VERIFY_WINDOWS_UPDATE.sh` checks the cumulative desktop runtime source. GitHub Actions builds Windows installers and verifies packaged modules. A real Windows installer and live playback test are still required after a green build.
