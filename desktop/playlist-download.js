'use strict';
const http=require('node:http');
const https=require('node:https');
const {URL}=require('node:url');
const MAX=16*1024*1024;
const UA='VLC/3.0.20 LibVLC/3.0.20';
function valid(address){try{const u=new URL(address);return ['http:','https:'].includes(u.protocol)&&u.hostname&&!u.username&&!u.password;}catch{return false;}}
function validate(text){if(!text.replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U'))throw Error('Response is not an M3U playlist (it may be HTML or JSON)');return text;}
function requestNode(address,{timeoutMs=20000,redirects=5}={}){
 return new Promise((resolve,reject)=>{
  if(!valid(address))return reject(Error('Only HTTP/HTTPS playlists are accepted'));
  const u=new URL(address);let completed=false;
  const req=(u.protocol==='https:'?https:http).get(u,{headers:{'User-Agent':UA,'Accept':'*/*','Accept-Encoding':'identity'},timeout:timeoutMs},res=>{
   const status=res.statusCode||0;
   if([301,302,303,307,308].includes(status)){
    const loc=res.headers.location;res.resume();if(!loc||redirects<=0)return reject(Error('Too many redirects or redirect without Location'));
    let target;try{target=new URL(loc,u).href;}catch{return reject(Error('Invalid playlist redirect'));}
    if(!valid(target))return reject(Error('Unsafe playlist redirect'));
    requestNode(target,{timeoutMs,redirects:redirects-1}).then(resolve,reject);return;
   }
   if(status<200||status>=300){res.resume();return reject(Error(`Playlist HTTP ${status}`));}
   if(Number(res.headers['content-length']||0)>MAX){res.destroy();return reject(Error('Playlist too large (16 MB)'));}
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>MAX){res.destroy(Error('Playlist too large (16 MB)'));return;}chunks.push(chunk);});
   res.on('end',()=>{if(!completed){completed=true;try{resolve({text:validate(Buffer.concat(chunks).toString('utf8')),method:'Node HTTP',bytes:size,httpStatus:status});}catch(e){reject(e);}}});
   res.on('error',reject);
  });
  req.on('timeout',()=>req.destroy(Error('Playlist download timed out')));req.on('error',reject);
 });
}
async function requestElectron(address,electronFetch){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await electronFetch(address,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':UA,'Accept':'*/*'}});
  if(!response.ok)throw Error(`Playlist HTTP ${response.status}`);
  if(Number(response.headers.get('content-length')||0)>MAX)throw Error('Playlist too large (16 MB)');
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>MAX)throw Error('Playlist too large (16 MB)');chunks.push(Buffer.from(chunk));}
  return {text:validate(Buffer.concat(chunks).toString('utf8')),method:'Electron',bytes:size,httpStatus:response.status};
 }finally{clearTimeout(timer);}
}
async function downloadPlaylist(address,electronFetch,{nodeDownload=requestNode}={}){
 if(!valid(address))throw Error('Only HTTP/HTTPS playlists are accepted');
 try{return await requestElectron(address,electronFetch);}catch(primary){
  // Retry network transport errors, not HTTP 4xx, invalid M3U or oversized files.
  if(/Playlist HTTP 4\d\d|Playlist too large|not an M3U/i.test(primary.message))throw primary;
  try{const result=await nodeDownload(address);return {...result,fallbackReason:String(primary.message).slice(0,200)};}
  catch(secondary){throw Error(`Playlist download failed. Electron: ${primary.message}; Node fallback: ${secondary.message}`);}
 }
}
module.exports={downloadPlaylist,requestNode,valid,UA};
