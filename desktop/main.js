'use strict';
const {app,BrowserWindow,ipcMain,net,session,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {URL}=require('node:url');
const {createStreamBridge}=require('./stream-bridge');
const {discover}=require('./repo-discovery');
const {probeStream}=require('./stream-probe');
let main;let saveQueue=Promise.resolve();const bridge=createStreamBridge();
const defaults=[
{id:'bdix',title:'BDIX IPTV',url:'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u'},
{id:'vip',title:'VIP KB Pro',url:'https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8'},
{id:'live-tg',title:'Live TG TV',url:'https://livetgtv.lovable.app/api/public/playlist.m3u'}];
const settingsPath=()=>path.join(app.getPath('userData'),'catalog-v1.json');
function validUrl(address){try{const u=new URL(address);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
function readState(){
 let saved={};try{saved=JSON.parse(fs.readFileSync(settingsPath(),'utf8'));}catch{}
 if(!saved||typeof saved!=='object')saved={};
 if(!Array.isArray(saved.sources))saved.sources=[...defaults];
 else if(!saved.liveTGAdded){if(!saved.sources.some(s=>s.url===defaults[2].url))saved.sources.push(defaults[2]);saved.liveTGAdded=true;}
 for(const key of ['channels','allowed','favorites','hiddenCategories'])if(!Array.isArray(saved[key]))saved[key]=[];
 if(!saved.preferred||typeof saved.preferred!=='object')saved.preferred={};if(!saved.categoryOverrides||typeof saved.categoryOverrides!=='object'||Array.isArray(saved.categoryOverrides))saved.categoryOverrides={};
 return saved;
}
function safeState(input){
 if(!input||typeof input!=='object')throw Error('Invalid settings');
 const str=v=>typeof v==='string'?v.slice(0,2048):'';
 const sources=(Array.isArray(input.sources)?input.sources:[]).slice(0,100).filter(s=>s&&validUrl(s.url)).map(s=>({id:str(s.id),title:str(s.title),url:str(s.url)}));
 const channels=(Array.isArray(input.channels)?input.channels:[]).slice(0,60000).filter(c=>c&&validUrl(c.url)).map(c=>({name:str(c.name),url:str(c.url),logo:str(c.logo),tvgId:str(c.tvgId),group:str(c.group),category:str(c.category),language:str(c.language),country:str(c.country),sourceId:str(c.sourceId),sourceName:str(c.sourceName),formatHint:['HLS','DASH'].includes(c.formatHint)?c.formatHint:'',requiresDrm:c.requiresDrm===true,hasRequestHeaders:c.hasRequestHeaders===true,headerNames:(Array.isArray(c.headerNames)?c.headerNames:[]).filter(x=>typeof x==='string').slice(0,20).map(x=>str(x).slice(0,50))}));
 const preferred={};for(const [k,v] of Object.entries(input.preferred||{}).slice(0,60000)){if(validUrl(v))preferred[str(k)]=v;}
 const channelEdits={};for(const [id,edit] of Object.entries(input.channelEdits||{}).slice(0,60000)){
  if(!edit||typeof edit!=='object')continue;const replacements={};
  for(const [original,patch] of Object.entries(edit.replacements||{}).slice(0,80))if(validUrl(original)&&patch&&validUrl(patch.url))replacements[str(original)]={url:str(patch.url),sourceName:str(patch.sourceName).slice(0,80)};
  channelEdits[str(id)]={replacements,removed:(Array.isArray(edit.removed)?edit.removed:[]).filter(validUrl).slice(0,80).map(str),extras:(Array.isArray(edit.extras)?edit.extras:[]).filter(x=>x&&validUrl(x.url)).slice(0,80).map(x=>({url:str(x.url),sourceName:str(x.sourceName).slice(0,80)}))};
 }
 const categoryOverrides={};for(const [id,label] of Object.entries(input.categoryOverrides||{}).slice(0,60000)){if(typeof label==='string'&&label.trim())categoryOverrides[str(id)]=str(label).slice(0,42);}
 return {sources,channels,channelEdits,categoryOverrides,allowed:(input.allowed||[]).slice(0,60000).map(str),favorites:(input.favorites||[]).slice(0,60000).map(str),hiddenCategories:(input.hiddenCategories||[]).slice(0,500).map(str),preferred,liveTGAdded:true};
}
function trusted(event){if(!main||event.sender!==main.webContents)throw Error('Unauthorized window');}
app.whenReady().then(async()=>{
 await bridge.start();
 // External URLs are never navigated inside this application.
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 ipcMain.handle('catalog:load',event=>{trusted(event);return readState();});
 ipcMain.handle('catalog:save',(event,state)=>{trusted(event);const clean=safeState(state),file=settingsPath();
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{await fs.promises.mkdir(path.dirname(file),{recursive:true});await fs.promises.writeFile(file+'.tmp',JSON.stringify(clean));await fs.promises.rename(file+'.tmp',file);return true;});return saveQueue;});
 ipcMain.handle('playlist:fetch',async(event,address)=>{trusted(event);if(!validUrl(address))throw Error('Only HTTP/HTTPS playlists are accepted');
  const response=await net.fetch(address,{redirect:'follow'});if(!response.ok)throw Error('Playlist HTTP '+response.status);
  const max=16*1024*1024;if(Number(response.headers.get('content-length')||0)>max)throw Error('Playlist too large (16 MB)');
  const text=await response.text();if(text.length>max)throw Error('Playlist too large (16 MB)');
  if(!text.replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U'))throw Error('This URL returned a web page, not an M3U playlist. Open the repository file and use its Raw link.');
  return text;
 });
 ipcMain.handle('stream:probe',async(event,request)=>{trusted(event);if(!request||!validUrl(request.url))throw Error('Invalid stream URL');return probeStream({url:request.url,requiresDrm:request.requiresDrm===true,hasRequestHeaders:request.hasRequestHeaders===true},net.fetch);});
 ipcMain.handle('github:discover',async(event,address)=>{trusted(event);return discover(address,net.fetch);});
 ipcMain.handle('export:write',async(event,request)=>{trusted(event);if(!request||!['m3u','csv'].includes(request.format)||typeof request.content!=='string')throw Error('Invalid export request');
  if(Buffer.byteLength(request.content,'utf8')>24*1024*1024)throw Error('Export exceeds the 24 MB safety limit. Disable backup feeds or export fewer categories.');
  const isM3u=request.format==='m3u',extension=isM3u?'m3u':'csv';
  const {canceled,filePath}=await dialog.showSaveDialog(main,{title:'Export StreamBoard playlist',defaultPath:`StreamBoard-Master.${extension}`,filters:[{name:isM3u?'M3U playlist':'CSV channel report',extensions:[extension]}]});
  if(canceled||!filePath)return {saved:false};await fs.promises.writeFile(filePath,request.content,'utf8');return {saved:true};
 });
 ipcMain.handle('player:open',async(event,address)=>{trusted(event);if(!validUrl(address))throw Error('Invalid stream URL');return bridge.open(address);});
 main=new BrowserWindow({width:1460,height:900,minWidth:900,minHeight:620,backgroundColor:'#0B101B',autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 await main.loadFile(path.join(__dirname,'src/index.html'));
 main.webContents.setWindowOpenHandler(()=>({action:'deny'}));main.webContents.on('will-navigate',event=>event.preventDefault());
});
app.on('before-quit',()=>{bridge.close().catch(()=>{});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
