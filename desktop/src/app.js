'use strict';
const L=window.StreamLogic,A=window.StreamAnalyzer,E=window.StreamChannelEditor,$=id=>document.getElementById(id),ROW=64;
const defaults=[
 {id:'bdix',title:'BDIX IPTV',url:'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u'},
 {id:'vip',title:'VIP KB Pro',url:'https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8'},
 {id:'live-tg',title:'Live TG TV',url:'https://livetgtv.lovable.app/api/public/playlist.m3u'}];
let state={},channels=[],category='All',tab='live',query='',showing=[],categoryCounts=new Map(),playable=[],current=null,feeds=[],feedIndex=-1,tried=new Set(),hls=null,quality='auto',generation=0,stallStart=0,refreshing=false;
let studioExcludedCategories=new Set(),studioExcludedSources=new Set(),selectedSourceId=null;
let activeList='channel',renderPending=false;const diag=window.StreamDiagnostics,diagLog=diag.createLog();let diagStatus='Idle',attempts=0,recoveryUsed=new Set(),lastFailure='No stream selected.',playbackStarted=false;const statuses=new Map();const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
function element(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el;}
function setText(id,value){$(id).textContent=value;}
function report(value){setText('import-status',value);}
function samePlaylistUrl(a,b){try{const normalized=v=>{const u=new URL(v);return (u.hostname.toLowerCase()==='raw.githubusercontent.com'?u.origin+u.pathname.replace('/refs/heads/','/'):u.origin+u.pathname).replace(/\/+$|\.git$/,'')+u.search;};return normalized(a)===normalized(b);}catch{return a===b;}}
function notice(value){let el=$('player-toast');el.textContent=value;el.style.display='block';clearTimeout(notice.timeout);notice.timeout=setTimeout(()=>{el.style.display='none';},3500);}
function persist(){return window.streamBoard.save(state).catch(e=>report('Save failed: '+e.message));}
const allowedIds=()=>new Set(state.allowed);const hiddenNames=()=>new Set(state.hiddenCategories);const favoriteIds=()=>new Set(state.favorites);
function isAllowed(g){return state.allowed.includes(g.id)&&!state.hiddenCategories.includes(g.category);}
function toggle(list,id){const index=list.indexOf(id);if(index<0)list.push(id);else list.splice(index,1);}
function rebuildCatalog(){channels=E.apply(L.merge(state.channels),state.channelEdits);for(const ch of channels)if(state.categoryOverrides[ch.id])ch.category=state.categoryOverrides[ch.id];categoryCounts=new Map();for(const ch of channels)categoryCounts.set(ch.category,(categoryCounts.get(ch.category)||0)+1);rebuildPlayable();}
function rebuildPlayable(){playable=channels.filter(isAllowed);setText('stats',`${playable.length.toLocaleString()} approved · ${channels.length.toLocaleString()} channels`);setText('side-count',`${channels.length.toLocaleString()} channel entries`);}
function filterRows(){const needles=query.trim().toLocaleLowerCase();const favorites=favoriteIds();
 showing=channels.filter(g=>(tab==='access'||isAllowed(g))&&(tab!=='favorites'||favorites.has(g.id))&&(category==='All'||g.category===category)&&(!needles||`${g.name} ${g.category} ${g.language||''}`.toLocaleLowerCase().includes(needles)));
 const name=tab==='access'?'access':'channel';setText(name==='access'?'access-count':'directory-count',`${showing.length.toLocaleString()} results`);setText('visible-count',`${showing.length.toLocaleString()} channels`);
 const viewport=$(name==='access'?'access-viewport':'channel-viewport');viewport.scrollTop=0;drawVirtual(name,true);
 $('empty').hidden=showing.length>0||tab!=='live'&&tab!=='favorites';
}
function logo(g){const root=element('div','row-logo',String(g.name||'TV').slice(0,2).toUpperCase());
 if(L.urlOk(g.logo)){const img=element('img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=g.logo;img.onerror=()=>img.remove();root.append(img);}return root;}
function drawVirtual(type,force=false){if(activeList!==type)return;const viewport=$(type==='access'?'access-viewport':'channel-viewport');if(viewport.offsetParent===null)return;
 const holder=$(type==='access'?'access-list':'channel-list');const start=Math.max(0,Math.floor(viewport.scrollTop/ROW)-4),end=Math.min(showing.length,Math.ceil((viewport.scrollTop+viewport.clientHeight)/ROW)+5);
 if(!force&&holder.dataset.start==String(start)&&holder.dataset.end==String(end))return;holder.dataset.start=start;holder.dataset.end=end;holder.style.height=(showing.length*ROW)+'px';holder.replaceChildren();
 const favorite=favoriteIds(),approved=allowedIds();const fragment=document.createDocumentFragment();
 for(let i=start;i<end;i++){
  const g=showing[i];const isAccess=type==='access';const row=element('div',isAccess?'access-row':'channel-row'+(current?.id===g.id?' selected':''));row.style.top=(i*ROW)+'px';row.tabIndex=0;
  row.setAttribute('role',isAccess?'group':'button');row.setAttribute('aria-label',isAccess?`Approve ${g.name}`:`Play ${g.name}`);row.append(logo(g));
  const info=element('div','row-details');info.append(element('strong','',g.name));info.append(element('small','',`${g.category}  ·  ${g.feeds.length} source${g.feeds.length===1?'':'s'}${g.language?'  ·  '+g.language:''}`));row.append(info);
  if(isAccess){const edit=element('button','edit-channel','Edit');edit.title='Edit stream URLs';edit.onclick=e=>{e.stopPropagation();openChannelEditor(g.id);};row.append(edit);const input=element('input','checkbox');input.type='checkbox';input.checked=approved.has(g.id);input.setAttribute('aria-label','Allow '+g.name);input.onchange=()=>{toggle(state.allowed,g.id);rebuildPlayable();if(current&&!isAllowed(current))stop('Channel access disabled');persist();drawVirtual('access',true);};row.append(input);row.onclick=e=>{if(e.target===input)return;input.click();};}
  else{const edit=element('button','edit-channel','Edit');edit.title='Edit stream URLs';edit.setAttribute('aria-label',`Edit streams for ${g.name}`);edit.onclick=e=>{e.stopPropagation();openChannelEditor(g.id);};row.append(edit);const star=element('button','star'+(favorite.has(g.id)?' active':''),favorite.has(g.id)?'★':'☆');star.title='Toggle favorite';star.setAttribute('aria-label',`Favorite ${g.name}`);star.onclick=e=>{e.stopPropagation();toggle(state.favorites,g.id);persist();if(tab==='favorites')filterRows();else drawVirtual('channel',true);};row.append(star);row.onclick=()=>play(g);row.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();play(g);}};}
  fragment.append(row);
 }
 holder.append(fragment);
}
function setupScroll(){for(const [type,id] of [['channel','channel-viewport'],['access','access-viewport']]){$(id).onscroll=()=>{if(activeList!==type||renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;drawVirtual(type);});};}}
function drawCategories(){
 const select=$('category-select'),choices=['All',...Array.from(categoryCounts.keys()).filter(n=>!state.hiddenCategories.includes(n)).sort(collator.compare)];
 select.replaceChildren();for(const name of choices){const option=element('option','',name==='All'?'All categories':name);option.value=name;select.append(option);}
 if(!choices.includes(category))category='All';select.value=category;
 const holder=$('chips');holder.replaceChildren();
 const access=$('categories-access');access.replaceChildren();const names=Array.from(categoryCounts.keys()).sort(collator.compare);
 for(const cat of names){const hidden=state.hiddenCategories.includes(cat);const b=element('button',hidden?'hidden-cat':'',`${hidden?'○':'✓'} ${cat} (${categoryCounts.get(cat)})`);
  b.title=hidden?'Show category':'Hide category';b.setAttribute('aria-pressed',String(!hidden));b.onclick=()=>{toggle(state.hiddenCategories,cat);rebuildPlayable();if(current&&!isAllowed(current))stop('Category disabled');persist();drawCategories();filterRows();};access.append(b);}
}
function switchTab(next){
 tab=next;query='';category='All';$('search').value='';$('access-search').value='';
 document.body.dataset.view=next;
 for(const b of document.querySelectorAll('[data-tab]')){b.classList.toggle('on',b.dataset.tab===tab);b.setAttribute('aria-current',String(b.dataset.tab===tab));}
 const isCatalog=tab==='live'||tab==='favorites';$('catalog-pane').hidden=!isCatalog;$('access-pane').hidden=tab!=='access';$('sources-pane').hidden=tab!=='sources';$('studio-pane').hidden=tab!=='studio';
 const pages={
  live:['WATCH','Channels','Find and play approved live television.'],
  favorites:['WATCH','Favorites','Your saved channels in one place.'],
  access:['MANAGE','Channel access','Approve what can be viewed, by category or channel.'],
  sources:['MANAGE','Playlists','Import and manage your playlist sources.'],
  studio:['ANALYZE','Playlist Studio','Review and compile a clean channel library.']
 };
 const [group,title,description]=pages[tab];setText('page-eyebrow',group);setText('page-title',title);setText('page-description',description);
 const paneTitles={live:['LIVE','Channel browser','Search or filter the channels you can watch.'],favorites:['SAVED','Favorite channels','Your shortcuts to live TV.'],access:['PERMISSIONS','Review channel access','Select categories and approve individual channels.'],sources:['SOURCES','Your playlists','Select a playlist to see its details.'],studio:['ANALYZER','Playlist Studio','Analyze categories and compile an export.']};
 const [eyebrow,panelTitle,subtitle]=paneTitles[tab];setText('explore-eyebrow',eyebrow);setText('panel-title',panelTitle);setText('panel-subtitle',subtitle);
 setText('visible-count',tab==='sources'?`${state.sources.length} lists`:tab==='studio'?'Studio':`${channels.length.toLocaleString()} channels`);
 activeList=tab==='access'?'access':tab==='studio'||tab==='sources'?'none':'channel';drawCategories();if(tab==='sources')renderSources();else if(tab==='studio')renderStudio();else filterRows();
}
function inspect(s){const list=state.channels.filter(x=>x.sourceId===s.id);const counts=new Map(),hosts=new Map(),formats=new Map();for(const ch of list){const format=A.streamFormat(ch.url);formats.set(format,(formats.get(format)||0)+1);counts.set(ch.category,(counts.get(ch.category)||0)+1);try{const host=new URL(ch.url).hostname;hosts.set(host,(hosts.get(host)||0)+1);}catch{}}
 const sort=map=>Array.from(map).sort((a,b)=>b[1]-a[1]);$('inspect-text').textContent=[`Playlist: ${s.title}`,`URL: ${s.url}`,`Imported entries: ${list.length}`,`Unique stream URLs: ${new Set(list.map(x=>x.url)).size}`,`Logos: ${list.filter(x=>x.logo).length}`,`TV guide IDs: ${list.filter(x=>x.tvgId).length}`, '', 'CATEGORIES', ...sort(counts).map(([name,n])=>`${name}: ${n}`), '', 'TOP STREAM HOSTS',...sort(hosts).slice(0,12).map(([name,n])=>`${name}: ${n}`),'', 'STREAM FORMATS',...sort(formats).map(([name,n])=>`${name}: ${n}`),'', 'DASH (.mpd) is not supported by the embedded HLS player. Open in VLC or use an HLS alternative.', 'A valid playlist entry is not proof of playable video.'].join('\n');$('inspect-dialog').showModal();}
function removeSource(source){
 if(!source||!window.confirm(`Remove ${source.title} and its cached channels?`))return;
 state.sources=state.sources.filter(s=>s.id!==source.id);
 state.channels=state.channels.filter(c=>c.sourceId!==source.id);
 if(selectedSourceId===source.id)selectedSourceId=state.sources[0]?.id||null;
 rebuildCatalog();if(current&&(!channels.some(g=>g.id===current.id)||!isAllowed(current)))stop('Channel removed');persist();renderSources();
}
function renderSourceDetails(){
 const selected=state.sources.find(s=>s.id===selectedSourceId);
 const title=$('source-detail-title'),host=$('source-detail-host'),metrics=$('source-detail-metrics'),cats=$('source-detail-categories');
 metrics.replaceChildren();cats.replaceChildren();
 for(const id of ['source-detail-refresh','source-detail-inspect','source-detail-remove'])$(id).disabled=!selected;
 if(!selected){title.textContent='Choose a playlist';host.textContent='Select a source to inspect its channels and categories.';return;}
 title.textContent=selected.title;
 let hostname='Unknown host';try{hostname=new URL(selected.url).hostname;}catch{}
 host.textContent=`${hostname} · ${statuses.get(selected.id)||'Saved locally'}`;
 const entries=state.channels.filter(c=>c.sourceId===selected.id);const counts=new Map();for(const c of entries)counts.set(c.category||'Other',(counts.get(c.category||'Other')||0)+1);
 const summary=[['Entries',entries.length],['Categories',counts.size],['Stream URLs',new Set(entries.map(c=>c.url)).size],['Logos',entries.filter(c=>Boolean(c.logo)).length]];
 for(const [label,value] of summary){const item=element('div','source-stat');item.append(element('strong','',Number(value).toLocaleString()),element('small','',label));metrics.append(item);}
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]);for(const [name,count] of sorted.slice(0,7)){const row=element('div','source-category-row');row.append(element('span','',name),element('strong','',count.toLocaleString()));cats.append(row);}
 if(!sorted.length)cats.append(element('p','source-empty-categories','Import or refresh this playlist to inspect its categories.'));
 $('source-detail-refresh').onclick=()=>refreshOne(selected);
 $('source-detail-inspect').onclick=()=>inspect(selected);
 $('source-detail-remove').onclick=()=>removeSource(selected);
}
function renderSources(){
 const root=$('source-list');root.replaceChildren();
 const counts=new Map();for(const c of state.channels)counts.set(c.sourceId,(counts.get(c.sourceId)||0)+1);
 if(!state.sources.some(s=>s.id===selectedSourceId))selectedSourceId=state.sources[0]?.id||null;
 setText('source-list-count',`${state.sources.length} source${state.sources.length===1?'':'s'}`);
 for(const s of state.sources){
  let hostname='Source';try{hostname=new URL(s.url).hostname;}catch{}
  const row=element('button','source-item'+(s.id===selectedSourceId?' selected':''));row.type='button';row.setAttribute('aria-pressed',String(s.id===selectedSourceId));
  const content=element('div','source-item-body');content.append(element('strong','',s.title),element('small','',hostname));
  const info=element('span','source-item-meta',`${(counts.get(s.id)||0).toLocaleString()} channels`);
  row.append(content,info);row.onclick=()=>{selectedSourceId=s.id;renderSources();};root.append(row);
 }
 if(!state.sources.length)root.append(element('div','source-empty','No playlists yet. Add a URL to import your first source.'));
 renderSourceDetails();
}
function workerAction(type,payload){return new Promise((resolve,reject)=>{const worker=new Worker('playlist-worker.js');const timeout=setTimeout(()=>{worker.terminate();reject(Error('Playlist processing timed out'));},35000);
 worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();e.data?.error?reject(Error(e.data.error)):resolve(e.data.result);};worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message));};worker.postMessage({type,payload});});}
async function refreshOne(s,{silent=false}={}){statuses.set(s.id,'Loading…');if(!silent){report(`Fetching ${s.title}…`);if(tab==='sources')renderSources();}
 try{const text=await window.streamBoard.fetchPlaylist(s.url);const parsed=await workerAction('parse',{text,id:s.id,title:s.title,url:s.url}).catch(()=>L.parse(text,s.id,s.title,s.url));if(!parsed.length)throw Error('No playable channels found');
  state.channels=state.channels.filter(c=>c.sourceId!==s.id).concat(parsed);rebuildCatalog();statuses.set(s.id,`${parsed.length.toLocaleString()} imported`);await persist();
  report(`${s.title}: ${parsed.length.toLocaleString()} channel entries imported`);
 }catch(e){statuses.set(s.id,'Failed: '+e.message);report(`${s.title}: ${e.message}. Previously saved entries retained.`);}
 if(!silent){if(tab==='sources')renderSources();else switchTab(tab);}
}
async function refreshAll(){if(refreshing)return;refreshing=true;$('refresh-btn').disabled=true;$('refresh-all').disabled=true;try{for(const s of [...state.sources])await refreshOne(s,{silent:true});if(tab==='sources')renderSources();else switchTab(tab);}finally{refreshing=false;$('refresh-btn').disabled=false;$('refresh-all').disabled=false;}}
function playerStatus(message){setText('player-status',message);}
function recordDiag(kind,message){diagLog.push(kind,message);updateDiagnostics();}
function bufferedAhead(){const v=$('video');try{const t=v.currentTime;for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=t&&v.buffered.end(i)>=t)return Math.max(0,v.buffered.end(i)-t);}catch{}return 0;}
function updateDiagnostics(){
 const v=$('video');setText('diag-connection',diagStatus);setText('diag-resolution',v.videoWidth?`${v.videoWidth} × ${v.videoHeight}`:'—');setText('diag-buffer',current?`${bufferedAhead().toFixed(1)}s`:'—');setText('diag-attempts',String(attempts));setText('diag-reason',lastFailure);
 setText('diagnostics-brief',current?`${current.name} · ${diagStatus}`:diagStatus);
 $('retry-feed').disabled=!current||feedIndex<0;
 const list=$('diag-events');list.replaceChildren();for(const e of diagLog.all().slice(-18).reverse())list.append(element('li','',`${e.at.slice(11,19)} · ${e.kind}: ${e.message}`));
}
function diagnosticsReport(){return diag.report({channel:current,feed:feeds[feedIndex],events:diagLog.all(),video:{videoWidth:$('video').videoWidth,videoHeight:$('video').videoHeight,readyState:$('video').readyState,networkState:$('video').networkState,bufferedAhead:bufferedAhead()},attempts,status:diagStatus});}
function retryCurrent(){if(!current||feedIndex<0)return;recordDiag('retry','Manual retry requested');tried.clear();recoveryUsed.clear();openFeed(feedIndex);}

function stop(reason='Select an approved channel'){generation++;diagStatus='Idle';lastFailure=reason;updateDiagnostics();const player=$('video');if(hls){hls.destroy();hls=null;}player.pause();player.removeAttribute('src');player.load();current=null;document.body.classList.remove('has-player');feeds=[];tried.clear();$('source').replaceChildren();$('video-overlay').hidden=false;setText('playing-title','Nothing playing yet');playerStatus(reason);setText('overlay-title','Choose a channel to start');setText('overlay-subtitle','Browse approved channels while the player stays visible.');drawVirtual('channel',true);}
function orderedFeeds(g){const options=[...g.feeds];const pref=state.preferred[g.id];const idx=options.findIndex(x=>x.url===pref);if(idx>0)options.unshift(...options.splice(idx,1));return options;}
function play(g){if(!isAllowed(g))return;if(!g.feeds.length){openChannelEditor(g.id);setText('editor-message','No active stream URLs. Add a URL to play this channel.');return;}current=g;document.body.classList.add('has-player');feeds=orderedFeeds(g);feedIndex=-1;tried.clear();recoveryUsed.clear();attempts=0;playbackStarted=false;diagLog.clear();diagStatus='Connecting';lastFailure='Opening first stream source…';recordDiag('channel',`Selected ${g.name} (${feeds.length} sources)`);setText('playing-title',g.name);
 const sel=$('source');sel.replaceChildren();feeds.forEach((f,i)=>{const o=element('option','',f.sourceName||`Source ${i+1}`);o.value=String(i);sel.append(o);});
 $('video-overlay').hidden=true;quality=$('quality').value;openFeed(0);drawVirtual('channel',true);}
async function openFeed(i){if(!current||i<0||i>=feeds.length)return;const version=++generation;tried.add(i);feedIndex=i;attempts++;playbackStarted=false;diagStatus='Connecting';lastFailure='Connecting to stream server…';recordDiag('connect',`Attempt ${attempts}: ${feeds[i].sourceName||'Source '+(i+1)}`);
 const f=feeds[i],video=$('video');if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();stallStart=Date.now();$('source').value=String(i);
 playerStatus(`Connecting · ${f.sourceName||'source'} · ${i+1}/${feeds.length}`);
 if(A.streamFormat(f.url)==='DASH'){recordDiag('format','MPEG-DASH (.mpd) cannot play in this HLS player; looking for an HLS backup.');failover('Unsupported DASH stream (.mpd). Play this feed in VLC or select an HLS backup.');return;}
 let local;
 try{local=await window.streamBoard.openStream(f.url);}catch(e){if(version===generation){recordDiag('bridge',String(e.message).replace(/https?:\/\/[^\s]+/g,'[stream URL]'));failover(e.message);}return;}
 if(version!==generation)return;
  const isHls=/\.m3u8?(?:$|\?)/i.test(new URL(f.url).pathname+new URL(f.url).search);
 if(isHls&&window.Hls?.isSupported()){
  hls=new window.Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:20,backBufferLength:12,manifestLoadingTimeOut:18000,levelLoadingTimeOut:18000,fragLoadingTimeOut:20000});
  hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(version!==generation)return;recordDiag('manifest',`HLS manifest loaded, ${hls.levels.length} quality levels`);applyQuality();video.play().catch(()=>playerStatus('Press Play to start watching'));});
  hls.on(window.Hls.Events.ERROR,(_evt,details)=>{if(version!==generation)return;if(details.fatal){recordDiag('hls',`${details.type}: ${details.details||'unknown'}${details.response?.code?' · HTTP '+details.response.code:''}`);failover(details.details||details.type);}});
  hls.attachMedia(video);hls.loadSource(local);
 }else{video.src=local;video.play().catch(()=>{if(version===generation)playerStatus('Press Play to start watching');});}
}
function failover(reason){if(!current)return;lastFailure=diag.explain('stream',reason);diagStatus='Interrupted';recordDiag('failure',`${reason}: ${lastFailure}`);const i=feeds.findIndex((_f,index)=>!tried.has(index));if(i>=0){notice(`Switching source · ${reason}`);openFeed(i);return;}
 const old=current,explanation=lastFailure;generation++;if(hls){hls.destroy();hls=null;}const video=$('video');video.pause();video.removeAttribute('src');video.load();stallStart=0;diagStatus='Failed';lastFailure=explanation;playerStatus('All sources unavailable · Retry or change channel');$('video-overlay').hidden=false;setText('overlay-title',`${old.name} is unavailable`);setText('overlay-subtitle',explanation+' Retry the source or choose another channel.');updateDiagnostics();$('diagnostics-panel').open=true;notice('All sources failed; retry is available in diagnostics.');}
function applyQuality(){if(!hls)return;const cap=quality==='auto'?0:Number(quality);hls.currentLevel=-1;
 if(!cap){hls.autoLevelCapping=-1;return;}const levels=hls.levels.map((l,i)=>({i,height:l.height||0})).filter(x=>x.height>0).sort((a,b)=>a.height-b.height);const eligible=levels.filter(x=>x.height<=cap);hls.autoLevelCapping=eligible.length?eligible.at(-1).i:levels.length?levels[0].i:-1;}
function nextChannel(direction){if(!playable.length)return;let index=playable.findIndex(x=>x.id===current?.id);index=(index+direction+playable.length)%playable.length;play(playable[index]);}
function setSource(index){if(!current||!feeds[index])return;state.preferred[current.id]=feeds[index].url;persist();tried.clear();openFeed(index);}
function studioEntries(){return A.choose(channels,{categories:[...categoryCounts.keys()].filter(c=>!studioExcludedCategories.has(c)),sources:[...state.sources.map(s=>s.id).filter(id=>!studioExcludedSources.has(id)),'manual'],allowed:state.allowed,hiddenCategories:state.hiddenCategories,preferred:state.preferred,approvedOnly:$('studio-approved').checked,includeAlternatives:$('studio-backups').checked,hlsOnly:$('studio-hls-only').checked});}
function studioHeader(label,value){const div=element('div','studio-metric');div.append(element('strong','',Number(value).toLocaleString()),element('small','',label));return div;}
function studioCheck(label,checked,callback){const box=element('label','studio-check'),input=element('input');input.type='checkbox';input.checked=checked;input.onchange=()=>callback(input.checked);box.append(input,element('span','',label));return box;}
function renderStudio(){
 const report=A.summarize(channels,state.channels,state.sources,state.allowed,state.hiddenCategories);
 const metrics=$('studio-metrics');metrics.replaceChildren(studioHeader('Playlist entries',report.rawEntries),studioHeader('Unique channels',report.uniqueChannels),studioHeader('Backup feeds',report.extraSources),studioHeader('Uncategorized',report.uncategorized),studioHeader('Missing logos',report.missingLogo),studioHeader('Duplicate URLs',report.exactUrlDuplicates),studioHeader('HLS feeds',report.formats.HLS),studioHeader('DASH (unsupported)',report.formats.DASH));
 const sources=$('studio-sources');sources.replaceChildren();for(const row of report.sourceStats){sources.append(studioCheck(`${row.title} · ${row.count.toLocaleString()} entries`,!studioExcludedSources.has(row.id),on=>{if(on)studioExcludedSources.delete(row.id);else studioExcludedSources.add(row.id);renderStudioExportSummary();}));}
 const cats=$('studio-categories');cats.replaceChildren();for(const row of report.categories){cats.append(studioCheck(`${row.name} · ${row.count.toLocaleString()} channels`,!studioExcludedCategories.has(row.name),on=>{if(on)studioExcludedCategories.delete(row.name);else studioExcludedCategories.add(row.name);renderStudioExportSummary();}));}
 const reviews=$('studio-review');reviews.replaceChildren();const term=$('studio-search').value.trim().toLocaleLowerCase();const matching=channels.filter(g=>!term||`${g.name} ${g.category}`.toLocaleLowerCase().includes(term));
 // Poorly classified channels first, then the alphabetic catalog; the DOM is capped for responsiveness.
 matching.sort((a,b)=>Number(a.category!=='Other')-Number(b.category!=='Other')||a.name.localeCompare(b.name));
 const common=['Kids','Sports','News','Movies','Music','Entertainment','Documentary','Religious','Education','Lifestyle','Regional','Other'];
 const options=[...new Set([...common,...categoryCounts.keys()])].sort((a,b)=>a.localeCompare(b));
 for(const g of matching.slice(0,55)){
  const line=element('div','studio-review-row'),left=element('div','studio-review-label');left.append(element('strong','',g.name),element('small','',`${g.feeds.length} source${g.feeds.length===1?'':'s'} · ${g.category}`));line.append(left);
  const select=element('select');select.setAttribute('aria-label',`Category for ${g.name}`);for(const option of [...options,'Custom…']){const o=element('option','',option);o.value=option;select.append(o);}select.value=g.category;
  select.onchange=()=>{let target=select.value;if(target==='Custom…'){const answer=window.prompt('New category name',g.category);if(!answer){select.value=g.category;return;}target=A.clean(answer,42);if(!target){select.value=g.category;return;}}
   state.categoryOverrides[g.id]=target;rebuildCatalog();if(current){current=channels.find(x=>x.id===current.id)||current;if(!isAllowed(current))stop('Category is hidden or channel is blocked');}persist();drawCategories();renderStudio();};line.append(select);reviews.append(line);
 }
 if(matching.length>55)reviews.append(element('p','studio-help',`Showing 55 of ${matching.length.toLocaleString()} matches. Search to refine.`));
 if(!matching.length)reviews.append(element('p','studio-help','No channels match your search.'));
 const warnings=$('studio-warnings');warnings.replaceChildren();
 if(!report.conflicts.length)warnings.append(element('p','studio-help','No country/language identity conflicts detected. Stream playback is not verified.'));
 for(const issue of report.conflicts.slice(0,8))warnings.append(element('p','studio-warning',`${issue.name}: ${issue.reason} (${issue.groups} groups)`));
 warnings.append(element('p','studio-help',`${report.missingGuideId.toLocaleString()} channels lack TV guide IDs. ${report.uniqueUrls.toLocaleString()} distinct stream URLs found. ${report.formats.DASH.toLocaleString()} DASH feeds require an external DASH-capable player, such as VLC. No stream video checks have been run.`));
 renderStudioExportSummary();
}
function renderStudioExportSummary(){const entries=studioEntries(),distinct=new Set(entries.map(x=>x.channel.id));setText('studio-export-summary',`${distinct.size.toLocaleString()} channels · ${entries.length.toLocaleString()} URLs in export · ${$('studio-backups').checked?'Including backup feeds':'Preferred/first source only'}`);}
async function studioExport(format){const entries=studioEntries();if(!entries.length){setText('studio-status','No channels selected. Enable sources and categories or change the approval filter.');return;}
 const content=format==='csv'?A.createCsv(entries):A.createM3u(entries);try{const result=await window.streamBoard.exportFile({format,content});setText('studio-status',result.saved?`Saved ${entries.length.toLocaleString()} stream entries as ${format.toUpperCase()}.`:'Export cancelled.');}catch(e){setText('studio-status','Export failed: '+e.message);}}

function setCompactPlayer(compact){
 document.documentElement.classList.toggle('compact-player',compact);
 const button=$('compact-view');
 button.setAttribute('aria-pressed',String(compact));
 button.textContent=compact?'▣ Comfortable':'▣ Compact';
 button.title=compact?'Restore larger video':'Reduce player height for more channel browsing';
 try{localStorage.setItem('streamboard-compact-player',compact?'1':'0');}catch{}
}
let editingChannelId=null;
function searchEditableChannels(){
 const term=$('editor-search').value.trim().toLocaleLowerCase();const root=$('editor-search-results');root.replaceChildren();
 if(!term){root.append(element('p','editor-hint','Search by channel name or category, including channels that are not approved.'));return;}
 const matches=channels.filter(g=>`${g.name} ${g.category}`.toLocaleLowerCase().includes(term)).slice(0,60);
 for(const channel of matches){const button=element('button','editor-search-item',`${channel.name}  ·  ${channel.feeds.length} source(s)`);button.onclick=()=>openChannelEditor(channel.id);root.append(button);}
 if(!matches.length)root.append(element('p','editor-hint','No matching channels.'));
}
function openChannelEditor(id){
 const channel=channels.find(x=>x.id===id);if(!channel)return;editingChannelId=id;$('editor-search-results').hidden=true;$('editor-search').hidden=true;$('editor-back').hidden=false;$('editor-add-toggle').hidden=false;
 setText('editor-title',channel.name);setText('editor-description',`${channel.category} · ${channel.feeds.length} active stream URL(s). Changes are retained after playlist refresh.`);
 $('editor-add-form').hidden=true;setText('editor-message','');const root=$('editor-feeds');root.replaceChildren();channel.feeds.forEach((feed,i)=>{
  const row=element('div','editor-feed');const meta=element('div','editor-feed-head');meta.append(element('strong','',`${i+1}. ${feed.sourceName||'Source'}`),element('small','',feed.manualEdit?'Custom / edited':'Imported'));
  const name=element('input');name.type='text';name.maxLength=80;name.value=feed.sourceName||'';name.placeholder='Source label';name.setAttribute('aria-label',`Source ${i+1} label`);
  const url=element('input');url.type='url';url.value=feed.url;url.placeholder='https://…/live.m3u8';url.setAttribute('aria-label',`Source ${i+1} URL`);
  const actions=element('div','editor-feed-actions');const save=element('button','btn btn-primary','Save changes');save.onclick=()=>{
   try{const edit=E.saveFeed(state.channelEdits[id],feed.originalUrl,url.value.trim(),name.value);if(!feed.originalUrl&&feed.url!==url.value.trim())edit.extras=edit.extras.filter(x=>x.url!==feed.url);state.channelEdits[id]=edit;updateEditedChannel(id);setText('editor-message','Stream changes saved locally.');}catch(e){setText('editor-message',e.message);}
  };const remove=element('button','btn btn-subtle','Remove');remove.onclick=()=>{if(channel.feeds.length===1&&!window.confirm('This is the final stream URL. The channel will have no playable source. Remove it?'))return;state.channelEdits[id]=E.removeFeed(state.channelEdits[id],feed);updateEditedChannel(id);setText('editor-message','Stream removed.');};actions.append(save,remove);
  if(feed.originalUrl&&feed.manualEdit){const reset=element('button','btn btn-subtle','Restore imported URL');reset.onclick=()=>{state.channelEdits[id]=E.restore(state.channelEdits[id],feed.originalUrl);updateEditedChannel(id);};actions.append(reset);}
  row.append(meta,name,url,actions);root.append(row);
 });
 if(!channel.feeds.length)root.append(element('p','editor-hint','No active sources. Add a new stream below.'));
 if(!$('editor-dialog').open)$('editor-dialog').showModal();
}
function updateEditedChannel(id){
 const oldCurrent=current?.id;const oldUrl=feeds[feedIndex]?.url;
 rebuildCatalog();persist();if(oldCurrent===id){const refreshed=channels.find(x=>x.id===id);if(!refreshed||!refreshed.feeds.length){stop('No stream URLs available');}else if(refreshed.feeds.some(f=>f.url===oldUrl)){current=refreshed;feeds=orderedFeeds(refreshed);const sel=$('source');sel.replaceChildren();feeds.forEach((f,i)=>{const o=element('option','',f.sourceName||`Source ${i+1}`);o.value=String(i);sel.append(o);});feedIndex=feeds.findIndex(f=>f.url===oldUrl);sel.value=String(feedIndex);}else play(refreshed);}
 if(tab==='studio')renderStudio();else if(tab==='sources')renderSources();else filterRows();openChannelEditor(id);
}
function setup(){
 let compact=false;try{compact=localStorage.getItem('streamboard-compact-player')==='1';}catch{}
 setCompactPlayer(compact);
 $('compact-view').onclick=()=>setCompactPlayer(!document.documentElement.classList.contains('compact-player'));
 $('open-player-view').onclick=()=>switchTab('live');
 $('show-add-playlist').onclick=()=>{const el=$('add-source-details');el.open=true;el.scrollIntoView({behavior:'smooth',block:'nearest'});$('source-url').focus();};
 $('category-select').onchange=e=>{category=e.target.value;filterRows();};
 setupScroll();for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
 for(const [inputId] of [['search'],['access-search']])$(inputId).addEventListener('input',e=>{query=e.target.value;category='All';drawCategories();filterRows();});
 $('refresh-btn').onclick=refreshAll;$('refresh-all').onclick=refreshAll;
 $('studio-search').oninput=()=>{if(tab==='studio')renderStudio();};for(const id of ['studio-approved','studio-backups','studio-hls-only'])$(id).onchange=renderStudioExportSummary;
 $('studio-export-m3u').onclick=()=>studioExport('m3u');$('studio-export-csv').onclick=()=>studioExport('csv');
 $('allow-filtered').onclick=()=>{const existing=allowedIds();for(const g of showing)existing.add(g.id);state.allowed=[...existing];rebuildPlayable();persist();filterRows();};
 $('block-filtered').onclick=()=>{const block=new Set(showing.map(g=>g.id));state.allowed=state.allowed.filter(id=>!block.has(id));rebuildPlayable();if(current&&!isAllowed(current))stop('Channel blocked');persist();filterRows();};
 $('add-source').onsubmit=e=>{e.preventDefault();const url=$('source-url').value.trim();if(!L.urlOk(url)){report('Enter a valid HTTP/HTTPS playlist URL. Both .m3u and .m3u8 playlists are supported.');return;}const existing=state.sources.find(s=>samePlaylistUrl(s.url,url));if(existing){selectedSourceId=existing.id;renderSources();report(`${existing.title} is already saved. Refreshing it instead of importing a duplicate…`);refreshOne(existing);return;}
 const source={id:'user-'+Date.now(),title:$('source-name').value.trim()||new URL(url).hostname,url};state.sources.push(source);selectedSourceId=source.id;persist();$('source-url').value='';$('source-name').value='';$('add-source-details').open=false;renderSources();refreshOne(source);};
 $('github-form').onsubmit=async e=>{e.preventDefault();const url=$('github-url').value.trim(),root=$('repo-results');root.replaceChildren(element('span','', 'Checking public repository…'));
  try{const entries=await window.streamBoard.discoverGithub(url);root.replaceChildren();if(!entries.length){root.append(element('span','', 'No .m3u or .m3u8 files were found. Try the repository README for published playlist URLs.'));return;}
   for(const item of entries){const row=element('div','repo-result');row.append(element('small','',item.path));const add=element('button','','+ Import');add.onclick=()=>{
    const existing=state.sources.find(s=>samePlaylistUrl(s.url,item.url));if(existing){selectedSourceId=existing.id;renderSources();report(`${existing.title} already exists; refreshing.`);refreshOne(existing);return;}
    const source={id:'github-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:item.path.split('/').at(-1),url:item.url};state.sources.push(source);selectedSourceId=source.id;persist();renderSources();refreshOne(source);
   };row.append(add);root.append(row);}
  }catch(err){root.replaceChildren(element('span','',err.message));}
 };
 $('manage-channel-urls').onclick=()=>{$('editor-dialog').showModal();$('editor-add-toggle').hidden=true;$('editor-add-form').hidden=true;$('editor-search').hidden=false;$('editor-search-results').hidden=false;$('editor-back').hidden=true;setText('editor-title','Find a channel');setText('editor-description','Search the full library and edit its stream URLs.');$('editor-feeds').replaceChildren();$('editor-add-form').hidden=true;$('editor-search').focus();searchEditableChannels();};
 $('editor-search').oninput=searchEditableChannels;
 $('editor-back').onclick=()=>{$('editor-search').hidden=false;$('editor-search-results').hidden=false;$('editor-back').hidden=true;$('editor-add-form').hidden=true;$('editor-add-toggle').hidden=true;$('editor-feeds').replaceChildren();setText('editor-title','Find a channel');setText('editor-description','Search the full library and edit its stream URLs.');searchEditableChannels();};
 $('close-editor').onclick=()=>$('editor-dialog').close();
 $('editor-dialog').addEventListener('close',()=>{$('editor-add-form').hidden=true;});
 $('editor-add-toggle').onclick=()=>{$('editor-add-form').hidden=!$('editor-add-form').hidden;$('editor-add-url').focus();};
 $('editor-add-form').onsubmit=e=>{e.preventDefault();const id=editingChannelId;if(!id)return;try{state.channelEdits[id]=E.saveFeed(state.channelEdits[id],null,$('editor-add-url').value.trim(),$('editor-add-name').value);$('editor-add-url').value='';$('editor-add-name').value='';$('editor-add-form').hidden=true;updateEditedChannel(id);setText('editor-message','New backup stream saved.');}catch(err){setText('editor-message',err.message);}};
 $('edit-playing').onclick=()=>{if(current)openChannelEditor(current.id);};
 $('close-inspect').onclick=()=>$('inspect-dialog').close();
 $('retry-feed').onclick=retryCurrent;$('clear-diagnostics').onclick=()=>{diagLog.clear();updateDiagnostics();};$('copy-diagnostics').onclick=()=>{navigator.clipboard.writeText(diagnosticsReport()).then(()=>notice('Diagnostics copied')).catch(()=>notice('Copy failed'));};$('previous').onclick=()=>nextChannel(-1);$('next').onclick=()=>nextChannel(1);
 $('quality').onchange=e=>{quality=e.target.value;applyQuality();};$('source').onchange=e=>setSource(Number(e.target.value));
 $('fullscreen').onclick=()=>{const screen=$('screen');if(!document.fullscreenElement)screen.requestFullscreen().catch(()=>notice('Fullscreen not available'));else document.exitFullscreen().catch(()=>{});};
 document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
  if(e.key.toLowerCase()==='f'){$('fullscreen').click();}else if(e.key==='ArrowRight'&&e.ctrlKey)nextChannel(1);else if(e.key==='ArrowLeft'&&e.ctrlKey)nextChannel(-1);});
 const video=$('video');video.addEventListener('playing',()=>{stallStart=0;if(current){diagStatus='Playing';lastFailure='Stream is playing';if(!playbackStarted){playbackStarted=true;recordDiag('playback',`Playing ${video.videoWidth||'?'} × ${video.videoHeight||'?'}`);}playerStatus(`● LIVE · ${feeds[feedIndex]?.sourceName||'Source'}`);updateDiagnostics();}});
 video.addEventListener('waiting',()=>{if(current&&!stallStart){stallStart=Date.now();diagStatus='Buffering';recordDiag('buffer','Playback waiting for data');}});video.addEventListener('error',()=>{if(current&&feedIndex>=0){recordDiag('media',`HTMLMediaElement error ${video.error?.code||'unknown'}: ${video.error?.message||'no details'}`);failover('Media playback error');}});
 setInterval(()=>{if(current&&stallStart&&Date.now()-stallStart>30000){stallStart=0;const index=feedIndex;if(!recoveryUsed.has(index)){recoveryUsed.add(index);recordDiag('recovery','Stall threshold reached; retrying current source once');openFeed(index);}else failover('Playback stalled after retry');}updateDiagnostics();},3500);
}
async function init(){setup();try{state=await window.streamBoard.load();}catch(e){state={};report('Settings error: '+e.message);}if(!state||typeof state!=='object')state={};
 for(const k of ['channels','allowed','favorites','hiddenCategories'])if(!Array.isArray(state[k]))state[k]=[];
 if(!Array.isArray(state.sources))state.sources=[...defaults];if(!state.channelEdits||typeof state.channelEdits!=='object')state.channelEdits={};if(!state.preferred)state.preferred={};if(!state.categoryOverrides||typeof state.categoryOverrides!=='object')state.categoryOverrides={};
 rebuildCatalog();switchTab('live');if(!state.channels.length)refreshAll();
}
init();
