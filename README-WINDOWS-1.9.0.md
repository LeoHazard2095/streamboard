# StreamBoard Windows v1.9.0 — Stream Checks

Adds bounded stream HTTP/manifest inspection from **Playlists → selected source → Test 25 URLs**.

- Samples up to 25 unique URLs per selected playlist, at most 3 concurrent requests, 8-second per-request timeout.
- Recognizes HLS and DASH manifest responses, HTML/JSON login pages, HTTP 401/403/404/410/429, and network timeouts.
- Flags protected entries *without* trying to play them or bypass DRM. Special request headers are not reconstructed or transmitted.
- Results are temporary and not interpreted as successful video playback.
- Existing v1.8.0 parser, editor, favorites, approvals, source refresh and playlist exports retained.

## Important
Zio TV's generated playlists use signed MPEG-DASH/ClearKey and may require playback from India through a compatible authorized player. A server response or a parsed manifest does not prove usable video or rights to access it.

TechBoard TV's scheduled remote-file channel mode and WordPress paywall remain distinct projects, not features of this Windows IPTV update.

### Source verification
`bash VERIFY_WINDOWS_UPDATE.sh`
