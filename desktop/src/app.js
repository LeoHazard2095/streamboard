'use strict';
const L=window.StreamLogic;
const $=id=>document.getElementById(id);
let state={}, merged=[], tab='live', category='All', query='', channel=null, feeds=[], feedIndex=-1, tried=new Set(), hls=null, stallStart=0, timer=0, quality='auto', amount=120;
const statuses=new Map();
const defaultSources=[
  {id:'bdix',title:'BDIX IPTV',url:'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u'},
  {id:'vip',title:'VIP KB Pro',url:'https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8'},
  {id:'live-tg',title:'Live TG TV',url:'https://livetgtv.lovable.app/api/public/playlist.m3u'}
];
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function save(){return window.streamBoard.save(state).catch(e=>message(e.message));}
function message(text){$('import-status').textContent=text;}
function recompute(){merged=L.merge(state.channels);}
function categories(){return Array.from(new Set(merged.map(g=>g.category))).sort();}
function allowed(g){return state.allowed.includes(g.id)&&!state.hiddenCategories.includes(g.category);}
function updateStats(){const total=merged.length, approved=merged.filter(allowed).length;
 $('stats').textContent=`${approved} approved · ${total} channels · ${state.sources.length} playlists`;
 $('side-count').textContent=`${total} catalog entries`;
}
function filtered(){return merged.filter(g=>(tab==='access'||allowed(g))&& (tab!=='favorites'||state.favorites.includes(g.id))&&(category==='All'||g.category===category)&&(!query||`${g.name} ${g.category} ${g.language}`.toLowerCase().includes(query.toLowerCase())));}
function makeChips(target,includeHidden){target.replaceChildren();
 for(const c of ['All',...categories().filter(x=>includeHidden||!state.hiddenCategories.includes(x))]){
   const b=node('button',c===category?'active':'',c);b.onclick=()=>{category=c;amount=120;render();};target.append(b);
 }
}
function logoBlock(g){const block=node('div','logo',g.name.trim().slice(0,2).toUpperCase()||'TV');
 if(L.urlOk(g.logo)){const img=node('img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=g.logo;img.onerror=()=>img.remove();block.append(img);}
 return block;
}
function showMore(parent,count){if(count<=amount)return;const more=node('button','more',`Show more · ${count-amount} remaining`);more.onclick=()=>{amount+=120;render();};parent.append(more);}
function renderChannels(){const all=filtered();const grid=$('channel-grid');grid.replaceChildren();
 for(const g of all.slice(0,amount)){
   const card=node('div','channel');card.setAttribute('role','button');card.tabIndex=0;
   const head=node('div','top');head.append(logoBlock(g));
   const star=node('button','star'+(state.favorites.includes(g.id)?' active':''),state.favorites.includes(g.id)?'★':'☆');
   star.title='Toggle favorite';star.onclick=e=>{e.stopPropagation();toggle(state.favorites,g.id);save();render();};head.append(star);card.append(head);
   card.append(node('strong','',g.name));card.append(node('div','meta',`${g.category} · ${g.feeds.length} source${g.feeds.length===1?'':'s'}`));
   card.onclick=()=>play(g);card.onkeydown=e=>{if(e.key==='Enter')play(g);};grid.append(card);
 }
 $('empty').hidden=all.length>0;showMore(grid,all.length);
}
function toggle(arr,key){const i=arr.indexOf(key);if(i>=0)arr.splice(i,1);else arr.push(key);}
function renderAccess(){const list=$('access-list');list.replaceChildren();
 const cats=$('categories-access');cats.replaceChildren();
 for(const c of categories()){
   const hidden=state.hiddenCategories.includes(c);
   const btn=node('button',hidden?'off':'active',`${hidden?'○':'✓'} ${c}`);
   btn.onclick=()=>{toggle(state.hiddenCategories,c);save();render();};cats.append(btn);
 }
 const visible=filtered();
 for(const g of visible.slice(0,amount)){
   const item=node('div','access-row');item.append(logoBlock(g));
   const text=node('div','desc');text.append(node('strong','',g.name),node('small','',`${g.category} · ${g.feeds.length} alternatives`));item.append(text);
   const toggleBox=node('input','check');toggleBox.type='checkbox';toggleBox.checked=state.allowed.includes(g.id);
   toggleBox.title='Allow this channel';toggleBox.onchange=()=>{toggle(state.allowed,g.id);save();updateStats();};item.append(toggleBox);list.append(item);
 }
 showMore(list,visible.length);
}
function renderSources(){const list=$('source-list');list.replaceChildren();
 for(const s of state.sources){
  const row=node('div','source-row'),text=node('div','desc'),count=state.channels.filter(x=>x.sourceId===s.id).length;
  text.append(node('strong','',s.title),node('small','',`${count} channels · ${new URL(s.url).hostname} · ${statuses.get(s.id)||'Saved source'}`));row.append(text);
  const acts=node('div','actions');
  const refresh=node('button','','↻ Refresh');refresh.onclick=()=>refreshSource(s);acts.append(refresh);
  const inspect=node('button','','Inspect');inspect.onclick=()=>{
   const own=state.channels.filter(x=>x.sourceId===s.id);
   const countBy=(key)=>{
     const grouped=new Map();for(const c of own){const k=c[key]||'Other';grouped.set(k,(grouped.get(k)||0)+1);}
     return Array.from(grouped).sort((a,b)=>b[1]-a[1]);
   };
   const domains=new Map();for(const c of own){try{const host=new URL(c.url).hostname;domains.set(host,(domains.get(host)||0)+1);}catch{}}
   const rows=[`Playlist: ${s.title}`,`Imported channel entries: ${own.length}`,
    `Unique stream URLs: ${new Set(own.map(c=>c.url)).size}`,
    `Entries with logo: ${own.filter(c=>c.logo).length}`,
    `Entries with TV guide ID: ${own.filter(c=>c.tvgId).length}`,
    '', 'Categories:',...countBy('category').map(([label,n])=>`  ${label}: ${n}`),
    '', 'Top stream hosts:',...Array.from(domains).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([host,n])=>`  ${host}: ${n}`),
    '', 'These are imported entries, not verified playing broadcasts.'];
   const dialog=$('inspect-dialog');$('inspect-text').textContent=rows.join('\n');dialog.showModal();
  };acts.append(inspect);
  const remove=node('button','ghost','Remove');remove.onclick=()=>{
   if(!window.confirm(`Remove playlist ${s.title}?`))return;
   state.sources=state.sources.filter(x=>x.id!==s.id);
   state.channels=state.channels.filter(x=>x.sourceId!==s.id);recompute();save();render();
  };acts.append(remove);row.append(acts);list.append(row);
 }
}
function enforceAccess(){
 if(!channel)return;
 const latest=merged.find(g=>g.id===channel.id);
 if(latest && allowed(latest))return;
 closePlayback();channel=null;feeds=[];tried.clear();
 document.body.classList.remove('playing');
 $('playing-title').textContent='Playback stopped';
 $('player-status').textContent='Channel blocked, hidden, or removed';
 $('video-overlay').style.display='flex';
 $('video-overlay').querySelector('h2').textContent='Choose an approved channel';
 $('video-overlay').querySelector('p').textContent='Your channel restrictions are applied immediately.';
}
function render(){
 enforceAccess();
 // Rebuilding merged thousands of channels on every keystroke was expensive.
 // Recompute only after an actual source/channel mutation.
 updateStats();
 for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===tab);
 const playerVisible=tab==='live'||tab==='favorites';$('player-section').hidden=!playerVisible;
 $('library').hidden=!playerVisible;$('access').hidden=tab!=='access';$('sources-panel').hidden=tab!=='sources';
 const names={live:['Live TV','All channels'],favorites:['Favorites','Saved channels'],access:['Channel access','Manage access'],sources:['Playlist sources','Manage playlists']};
 $('page-title').textContent=names[tab][0];$('section-title').textContent=names[tab][1];$('eyebrow').textContent=tab==='live'?'WATCH YOUR FAVORITES':'STREAMBOARD CONTROL CENTER';
 if(tab==='live'||tab==='favorites'){makeChips($('chips'),false);renderChannels();}
 else if(tab==='access'){renderAccess();}else renderSources();
}
async function refreshSource(source){statuses.set(source.id,'Downloading…');message(`Fetching ${source.title}…`);if(tab==='sources')renderSources();
 try{
   const text=await window.streamBoard.fetchPlaylist(source.url);
   const channels=L.parse(text,source.id,source.title,source.url);
   if(!channels.length)throw Error('No playable channel entries in playlist');
   state.channels=state.channels.filter(c=>c.sourceId!==source.id).concat(channels);
   recompute();statuses.set(source.id,`Imported ${channels.length} entries`);await save();message(`${source.title}: ${channels.length} entries indexed`);
 }catch(e){statuses.set(source.id,`Failed: ${e.message}`);message(`${source.title}: ${e.message}. Old entries retained.`);}
 render();
}
async function refreshAll(){for(const s of state.sources)await refreshSource(s);}
function play(g){if(!allowed(g))return;
 channel=g;feeds=g.feeds.slice();const pref=state.preferred[g.id];if(pref){const index=feeds.findIndex(x=>x.url===pref);if(index>0){const [c]=feeds.splice(index,1);feeds.unshift(c);}}
 tried.clear();$('playing-title').textContent=g.name;$('player-status').textContent='Connecting…';
 const select=$('source');select.replaceChildren();
 feeds.forEach((f,i)=>{const option=node('option','',f.sourceName||`Source ${i+1}`);option.value=String(i);select.append(option);});
 quality='auto';$('quality').value='auto';playFeed(0);
}
function closePlayback(){if(hls){hls.destroy();hls=null;}$('video').pause();$('video').removeAttribute('src');$('video').load();}
function playFeed(i){if(!channel||i<0||i>=feeds.length)return;
 feedIndex=i;tried.add(i);const f=feeds[i],video=$('video');
 closePlayback();$('video-overlay').style.display='none';document.body.classList.add('playing');
 $('source').value=String(i);$('player-status').textContent=`Connecting · ${f.sourceName} · ${i+1}/${feeds.length}`;
 stallStart=Date.now();
 if(window.Hls && window.Hls.isSupported()){
   hls=new window.Hls({enableWorker:true,lowLatencyMode:true,backBufferLength:20,maxBufferLength:25});
   hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{applyQuality();video.play().catch(()=>{$('player-status').textContent='Tap play to start';});});
   hls.on(window.Hls.Events.ERROR,(_event,data)=>{if(data.fatal)nextFeed('Stream failure');});
   hls.loadSource(f.url);hls.attachMedia(video);
 }else if(video.canPlayType('application/vnd.apple.mpegurl')){
   video.src=f.url;video.play().catch(()=>{});
 }else{nextFeed('HLS playback unavailable');}
}
function nextFeed(reason){
 if(!channel)return;
 const index=feeds.findIndex((_f,i)=>!tried.has(i));
 if(index>=0){$('player-status').textContent=`${reason} · switching source`;playFeed(index);}else{
   closePlayback();$('player-status').textContent='All configured sources unavailable';
   $('video-overlay').style.display='flex';$('video-overlay').querySelector('h2').textContent='No working source';
   $('video-overlay').querySelector('p').textContent='Check access, network, or try another playlist.';
 }
}
function applyQuality(){
 if(!hls)return;const cap=quality==='auto'?0:Number(quality);
 hls.currentLevel=-1;
 if(!cap){hls.autoLevelCapping=-1;return;}
 const matches=hls.levels.map((level,i)=>({height:level.height,i})).filter(x=>x.height>0);
 const under=matches.filter(x=>x.height<=cap);
 const best=under.length?under[under.length-1].i:matches.length?matches[0].i:-1;
 hls.autoLevelCapping=best;
}
const video=$('video');
video.addEventListener('playing',()=>{stallStart=0;if(channel)$('player-status').textContent=`● LIVE · ${feeds[feedIndex]?.sourceName||'Source'}`;});
video.addEventListener('waiting',()=>{if(!stallStart)stallStart=Date.now();});
video.addEventListener('error',()=>{if(channel)nextFeed('Playback error');});
setInterval(()=>{if(channel && stallStart && Date.now()-stallStart>30000){stallStart=0;nextFeed('Playback stalled');}},4000);
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;category='All';query='';amount=120;$('search').value='';render();};
$('search').oninput=e=>{query=e.target.value;amount=120;render();};
$('refresh-btn').onclick=refreshAll;$('refresh-all').onclick=refreshAll;
$('allow-filtered').onclick=()=>{for(const g of filtered())if(!state.allowed.includes(g.id))state.allowed.push(g.id);save();render();};
$('block-filtered').onclick=()=>{const ids=new Set(filtered().map(x=>x.id));state.allowed=state.allowed.filter(id=>!ids.has(id));save();render();};
$('quality').onchange=e=>{quality=e.target.value;applyQuality();};
$('source').onchange=e=>{if(!channel)return;const i=Number(e.target.value);state.preferred[channel.id]=feeds[i].url;save();tried.clear();playFeed(i);};
$('fullscreen').onclick=()=>{if(video.requestFullscreen)video.requestFullscreen().catch(()=>{});};
$('add-source').onsubmit=e=>{e.preventDefault();const url=$('source-url').value.trim();
 if(!L.urlOk(url)||state.sources.some(s=>s.url===url)){message('Invalid or duplicate playlist link');return;}
 const title=$('source-name').value.trim()||new URL(url).hostname;
 const source={id:'user-'+Date.now(),title,url};state.sources.push(source);save();$('source-url').value='';$('source-name').value='';render();refreshSource(source);};
window.streamBoard.load().then(async value=>{
 state=value||{};for(const key of ['sources','channels','allowed','favorites','hiddenCategories'])if(!Array.isArray(state[key]))state[key]=[];
 if(!state.preferred)state.preferred={};if(!state.sources.length)state.sources=defaultSources;
 recompute();render();if(!state.channels.length)refreshAll();
}).catch(e=>{message('Could not load saved data: '+e.message);});
