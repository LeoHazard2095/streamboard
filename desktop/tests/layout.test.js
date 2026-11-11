'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8');
test('Playback video is outside the scrollable channel directory and survives tab changes',()=>{
 const html=src('index.html');const stream=html.indexOf('id="video"'),viewport=html.indexOf('id="channel-viewport"'),watch=html.indexOf('class="watch-area"'),explorer=html.indexOf('class="explorer"');
 assert.ok(stream>watch&&stream<explorer);assert.ok(viewport>explorer);
 const js=src('app.js');const start=js.indexOf('function switchTab('),end=js.indexOf('function inspect(',start);
 assert.ok(start>=0&&end>start);assert.doesNotMatch(js.slice(start,end),/\b(?:stop|openFeed|play)\s*\(/);
});
test('Video remains docked during channel-list scrolling and compact mode is accessible',()=>{
 const style=src('style.css'),html=src('index.html');
 assert.match(style,/\.watch-layout\s*\{[^}]*min-height:0/);assert.match(style,/\.list-viewport\s*\{[^}]*overflow:auto/);
 assert.match(html,/id="compact-view"[^>]*aria-pressed="false"/);assert.match(src('app.js'),/setCompactPlayer\(/);
 assert.match(style,/@media\(max-width:980px\)[\s\S]*\.watch-layout\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto minmax\(0,1fr\)/);
});
test('Windows runtime files are included in update files list',()=>{
 const pkg=require('../package.json');assert.ok(pkg.build.files.includes('stream-bridge.js'));assert.ok(pkg.build.files.includes('repo-discovery.js'));
});
