'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StreamDiagnostics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const MAX=90;
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='http:'||u.protocol==='https:'?`${u.protocol}//${u.host}${u.pathname}`:'Invalid URL';}catch{return 'Invalid URL';}}
 function explain(type,detail=''){
  const v=String(detail||'');
  if(/manifestParsingError|manifestIncompatibleCodecsError/i.test(v))return 'Playlist was returned but is invalid or uses unsupported codecs.';
  if(/manifestLoadError|levelLoadError|fragLoadError|keyLoadError/i.test(v))return 'Stream request failed (server, access or network).';
  if(/timeout|timed out|stalled/i.test(v))return 'The stream stopped responding or buffering took too long.';
  if(/buffer|mediaError/i.test(v))return 'The player could not decode or buffer this stream.';
  if(/network|fetch|HTTP|502|403|404|401/i.test(v))return 'The stream server or network rejected the request.';
  if(type==='media')return 'The media decoder encountered a playback error.';
  return 'Playback failed; inspect the recent events for details.';
 }
 function createLog(now=()=>Date.now()){
  let events=[];
  return {push(kind,message,meta={}){const e={at:new Date(now()).toISOString(),kind:String(kind).slice(0,32),message:String(message).slice(0,300),...meta};events.push(e);if(events.length>MAX)events.shift();return e;},all(){return events.slice();},clear(){events=[];}};
 }
 function report({channel,feed,events,video,attempts,status}){
  const rows=[`StreamBoard playback diagnostics`,`Status: ${status||'Idle'}`,`Channel: ${channel?.name||'None'}`,`Source: ${feed?.sourceName||'None'}`,`Stream URL (without query credentials): ${feed?.url?safeUrl(feed.url):'None'}`,`Attempts: ${attempts||0}`];
  if(video)rows.push(`Resolution: ${video.videoWidth||0}x${video.videoHeight||0}`,`Ready state: ${video.readyState}`,`Network state: ${video.networkState}`,`Buffered ahead: ${Number(video.bufferedAhead||0).toFixed(1)} seconds`);
  rows.push('','Recent events:');for(const e of events||[])rows.push(`${e.at} [${e.kind}] ${e.message}`);return rows.join('\n');
 }
 return {safeUrl,explain,createLog,report};
});
