'use strict';
const L=window.StreamLogic,A=window.StreamAnalyzer,$=id=>document.getElementById(id),ROW=76;
const defaults=[
 {id:'bdix',title:'BDIX IPTV',url:'https://raw.githubusercontent.com/saeidrahmanbd/BDIX-IPTV/main/IPTV-Playlist.m3u'},
 {id:'vip',title:'VIP KB Pro',url:'https://raw.githubusercontent.com/Mrbotrx/VIP-m3u-playlist/refs/heads/main/Vip%20playlists/vip_kbpro.m3u8'},
 {id:'live-tg',title:'Live TG TV',url:'https://livetgtv.lovable.app/api/public/playlist.m3u'}];
let state={},channels=[],category='All',tab='live',query='',showing=[],categoryCounts=new Map(),playable=[],current=null,feeds=[],feedIndex=-1,tried=new Set(),hls=null,quality='auto',generation=0,stallStart=0,refreshing=false;
let studioExcludedCategories=new Set(),studioExcludedSources=new Set();
let activeList='channel',renderPending=false;const statuses=new Map();const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
function element(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el;}
function setText(id,value){$(id).textContent=value;}
function report(value){setText('import-status',value);}
function notice(value){let el=$('player-toast');el.textContent=value;el.style.display='block';clearTimeout(notice.timeout);notice.timeout=setTimeout(()=>{el.style.display='none';},3500);}
function persist(){return window.streamBoard.save(state).catch(e=>report('Save failed: '+e.message));}
const allowedIds=()=>new Set(state.allowed);const hiddenNames=()=>new Set(state.hiddenCategories);const favoriteIds=()=>new Set(state.favorites);
function isAllowed(g){return state.allowed.includes(g.id)&&!state.hiddenCategories.includes(g.category);}
function toggle(list,id){const index=list.indexOf(id);if(index<0)list.push(id);else list.splice(index,1);}
function rebuildCatalog(){channels=L.merge(state.channels);for(const ch of channels)if(state.categoryOverrides[ch.id])ch.category=state.categoryOverrides[ch.id];categoryCounts=new Map();for(const ch of channels)categoryCounts.set(ch.category,(categoryCounts.get(ch.category)||0)+1);rebuildPlayable();}
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
  if(isAccess){const input=element('input','checkbox');input.type='checkbox';input.checked=approved.has(g.id);input.setAttribute('aria-label','Allow '+g.name);input.onchange=()=>{toggle(state.allowed,g.id);rebuildPlayable();if(current&&!isAllowed(current))stop('Channel access disabled');persist();drawVirtual('access',true);};row.append(input);row.onclick=e=>{if(e.target===input)return;input.click();};}
  else{const star=element('button','star'+(favorite.has(g.id)?' active':''),favorite.has(g.id)?'★':'☆');star.title='Toggle favorite';star.setAttribute('aria-label',`Favorite ${g.name}`);star.onclick=e=>{e.stopPropagation();toggle(state.favorites,g.id);persist();if(tab==='favorites')filterRows();else drawVirtual('channel',true);};row.append(star);row.append(element('span','row-play','▶'));row.onclick=()=>play(g);row.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();play(g);}};}
  fragment.append(row);
 }
 holder.append(fragment);
}
function setupScroll(){for(const [type,id] of [['channel','channel-viewport'],['access','access-viewport']]){$(id).onscroll=()=>{if(activeList!==type||renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;drawVirtual(type);});};}}
function drawCategories(){const holder=$('chips');holder.replaceChildren();const opts=['All',...Array.from(categoryCounts.keys()).filter(n=>!state.hiddenCategories.includes(n)).sort(collator.compare)];
 for(const cat of opts){const b=element('button',cat===category?'active':'',cat==='All'?'All channels':cat);b.onclick=()=>{category=cat;filterRows();drawCategories();};holder.append(b);}
 const access=$('categories-access');access.replaceChildren();const names=Array.from(categoryCounts.keys()).sort(collator.compare);
 for(const cat of names){const hidden=state.hiddenCategories.includes(cat);const b=element('button',hidden?'hidden-cat':'',`${hidden?'○':'✓'} ${cat} (${categoryCounts.get(cat)})`);
  b.title=hidden?'Show category':'Hide category';b.onclick=()=>{toggle(state.hiddenCategories,cat);rebuildPlayable();if(current&&!isAllowed(current))stop('Category disabled');persist();drawCategories();filterRows();};access.append(b);}
}
function switchTab(next){tab=next;query='';category='All';$('search').value='';$('access-search').value='';
 for(const b of document.querySelectorAll('[data-tab]')){b.classList.toggle('on',b.dataset.tab===tab);b.setAttribute('aria-current',String(b.dataset.tab===tab));}
 const isCatalog=tab==='live'||tab==='favorites';$('catalog-pane').hidden=!isCatalog;$('access-pane').hidden=tab!=='access';$('sources-pane').hidden=tab!=='sources';$('studio-pane').hidden=tab!=='studio';
 const titles={live:['YOUR CHANNELS','Browse live TV','Pick a channel. Keep watching while you browse.'],favorites:['YOUR FAVORITES','Saved channels','Your shortcuts to the good stuff.'],access:['PARENTAL CONTROLS','Channel access','Control what appears in the channel browser.'],sources:['YOUR SOURCES','Manage playlists','Add, inspect and refresh channel sources.'],studio:['PLAYLIST MANAGER','Playlist Studio','Analyze, clean and compile one master playlist.']};
 const [eyebrow,title,subtitle]=titles[tab];setText('explore-eyebrow',eyebrow);setText('panel-title',title);setText('panel-subtitle',subtitle);setText('visible-count',tab==='sources'?`${state.sources.length} lists`:tab==='studio'?'Analyzer':`${channels.length.toLocaleString()} channels`);
 activeList=tab==='access'?'access':tab==='studio'||tab==='sources'?'none':'channel';drawCategories();if(tab==='sources')renderSources();else if(tab==='studio')renderStudio();else filterRows();
}
function inspect(s){const list=state.channels.filter(x=>x.sourceId===s.id);const counts=new Map(),hosts=new Map();for(const ch of list){counts.set(ch.category,(counts.get(ch.category)||0)+1);try{const host=new URL(ch.url).hostname;hosts.set(host,(hosts.get(host)||0)+1);}catch{}}
 const sort=map=>Array.from(map).sort((a,b)=>b[1]-a[1]);$('inspect-text').textContent=[`Playlist: ${s.title}`,`URL: ${s.url}`,`Imported entries: ${list.length}`,`Unique stream URLs: ${new Set(list.map(x=>x.url)).size}`,`Logos: ${list.filter(x=>x.logo).length}`,`TV guide IDs: ${list.filter(x=>x.tvgId).length}`, '', 'CATEGORIES', ...sort(counts).map(([name,n])=>`${name}: ${n}`), '', 'TOP STREAM HOSTS',...sort(hosts).slice(0,12).map(([name,n])=>`${name}: ${n}`),'','Note: A valid playlist entry is not proof of playable video.'].join('\n');$('inspect-dialog').showModal();}
function renderSources(){const root=$('source-list');root.replaceChildren();const counts=new Map();for(const c of state.channels)counts.set(c.sourceId,(counts.get(c.sourceId)||0)+1);
 for(const s of state.sources){const card=element('div','source-card'),host=new URL(s.url).hostname;card.append(element('strong','',s.title),element('small','',`${(counts.get(s.id)||0).toLocaleString()} entries · ${host} · ${statuses.get(s.id)||'Saved'}`));
  const acts=element('div','source-buttons');for(const [title,cb] of [['↻ Refresh',()=>refreshOne(s)],['Inspect',()=>inspect(s)],['Remove',()=>{if(!window.confirm(`Remove ${s.title} and its cached channels?`))return;state.sources=state.sources.filter(x=>x.id!==s.id);state.channels=state.channels.filter(x=>x.sourceId!==s.id);rebuildCatalog();if(current&&(!channels.some(g=>g.id===current.id)||!isAllowed(current)))stop('Channel removed');persist();renderSources();}]]){let btn=element('button','',title);btn.onclick=cb;acts.append(btn);}card.append(acts);root.append(card);}
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
function stop(reason='Select an approved channel'){generation++;const player=$('video');if(hls){hls.destroy();hls=null;}player.pause();player.removeAttribute('src');player.load();current=null;feeds=[];tried.clear();$('source').replaceChildren();$('video-overlay').hidden=false;setText('playing-title','Nothing playing yet');playerStatus(reason);setText('overlay-title','Pick a channel to start watching');setText('overlay-subtitle','Browse approved channels without losing the video.');drawVirtual('channel',true);}
function orderedFeeds(g){const options=[...g.feeds];const pref=state.preferred[g.id];const idx=options.findIndex(x=>x.url===pref);if(idx>0)options.unshift(...options.splice(idx,1));return options;}
function play(g){if(!isAllowed(g))return;current=g;feeds=orderedFeeds(g);feedIndex=-1;tried.clear();setText('playing-title',g.name);
 const sel=$('source');sel.replaceChildren();feeds.forEach((f,i)=>{const o=element('option','',f.sourceName||`Source ${i+1}`);o.value=String(i);sel.append(o);});
 $('video-overlay').hidden=true;quality=$('quality').value;openFeed(0);drawVirtual('channel',true);}
async function openFeed(i){if(!current||i<0||i>=feeds.length)return;const version=++generation;tried.add(i);feedIndex=i;
 const f=feeds[i],video=$('video');if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();stallStart=Date.now();$('source').value=String(i);
 playerStatus(`Connecting · ${f.sourceName||'source'} · ${i+1}/${feeds.length}`);
 let local;
 try{local=await window.streamBoard.openStream(f.url);}catch(e){if(version===generation)failover(e.message);return;}
 if(version!==generation)return;
 const isHls=/\.m3u8?(?:$|\?)/i.test(new URL(f.url).pathname+new URL(f.url).search);
 if(isHls&&window.Hls?.isSupported()){
  hls=new window.Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:20,backBufferLength:12,manifestLoadingTimeOut:18000,levelLoadingTimeOut:18000,fragLoadingTimeOut:20000});
  hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(version!==generation)return;applyQuality();video.play().catch(()=>playerStatus('Press Play to start watching'));});
  hls.on(window.Hls.Events.ERROR,(_evt,details)=>{if(version!==generation)return;if(details.fatal)failover(`Stream error: ${details.type}`);});
  hls.attachMedia(video);hls.loadSource(local);
 }else{video.src=local;video.play().catch(()=>{if(version===generation)playerStatus('Press Play to start watching');});}
}
function failover(reason){if(!current)return;const i=feeds.findIndex((_f,index)=>!tried.has(index));if(i>=0){notice(`Switching source · ${reason}`);openFeed(i);return;}
 const old=current;stop('All sources unavailable');setText('overlay-title',`${old.name} is unavailable`);setText('overlay-subtitle','Check playlist access or try another channel.');notice('No playable alternative was found.');}
function applyQuality(){if(!hls)return;const cap=quality==='auto'?0:Number(quality);hls.currentLevel=-1;
 if(!cap){hls.autoLevelCapping=-1;return;}const levels=hls.levels.map((l,i)=>({i,height:l.height||0})).filter(x=>x.height>0).sort((a,b)=>a.height-b.height);const eligible=levels.filter(x=>x.height<=cap);hls.autoLevelCapping=eligible.length?eligible.at(-1).i:levels.length?levels[0].i:-1;}
function nextChannel(direction){if(!playable.length)return;let index=playable.findIndex(x=>x.id===current?.id);index=(index+direction+playable.length)%playable.length;play(playable[index]);}
function setSource(index){if(!current||!feeds[index])return;state.preferred[current.id]=feeds[index].url;persist();tried.clear();openFeed(index);}
function studioEntries(){return A.choose(channels,{categories:[...categoryCounts.keys()].filter(c=>!studioExcludedCategories.has(c)),sources:state.sources.map(s=>s.id).filter(id=>!studioExcludedSources.has(id)),allowed:state.allowed,hiddenCategories:state.hiddenCategories,preferred:state.preferred,approvedOnly:$('studio-approved').checked,includeAlternatives:$('studio-backups').checked});}
function studioHeader(label,value){const div=element('div','studio-metric');div.append(element('strong','',Number(value).toLocaleString()),element('small','',label));return div;}
function studioCheck(label,checked,callback){const box=element('label','studio-check'),input=element('input');input.type='checkbox';input.checked=checked;input.onchange=()=>callback(input.checked);box.append(input,element('span','',label));return box;}
function renderStudio(){
 const report=A.summarize(channels,state.channels,state.sources,state.allowed,state.hiddenCategories);
 const metrics=$('studio-metrics');metrics.replaceChildren(studioHeader('Playlist entries',report.rawEntries),studioHeader('Unique channels',report.uniqueChannels),studioHeader('Backup feeds',report.extraSources),studioHeader('Uncategorized',report.uncategorized),studioHeader('Missing logos',report.missingLogo),studioHeader('Duplicate URLs',report.exactUrlDuplicates));
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
 warnings.append(element('p','studio-help',`${report.missingGuideId.toLocaleString()} channels lack TV guide IDs. ${report.uniqueUrls.toLocaleString()} distinct stream URLs found. No stream video checks have been run.`));
 renderStudioExportSummary();
}
function renderStudioExportSummary(){const entries=studioEntries(),distinct=new Set(entries.map(x=>x.channel.id));setText('studio-export-summary',`${distinct.size.toLocaleString()} channels · ${entries.length.toLocaleString()} URLs in export · ${$('studio-backups').checked?'Including backup feeds':'Preferred/first source only'}`);}
async function studioExport(format){const entries=studioEntries();if(!entries.length){setText('studio-status','No channels selected. Enable sources and categories or change the approval filter.');return;}
 const content=format==='csv'?A.createCsv(entries):A.createM3u(entries);try{const result=await window.streamBoard.exportFile({format,content});setText('studio-status',result.saved?`Saved ${entries.length.toLocaleString()} stream entries as ${format.toUpperCase()}.`:'Export cancelled.');}catch(e){setText('studio-status','Export failed: '+e.message);}}

function setup(){
 setupScroll();for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
 for(const [inputId] of [['search'],['access-search']])$(inputId).addEventListener('input',e=>{query=e.target.value;category='All';drawCategories();filterRows();});
 $('refresh-btn').onclick=refreshAll;$('refresh-all').onclick=refreshAll;
 $('studio-search').oninput=()=>{if(tab==='studio')renderStudio();};for(const id of ['studio-approved','studio-backups'])$(id).onchange=renderStudioExportSummary;
 $('studio-export-m3u').onclick=()=>studioExport('m3u');$('studio-export-csv').onclick=()=>studioExport('csv');
 $('allow-filtered').onclick=()=>{const existing=allowedIds();for(const g of showing)existing.add(g.id);state.allowed=[...existing];rebuildPlayable();persist();filterRows();};
 $('block-filtered').onclick=()=>{const block=new Set(showing.map(g=>g.id));state.allowed=state.allowed.filter(id=>!block.has(id));rebuildPlayable();if(current&&!isAllowed(current))stop('Channel blocked');persist();filterRows();};
 $('add-source').onsubmit=e=>{e.preventDefault();const url=$('source-url').value.trim();if(!L.urlOk(url)||state.sources.some(s=>s.url===url)){report('Enter an HTTP/HTTPS M3U URL that is not already saved.');return;}
 const source={id:'user-'+Date.now(),title:$('source-name').value.trim()||new URL(url).hostname,url};state.sources.push(source);persist();$('source-url').value='';$('source-name').value='';renderSources();refreshOne(source);};
 $('github-form').onsubmit=async e=>{e.preventDefault();const url=$('github-url').value.trim(),root=$('repo-results');root.replaceChildren(element('span','', 'Checking public repository…'));
  try{const entries=await window.streamBoard.discoverGithub(url);root.replaceChildren();if(!entries.length){root.append(element('span','', 'No .m3u or .m3u8 files were found. Try the repository README for published playlist URLs.'));return;}
   for(const item of entries){const row=element('div','repo-result');row.append(element('small','',item.path));const add=element('button','','+ Import');add.onclick=()=>{
    if(state.sources.some(s=>s.url===item.url)){report('Playlist already saved');return;}
    const source={id:'github-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:item.path.split('/').at(-1),url:item.url};state.sources.push(source);persist();renderSources();refreshOne(source);
   };row.append(add);root.append(row);}
  }catch(err){root.replaceChildren(element('span','',err.message));}
 };
 $('close-inspect').onclick=()=>$('inspect-dialog').close();
 $('previous').onclick=()=>nextChannel(-1);$('next').onclick=()=>nextChannel(1);
 $('quality').onchange=e=>{quality=e.target.value;applyQuality();};$('source').onchange=e=>setSource(Number(e.target.value));
 $('fullscreen').onclick=()=>{const screen=$('screen');if(!document.fullscreenElement)screen.requestFullscreen().catch(()=>notice('Fullscreen not available'));else document.exitFullscreen().catch(()=>{});};
 document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
  if(e.key.toLowerCase()==='f'){$('fullscreen').click();}else if(e.key==='ArrowRight'&&e.ctrlKey)nextChannel(1);else if(e.key==='ArrowLeft'&&e.ctrlKey)nextChannel(-1);});
 const video=$('video');video.addEventListener('playing',()=>{stallStart=0;if(current)playerStatus(`● LIVE · ${feeds[feedIndex]?.sourceName||'Source'}`);});
 video.addEventListener('waiting',()=>{if(current&&!stallStart)stallStart=Date.now();});video.addEventListener('error',()=>{if(current&&feedIndex>=0)failover('Media playback error');});
 setInterval(()=>{if(current&&stallStart&&Date.now()-stallStart>30000){stallStart=0;failover('Playback stalled');}},3500);
}
async function init(){setup();try{state=await window.streamBoard.load();}catch(e){state={};report('Settings error: '+e.message);}if(!state||typeof state!=='object')state={};
 for(const k of ['channels','allowed','favorites','hiddenCategories'])if(!Array.isArray(state[k]))state[k]=[];
 if(!Array.isArray(state.sources))state.sources=[...defaults];if(!state.preferred)state.preferred={};if(!state.categoryOverrides||typeof state.categoryOverrides!=='object')state.categoryOverrides={};
 rebuildCatalog();switchTab('live');if(!state.channels.length)refreshAll();
}
init();
