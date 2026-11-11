'use strict';
const {app,BrowserWindow,ipcMain,net,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {URL}=require('node:url');
let main;
const defaults=[
  {id:'bdix',title:'BDIX IPTV',url:'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u'},
  {id:'vip',title:'VIP KB Pro',url:'https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8'},
  {id:'live-tg',title:'Live TG TV',url:'https://livetgtv.lovable.app/api/public/playlist.m3u'}
];
const settingsPath=()=>path.join(app.getPath('userData'),'catalog-v1.json');
function readState(){
  let saved={}; try{saved=JSON.parse(fs.readFileSync(settingsPath(),'utf8'));}catch{}
  if(!saved||typeof saved!=='object')saved={};
  if(!Array.isArray(saved.sources))saved.sources=defaults;
  else if(!saved.liveTGAdded){
    if(!saved.sources.some(x=>x.url===defaults[2].url))saved.sources.push(defaults[2]);
    saved.liveTGAdded=true;
  }
  if(!Array.isArray(saved.channels))saved.channels=[];
  if(!Array.isArray(saved.allowed))saved.allowed=[];
  if(!Array.isArray(saved.favorites))saved.favorites=[];
  if(!Array.isArray(saved.hiddenCategories))saved.hiddenCategories=[];
  if(!saved.preferred||typeof saved.preferred!=='object')saved.preferred={};
  return saved;
}
function validUrl(input){try{const u=new URL(input);return ['http:','https:'].includes(u.protocol);}catch{return false;}}
function safeState(input){
  if(!input||typeof input!=='object')throw Error('Invalid settings');
  const str=v=>typeof v==='string'?v.slice(0,2048):'';
  const sources=(Array.isArray(input.sources)?input.sources:[]).slice(0,100).filter(x=>x&&validUrl(x.url)).map(x=>({id:str(x.id),title:str(x.title),url:str(x.url)}));
  const channels=(Array.isArray(input.channels)?input.channels:[]).slice(0,30000).filter(x=>x&&validUrl(x.url)).map(x=>({name:str(x.name),url:str(x.url),logo:str(x.logo),tvgId:str(x.tvgId),group:str(x.group),category:str(x.category),language:str(x.language),country:str(x.country),sourceId:str(x.sourceId),sourceName:str(x.sourceName)}));
  return {sources,channels,allowed:(input.allowed||[]).slice(0,40000).map(str),favorites:(input.favorites||[]).slice(0,40000).map(str),hiddenCategories:(input.hiddenCategories||[]).slice(0,300).map(str),preferred:input.preferred||{},liveTGAdded:true};
}
app.whenReady().then(()=>{
  ipcMain.handle('catalog:load',()=>readState());
  ipcMain.handle('catalog:save',(_event,state)=>{
    const clean=safeState(state);const file=settingsPath();fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file+'.tmp',JSON.stringify(clean));fs.renameSync(file+'.tmp',file);return true;
  });
  ipcMain.handle('playlist:fetch',async (_event,address)=>{
    if(!validUrl(address))throw Error('Only HTTP and HTTPS playlist links are supported');
    let response=await net.fetch(address,{redirect:'follow'});
    if(!response.ok)throw Error('Playlist HTTP '+response.status);
    const limit=8*1024*1024;
    if(Number(response.headers.get('content-length')||0)>limit)throw Error('Playlist exceeds 8MB');
    const body=await response.text();if(body.length>limit)throw Error('Playlist exceeds 8MB');
    return body;
  });
  main=new BrowserWindow({width:1280,height:820,minWidth:890,minHeight:590,
    backgroundColor:'#09111f',autoHideMenuBar:true,webPreferences:{
      preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,
      webSecurity:true
    }});
  main.loadFile(path.join(__dirname,'src/index.html'));
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate',(e)=>e.preventDefault());
  // Windows distribution: one window is sufficient. Future macOS builds can reuse createWindow().
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
