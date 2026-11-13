# StreamBoard Windows v1.7.1 — Compact Channel Browser

Focused desktop UI update on top of v1.7.0.

- Compact 64px channel rows; virtualized row heights stay synchronized.
- Channel actions now fit within each row, with no floating play controls.
- Search, category filter and Manage URLs share a consistent toolbar at desktop widths.
- Click a row to play; use Edit to manage URLs; use star for favorites.
- A play overlay appears on the channel logo when hovering.
- Keyboard focus is visible, selected channel stays highlighted, existing channel management is unchanged.

## Build

Run `bash VERIFY_WINDOWS_UPDATE.sh` and push to GitHub Actions. The packaged Windows app and live playback were not verified on a Windows device.
