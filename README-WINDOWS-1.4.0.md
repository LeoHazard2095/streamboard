# StreamBoard IPTV Windows v1.4.0

This release is a Windows-focused design refresh and usability pass.

## Highlights

- Cleaner Windows desktop visual system with better contrast and less visual clutter.
- New blue/cyan accent palette replacing the heavy green-first look.
- Simpler navigation labels: Channels, Favorites, Access, Sources, Studio.
- Clearer top-level headings and panel copy.
- Player remains pinned and visible while the channel directory scrolls independently.
- Compact mode retained for smaller windows.
- Playlist Studio and HTTP/HTTPS HLS bridge retained.
- Cumulative desktop source package includes required runtime files.

## Main files changed

- `desktop/src/index.html`
- `desktop/src/style.css`
- `desktop/src/app.js`
- `desktop/package.json`

## Build

In `desktop/`:

```bash
npm install
npm test
npm run dist:win
```

## Notes

This update does not redesign Android yet.
