'use strict';
// Run before building, making incremental-update omissions fail early.
const fs=require('node:fs');const path=require('node:path');
const base=path.resolve(__dirname,'..');
const required=['main.js','preload.js','stream-bridge.js','repo-discovery.js','src/index.html','src/style.css','src/app.js','src/analyzer.js','src/logic.js','src/playlist-worker.js','src/hls.min.js'];
for(const relative of required){const full=path.join(base,relative);if(!fs.existsSync(full)||!fs.statSync(full).size)throw Error('Missing or empty Windows runtime file: '+relative);}
const pkg=require('../package.json');
for(const relative of ['main.js','preload.js','stream-bridge.js','repo-discovery.js'])if(!pkg.build.files.includes(relative))throw Error('Installer files list excludes '+relative);
if(!fs.readFileSync(path.join(base,'src/index.html'),'utf8').includes('id="video"'))throw Error('Player video missing from renderer');
if(!fs.readFileSync(path.join(base,'src/index.html'),'utf8').includes('id="channel-viewport"'))throw Error('Scroll viewport missing');
console.log(`Windows runtime preflight: ${required.length} required files present and packaging list verified.`);
