'use strict';
// Verify BUILT Windows installer staging archive with the ESM-only @electron/asar v4 API.
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const {listPackage}=await import('@electron/asar');
 const file=path.resolve(__dirname,'../dist/win-unpacked/resources/app.asar');
 if(!fs.existsSync(file))throw Error('Packaged app.asar not found: '+file);
 const entries=new Set(listPackage(file,{}).map(x=>x.replace(/^[/\\]+/, '').replace(/\\/g,'/')));
 const required=['main.js','preload.js','stream-bridge.js','repo-discovery.js','src/index.html','src/style.css','src/workspace.css','src/app.js','src/logic.js','src/analyzer.js','src/playlist-worker.js','src/hls.min.js'];
 for(const name of required)if(!entries.has(name))throw Error('Built app.asar is missing '+name);
 console.log(`Windows installer stage verified: ${required.length} runtime files inside app.asar.`);
})().catch(err=>{console.error(err);process.exitCode=1;});
