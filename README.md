# StreamBoard IPTV — v1.0.0

Standalone Android IPTV app for user-supplied, authorized M3U or direct HLS M3U8 URLs. **This is separate from Cartoon Club.**

## Built in

- Two starter sources: the BDIX and VIP playlist URLs supplied in the conversation.
- Add/remove independent playlist URLs, refresh all or one at a time; failed refresh preserves cached entries.
- Parse M3U channel metadata (tvg-id, logo URL, language, country, group-title), ignore VIP faux section headers, support relative stream URLs and direct HLS M3U8 inputs.
- Merge matching channels across playlists by tvg-id or normalized name while preventing known country/language conflicts. Same stream URL is deduplicated. One channel can have multiple alternative URLs.
- **Default-deny:** imported channels are not playable until the user explicitly allows them in Channels. Individual category visibility is independent and required for playback. Search, category filter, approve/block matching channels in bulk.
- Choose a channel's preferred source or let the app use the playlist order.
- Media3 ExoPlayer handles HLS and other supported media. Failover on playback error, stream ended or **30 seconds of buffering**, one attempt per source (no infinite loop). Manual next and source selection are available.
- Check a channel's sources from the Channels menu, or check approved channels from Watch. Tests identify network/HLS manifest reachability, not whether the *correct programme* is on-screen.
- Cached channel list and preferences stored locally. Requests run off the UI thread.

## Build APK in GitHub without Android Studio

1. Extract this ZIP and upload **all its contents**, including `.github/workflows/build-android.yml`, into a NEW GitHub repository's root. Or upload the ZIP into the repository and extract it using Codespaces with `unzip -o StreamBoard-IPTV-v1.0.0-SOURCE.zip` (then copy the extracted folder contents to the root if necessary).
2. Commit to `main`.
3. Open GitHub **Actions → Build StreamBoard IPTV Android → Run workflow**.
4. The workflow runs Java parser/failover tests, then builds the APK. Download artifact **StreamBoard-v1.0.0-TEST-APK** (the APK is inside the artifact ZIP).
5. Install the TEST APK. Open **Playlists** and tap **Refresh all** (this also happens on first launch). Then go to **Channels** to enable categories and approve channels. Go to **Watch** to play.

### Stable update signing (optional, recommended)

The default debug APK uses an ephemeral signer. Installing a subsequent debug build may produce a *package signature conflict* and require an uninstall (which loses app data).

To create one permanent owner-controlled key in Codespaces:

```bash
keytool -genkeypair -v -keystore streamboard-release.jks -storetype PKCS12 -alias streamboard -keyalg RSA -keysize 3072 -validity 10000
base64 -w0 streamboard-release.jks
```

Save the .jks securely **outside** the repository and make a backup. Do not commit or share it. In GitHub **Settings → Secrets and variables → Actions**, configure:

- `STREAMBOARD_KEYSTORE_B64`: the Base64 output of your JKS file.
- `STREAMBOARD_STORE_PASSWORD`: the keystore password.
- `STREAMBOARD_KEY_ALIAS`: `streamboard`.
- `STREAMBOARD_KEY_PASSWORD`: the private key password (often same as store password).

Run the workflow again. You'll also get `StreamBoard-v1.0.0-SIGNED-RELEASE-APK`. Always use the **same** signing key to install future updates over this release. A one-time switch from a debug-signed APK to the release-signed APK may require uninstall/reinstall.

## Known limitations / boundaries

- **Full APK compilation and device playback are not verified in this environment:** Android SDK and Gradle are not installed here. GitHub Actions is included to do the build. Local Java parser, category and merge/failover selection tests pass.
- A successful HTTP/HLS check does **not** prove the channel shows its expected programme. In-stream advertising, swapped content and wrong audio languages cannot be reliably determined from a manifest check. Playing ads will not trigger failover if the player sees a healthy stream.
- No login/DRM/geo-restriction circumvention; each alternative is independently playable only with the user's own authorization. Some channels may be blocked, offline, geo-restricted, token-based, or require subscription.
- Source matching is conservative; two channels with different names and missing tvg-id may remain separate. If labels from a source are misleading, correct the category manually.
- No EPG UI, subtitles/quality UI beyond native Media3 controls, background playback service, Chromecast, Android TV Leanback UI, parental PIN, or automated scheduled source checking in this version.
- This app does not host or distribute streams; respect providers' licenses and terms. Do not redistribute channels without permission.
