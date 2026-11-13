# StreamBoard IPTV Windows v1.7.0 — Channel URL Manager

## New features
- Search all saved channels with **Manage URLs**, including channels not approved for watching.
- Edit imported stream URLs and their labels from the player, channel directory, or Access screen.
- Add multiple manual backup sources to a channel.
- Remove streams, restore a replaced imported stream, and keep edits after refreshing playlists.
- Player source selector and fallback immediately use new source links.
- Manual backup streams are included in Playlist Studio exports when alternative sources are selected.
- Source playlist cache remains untouched. Edits are saved as per-channel overrides in catalog-v1.json.
- Editing a currently playing URL switches playback to a viable refreshed source if needed.

## Using the editor
1. Open **Channels > Manage URLs**, type part of a channel name and select the match.
2. Each saved stream shows its label and URL; change either and choose **Save changes**.
3. Choose **+ Add stream URL** to add a backup. Stream URLs must start with http:// or https://.
4. Use **Remove** to hide an imported source or delete a manual one. Replaced imported streams have **Restore imported URL**.
5. The same editor is available using **Edit** on channel rows and **Edit URLs** under the player.
6. To export custom streams, open Playlist Studio and check **Export backup stream URLs too**.

## Build / verification
```bash
bash VERIFY_WINDOWS_UPDATE.sh
```
The preflight intentionally allows hls.min.js to be added by npm during GitHub Actions.
Actual EXE playback and the UI have not been device-tested in this environment.

## Known limitations
- Channel identity is based on the existing merged-name ID; a playlist rename can change that ID, so it may require manually assigning the override again.
- This update does not add MPEG-DASH decoding.
- Removing every feed from an imported channel leaves the entry in the catalog, but it cannot play until you add a URL.
