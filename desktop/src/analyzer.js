/* StreamBoard Playlist Studio: pure analysis and compilation, no network or player side effects. */
(function(root, factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.StreamAnalyzer=value;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const clean=(v,max=200)=>String(v??'').replace(/[\r\n\u0000-\u001f]+/g,' ').trim().slice(0,max);
const safeAttr=v=>clean(v,1024).replace(/"/g,"'");
const validUrl=v=>{try{const u=new URL(v);return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password;}catch{return false;}};
const safeCategory=v=>clean(v||'Other',80)||'Other';
function streamFormat(url,feed){
 if(feed?.formatHint==='DASH'||feed?.formatHint==='HLS')return feed.formatHint;
 try{const u=new URL(url);const path=u.pathname.toLowerCase();if(/\.mpd$/.test(path)||/\/(?:dash|manifest)\//.test(path)&&u.searchParams.get('format')==='mpd')return 'DASH';if(/\.m3u8?$/.test(path))return 'HLS';if(/\.mp4$/.test(path))return 'MP4';if(/\.ts$/.test(path))return 'TS';return 'Other';}catch{return 'Invalid';}
}
function summarize(groups,raw,playlistSources=[],allowed=[],hidden=[]){
 const byCategory=new Map(),bySource=new Map(),hosts=new Map(),formats={HLS:0,DASH:0,MP4:0,TS:0,Other:0,Invalid:0};const warnings=[],seenUrls=new Set(),rawUrlCounts=new Map();
 for(const s of playlistSources)bySource.set(s.id,{id:s.id,title:s.title,count:0,uniqueUrls:0,unassigned:0});
 for(const c of raw){formats[streamFormat(c.url,c)]++;const s=bySource.get(c.sourceId);if(s){s.count++;if(!c.category||c.category==='Other')s.unassigned++;}if(validUrl(c.url))rawUrlCounts.set(c.url,(rawUrlCounts.get(c.url)||0)+1);}
 let alt=0,logoMissing=0,tvgMissing=0,unknown=0,approved=0,visible=0;
 const allowedSet=new Set(allowed),hiddenSet=new Set(hidden),names=new Map();
 for(const g of groups){let cat=safeCategory(g.category),record=byCategory.get(cat);if(!record){record={name:cat,count:0,sources:0,approved:0};byCategory.set(cat,record);}record.count++;record.sources+=g.feeds.length;
  if(allowedSet.has(g.id)){record.approved++;approved++;if(!hiddenSet.has(cat))visible++;}
  if(g.feeds.length>1)alt+=g.feeds.length-1;
  if(!g.logo)logoMissing++;if(!g.feeds.some(f=>f.tvgId))tvgMissing++;if(cat.toLowerCase()==='other'||cat.toLowerCase()==='uncategorized')unknown++;
  const key=clean(g.name).toLowerCase().replace(/\b(hd|sd|fhd|uhd|live|4k|720p|1080p)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,'');if(key){if(!names.has(key))names.set(key,[]);names.get(key).push(g);}
  for(const f of g.feeds){if(!validUrl(f.url))continue;seenUrls.add(f.url);let host=new URL(f.url).hostname;hosts.set(host,(hosts.get(host)||0)+1);}
 }
 for(const entries of names.values()){if(entries.length<2)continue;const distinct=new Set(entries.map(x=>[x.country||'?',x.language||'?'].join('/')));if(distinct.size>1)warnings.push({name:entries[0].name,reason:'Possible channel identity conflict (country or language)',groups:entries.length});}
 for(const g of groups){const guideIds=new Set(g.feeds.map(f=>clean(f.tvgId,160).toLowerCase()).filter(Boolean));
  if(guideIds.size>1)warnings.push({name:g.name,reason:'Merged sources disagree on TV guide ID',groups:guideIds.size});}
 const duplicateUrls=[...rawUrlCounts.values()].reduce((sum,count)=>sum+Math.max(0,count-1),0);
 return {formats,rawEntries:raw.length,uniqueChannels:groups.length,uniqueUrls:seenUrls.size,extraSources:alt,exactUrlDuplicates:duplicateUrls,missingLogo:logoMissing,missingGuideId:tvgMissing,uncategorized:unknown,approved,visible,
  categories:[...byCategory.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),
  sourceStats:[...bySource.values()],hosts:[...hosts].sort((a,b)=>b[1]-a[1]).slice(0,12),conflicts:warnings.slice(0,80)};
}
function choose(groups,opts={}){
 const cats=new Set(opts.categories||[]),sources=new Set(opts.sources||[]),onlyAllowed=opts.approvedOnly!==false,allowed=new Set(opts.allowed||[]),hidden=new Set(opts.hiddenCategories||[]);
 const options=[];
 for(const g of groups){if(!cats.has(g.category))continue;if(onlyAllowed&&(!allowed.has(g.id)||hidden.has(g.category)))continue;
  const feeds=g.feeds.filter(f=>sources.has(f.sourceId)&&validUrl(f.url));if(!feeds.length)continue;
  const pref=opts.preferred?.[g.id];feeds.sort((a,b)=>(a.url===pref?-1:0)-(b.url===pref?-1:0));
  const compatible=opts.hlsOnly?feeds.filter(f=>streamFormat(f.url,f)==='HLS'):feeds;
  const taken=opts.includeAlternatives?compatible:compatible.slice(0,1);
  taken.forEach((f,index)=>options.push({channel:g,feed:f,alternative:index>0,index}));
 }
 return options;
}
function createM3u(entries){const lines=['#EXTM3U'];for(const item of entries){const {channel:g,feed:f,alternative,index}=item;let name=clean(g.name,300);if(alternative)name+=` [Backup ${index+1}: ${clean(f.sourceName||'Source',80)}]`;
 const attrs=[`tvg-id="${safeAttr(f.tvgId||'')}"`,`tvg-logo="${safeAttr(g.logo||f.logo||'')}"`,`group-title="${safeAttr(g.category||'Other')}"`];
 if(g.language)attrs.push(`tvg-language="${safeAttr(g.language)}"`);if(g.country)attrs.push(`tvg-country="${safeAttr(g.country)}"`);
 lines.push(`#EXTINF:-1 ${attrs.join(' ')},${name}`,f.url);
 }return lines.join('\r\n')+'\r\n';}
function csvCell(v){let t=clean(v,2048);if(/^[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';}
function createCsv(entries){const columns=['Channel','Category','Language','Country','TVG ID','Source name','Source URL','Backup stream','Logo URL'];const rows=[columns.map(csvCell).join(',')];for(const {channel:g,feed:f,alternative} of entries)rows.push([g.name,g.category,g.language,g.country,f.tvgId,f.sourceName,f.url,alternative?'Yes':'No',g.logo].map(csvCell).join(','));return '\uFEFF'+rows.join('\r\n')+'\r\n';}
return {summarize,choose,createM3u,createCsv,clean,streamFormat};
});
