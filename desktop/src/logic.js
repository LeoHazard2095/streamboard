/* Dependency-free M3U parser and conservative multi-source merge shared by desktop tests. */
(function (root, factory) { const value=factory(); if(typeof module==='object'&&module.exports)module.exports=value; else root.StreamLogic=value; })(typeof self!=='undefined'?self:this,function(){
'use strict';
const categoryKeywords={Kids:['kids','cartoon','shin chan','doraemon','pogo','nick','disney junior','baby','toon','moonbug','bheem'], Sports:['sport','cricket','espn','football'],News:['news','current affairs','cnn'],Movies:['movie','film','cinema'],Music:['music','songs'],Documentary:['documentary','wildlife','nature'],Religious:['religious','islamic','quran'],Entertainment:['entertainment','drama','comedy']};
function category(group,name){const g=(group||'').toLowerCase(),n=(name||'').toLowerCase();for(const [title,tokens] of Object.entries(categoryKeywords)){if(tokens.some(t=>(title==='Kids'?g+' '+n:g).includes(t)))return title;}return group&&group.trim().length<42?group.replace(/^(FAST|SLOW)[\s:_-]+/i,'').trim()||'Other':'Other';}
function canonicalName(name){return (name||'').toLowerCase().replace(/\b(hd|fhd|sd|4k|uhd|live|1080p|720p|480p|fast|slow)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function urlOk(value){try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}}
// Parse a URL carrying IPTV header suffixes (e.g. ...mpd|User-Agent=...). The
// stream URL and metadata are kept separate so the embedded player never receives
// a malformed URL. Never store passwords, cookies, tokens or ClearKey values.
function splitIptvUrl(value){
 const parts=String(value||'').split('|');const address=parts.shift().trim();
 const headerNames=[];for(const entry of parts){for(const part of entry.split('&')){const key=part.split('=')[0].trim();if(/^[a-z][a-z0-9-]{0,40}$/i.test(key))headerNames.push(key);}}
 return {address,headerNames:[...new Set(headerNames)]};
}
function parse(text,sourceId,sourceName,baseUrl){
 if(!text||typeof text!=='string')return [];
 const out=[],lines=text.replace(/^\ufeff/,'').split(/\r?\n/);
 if(lines.some(l=>/^#EXT-X-(?:STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE|ENDLIST)/i.test(l.trim()))){
  return urlOk(baseUrl)?[{name:sourceName+' Live',url:baseUrl,logo:'',tvgId:'',group:'Live TV',category:'Live TV',language:'',country:'',sourceId,sourceName,formatHint:'HLS',requiresDrm:false,headerNames:[]}]:[];
 }
 let pending=null,group='',hints={};
 // Global header before #EXTINF and per-stream hints following it are supported.
 for(const raw of lines){const line=raw.trim();if(!line)continue;
  if(/^#EXTGRP:/i.test(line)){group=line.slice(8).trim();continue;}
  if(/^#KODIPROP:/i.test(line)){
   const prop=line.slice(10),eq=prop.indexOf('=');if(eq>0){const key=prop.slice(0,eq).toLowerCase(),value=prop.slice(eq+1).trim();
    if(key.endsWith('manifest_type')&&/^(mpd|hls|m3u8)$/i.test(value))hints.formatHint=value.toLowerCase()==='mpd'?'DASH':'HLS';
    if(key.endsWith('license_type')||key.endsWith('license_key'))hints.requiresDrm=true;
    if(key.endsWith('manifest_headers')||key.endsWith('stream_headers'))hints.hasRequestHeaders=true;
   }continue;
  }
  if(/^#EXTVLCOPT:|^#EXTHTTP:/i.test(line)){hints.hasRequestHeaders=true;continue;}
  if(/^#EXTINF:/i.test(line)){
   const attrs={};for(const m of line.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];
   const comma=line.indexOf(',',line.indexOf(':')+1);const name=(comma>=0?line.slice(comma+1).trim():attrs['tvg-name'])||attrs['tvg-name']||'';
   pending={name,url:'',logo:attrs['tvg-logo']||'',tvgId:attrs['tvg-id']||'',group:attrs['group-title']||group,language:attrs['tvg-language']||'',country:attrs['tvg-country']||'',sourceId,sourceName};
   pending.category=category(pending.group,pending.name);continue;
  }
  if(line.startsWith('#'))continue;
  if(!pending){hints={};continue;}
  const suffix=splitIptvUrl(line);let address;try{address=new URL(suffix.address,baseUrl).href;}catch{pending=null;hints={};continue;}
  if(!urlOk(address)){pending=null;hints={};continue;}
  if(/^([⚡🔹]|IPTV LINKS)/i.test(pending.name)||pending.tvgId.startsWith('header.')){pending=null;hints={};continue;}
  pending.url=address;pending.name=pending.name||'Unnamed channel';
  pending.formatHint=hints.formatHint||'';pending.requiresDrm=!!hints.requiresDrm;
  pending.hasRequestHeaders=!!hints.hasRequestHeaders||suffix.headerNames.length>0;
  pending.headerNames=suffix.headerNames;
  out.push(pending);pending=null;hints={};
  if(out.length>=12000)break;
 }
 return out;
}

function merge(channels){
  const byKey=new Map(), groups=[];
  for(const c of channels){if(!urlOk(c.url))continue;
    const k=canonicalName(c.name)||c.url;
    let match=(byKey.get(k)||[]).find(g=>!(g.country&&c.country&&g.country!==c.country)&&!(g.language&&c.language&&g.language!==c.language));
    if(!match){match={id:k+(byKey.get(k)||[]).length,name:c.name,category:c.category||'Other',language:c.language||'',country:c.country||'',logo:c.logo||'',feeds:[]};groups.push(match);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(match);}
    if(!match._urlSet)match._urlSet=new Set(match.feeds.map(x=>x.url));
    if(!match._urlSet.has(c.url)){match._urlSet.add(c.url);match.feeds.push(c);}
    if(!match.logo&&c.logo)match.logo=c.logo;
  }
  for(const g of groups)delete g._urlSet;
  return groups.sort((a,b)=>a.name.localeCompare(b.name));
}
return {parse,merge,canonicalName,category,urlOk,splitIptvUrl};
});
