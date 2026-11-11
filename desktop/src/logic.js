/* Dependency-free M3U parser and conservative multi-source merge shared by desktop tests. */
(function (root, factory) { const value=factory(); if(typeof module==='object'&&module.exports)module.exports=value; else root.StreamLogic=value; })(typeof self!=='undefined'?self:this,function(){
'use strict';
const categoryKeywords={Kids:['kids','cartoon','shin chan','doraemon','pogo','nick','disney junior','baby','toon','moonbug','bheem'], Sports:['sport','cricket','espn','football'],News:['news','current affairs','cnn'],Movies:['movie','film','cinema'],Music:['music','songs'],Documentary:['documentary','wildlife','nature'],Religious:['religious','islamic','quran'],Entertainment:['entertainment','drama','comedy']};
function category(group,name){const g=(group||'').toLowerCase(),n=(name||'').toLowerCase();for(const [title,tokens] of Object.entries(categoryKeywords)){if(tokens.some(t=>(title==='Kids'?g+' '+n:g).includes(t)))return title;}return group&&group.trim().length<42?group.replace(/^(FAST|SLOW)[\s:_-]+/i,'').trim()||'Other':'Other';}
function canonicalName(name){return (name||'').toLowerCase().replace(/\b(hd|fhd|sd|4k|uhd|live|1080p|720p|480p|fast|slow)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function urlOk(value){try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}}
function parse(text,sourceId,sourceName,baseUrl){
  if(!text||typeof text!=='string')return [];
  const out=[];const lines=text.replace(/^\ufeff/,'').split(/\r?\n/);
  if(lines.some(l=>l.startsWith('#EXT-X-STREAM-INF')||l.startsWith('#EXT-X-TARGETDURATION'))){return [{name:sourceName+' Live',url:baseUrl,logo:'',tvgId:'',group:'Live TV',category:'Live TV',language:'',country:'',sourceId,sourceName}];}
  let pending=null,group='';
  for(const raw of lines){const line=raw.trim();if(!line)continue;
    if(line.startsWith('#EXTGRP:')){group=line.slice(8).trim();continue;}
    if(line.startsWith('#EXTINF:')){
      const attrs={};for(const m of line.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g))attrs[m[1].toLowerCase()]=m[2];
      const comma=line.lastIndexOf(',');const name=(comma>=0?line.slice(comma+1).trim():attrs['tvg-name'])||attrs['tvg-name']||'';
      pending={name,url:'',logo:attrs['tvg-logo']||'',tvgId:attrs['tvg-id']||'',group:attrs['group-title']||group,language:attrs['tvg-language']||'',country:attrs['tvg-country']||'',sourceId,sourceName};
      pending.category=category(pending.group,pending.name);continue;
    }
    if(line.startsWith('#'))continue;
    let address;try{address=new URL(line,baseUrl).href;}catch{pending=null;continue;}
    if(!urlOk(address)||!pending)continue;
    if(/^([⚡🔹]|IPTV LINKS)/i.test(pending.name)||pending.tvgId.startsWith('header.')){pending=null;continue;}
    pending.url=address;pending.name=pending.name||'Unnamed channel';out.push(pending);pending=null;
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
    if(!match.feeds.some(existing=>existing.url===c.url))match.feeds.push(c);
    if(!match.logo&&c.logo)match.logo=c.logo;
  }
  return groups.sort((a,b)=>a.name.localeCompare(b.name));
}
return {parse,merge,canonicalName,category,urlOk};
});
