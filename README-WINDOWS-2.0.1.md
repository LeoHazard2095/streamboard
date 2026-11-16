# StreamBoard IPTV for Windows — v2.0.1

## Network compatibility update

- Playlist import first uses Electron `net.fetch` with a VLC-compatible User-Agent. If transport fails, Node.js HTTP(S) retries once with redirects, timeout and a 16 MB hard size limit. An HTTP 4xx, invalid playlist, or oversized response is not retried automatically. A failed refresh retains previously imported channels.
- Sources status records whether Electron or Node HTTP downloaded a playlist.
- The M3U parser now reads `http-user-agent` and `http-referrer` (or `http-referer`) from `#EXTINF`, supported `#EXTVLCOPT` directives, and `|`-suffixed URL options. Accepted values are attached to the associated channel, persisted, and forwarded via the local HLS bridge for manifest and segment downloads.
- For safety, only `User-Agent` and `Referer` can be forwarded. Credential-bearing arbitrary headers (e.g. Cookie/Authorization) are never imported or forwarded. Requests can still fail because of unsupported codecs, DRM, geo-restrictions, or unavailable streams.
- New tests cover fallback downloading, redirects, header parsing/isolation and bridge forwarding.

## Build from GitHub

After uploading this complete source ZIP to the repository root, synchronize and extract it, run `bash VERIFY_WINDOWS_UPDATE.sh`, then commit and push. The GitHub Actions Windows workflow builds an installer named `StreamBoard-IPTV-Setup-2.0.1.exe` within the artifact `StreamBoard-v2.0.1-Windows-Installer`.

No packaged Windows application or live server playback was tested on a Windows device here.
