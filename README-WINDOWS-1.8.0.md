# StreamBoard IPTV Windows v1.8.0 — parser and Zio playlist support

- Improved parsing of extended M3U metadata including `#KODIPROP`, `#EXTVLCOPT` and URL-suffix HTTP header options. Extracts channel source URLs without appending header syntax to URLs.
- Recognizes DASH versus HLS using format metadata even for extensionless streaming endpoints; distinguishes DRM-protected entries from ordinary HLS.
- Playlist inspection reports the number of protected DASH entries and entries that specify request headers.
- Source manager now offers quick import/refresh of Zio TV's English, Hindi, All, Kids Hindi and Custom playlist files. Existing sources are refreshed instead of duplicated.
- HLS-only playlist export uses explicit format hints. Protected DASH streams are skipped by the embedded HLS player with a clear reason; no claim of ClearKey playback, license handling, geo-unblocking or signed URL renewal.
- No automated network stream checker was added. Format classification is not a live playback test.

## Quality checks
Run `bash VERIFY_WINDOWS_UPDATE.sh`. Local source unit tests cover metadata safety, stream URL suffix parsing, and format-aware exports. Windows GUI and live playback must be tested on Windows after GitHub Actions builds the installer.

## Zio notes
Zio TV generates M3U playlists periodically. These primarily reference signed MPEG-DASH streams. Their metadata includes ClearKey and request headers which StreamBoard currently does not consume for playback. Use an authorized compatible player for these feeds; a playlist import alone cannot prove playback.
