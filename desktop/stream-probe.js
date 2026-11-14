'use strict';
// Bounded HTTP-level stream inspection. This is NOT a video playback test.
const MAX_BYTES=32768;
function classify({status, contentType='', body='', url='', protectedStream=false, needsHeaders=false}){
 if(protectedStream) return {status:'protected',format:'DASH / DRM',detail:'Protected media requires a compatible authorized player'};
 if(status===401)return {status:'authorization',format:'Unknown',detail:'Server returned 401 (authentication needed)'};
 if(status===403)return {status:'forbidden',format:'Unknown',detail:'Server returned 403 (access denied; reason unknown)'};
 if(status===404||status===410)return {status:'missing',format:'Unknown',detail:`Server returned HTTP ${status}`};
 if(status===429)return {status:'rate-limited',format:'Unknown',detail:'Server returned HTTP 429'};
 if(status<200||status>=400)return {status:'http-error',format:'Unknown',detail:`Server returned HTTP ${status}`};
 const value=String(body).replace(/^\uFEFF/,'').trimStart();const ct=String(contentType).toLowerCase();
 const dash=/^<\?xml[^>]*>\s*<MPD\b|^<MPD\b/i.test(value)||/dash\+xml/.test(ct);
 const hls=/^#EXTM3U(?:\s|$)/.test(value)&&/#EXT-X-/i.test(value)||/application\/vnd\.apple\.mpegurl|application\/x-mpegurl/.test(ct);
 if(dash)return {status:needsHeaders?'headers-required':'manifest',format:'DASH',detail:needsHeaders?'DASH manifest detected; playlist declares special headers':'DASH manifest detected; playback not verified'};
 if(hls)return {status:needsHeaders?'headers-required':'manifest',format:'HLS',detail:needsHeaders?'HLS manifest detected; required headers may prevent playback':'HLS manifest detected; playback not verified'};
 const path=(()=>{try{return new URL(url).pathname.toLowerCase();}catch{return '';}})();
 if(/video\/mp4/.test(ct)||/\.mp4$/.test(path))return {status:'media',format:'MP4',detail:'Video endpoint responds; decoding not verified'};
 if(/video\/mp2t/.test(ct)||/\.ts$/.test(path))return {status:'media',format:'TS',detail:'Transport stream endpoint responds; decoding not verified'};
 if(/text\/html|application\/json/.test(ct)||/^<!doctype html|^<html|^\{/.test(value))return {status:'not-media',format:'Unknown',detail:'Endpoint returned HTML or JSON instead of video manifest'};
 return {status:needsHeaders?'headers-required':'unknown',format:'Unknown',detail:needsHeaders?'Special request headers are declared; cannot verify playback':'Server responded, media format unknown'};
}
async function probeStream(input, fetcher=fetch){
 const {url,requiresDrm=false,hasRequestHeaders=false}=input||{};
 if(!url||!/^https?:\/\//i.test(url))return {status:'invalid',format:'Unknown',detail:'Invalid HTTP(S) URL'};
 if(requiresDrm)return classify({protectedStream:true});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetcher(url,{method:'GET',redirect:'follow',signal:controller.signal,headers:{Range:`bytes=0-${MAX_BYTES-1}`}});
  const ct=response.headers?.get?.('content-type')||'';
  let body='';const textLike=/mpegurl|m3u|dash\+xml|text\/|application\/xml|application\/json|application\/octet-stream/i.test(ct)||!ct||/\.m3u8?(?:$|\?)/i.test(url)||/\.mpd(?:$|\?)/i.test(url);
  if(response.ok&&textLike){
   if(response.body?.getReader){const reader=response.body.getReader();let size=0;const chunks=[];try{while(size<MAX_BYTES){const {value,done}=await reader.read();if(done)break;const keep=value.subarray(0,Math.min(value.length,MAX_BYTES-size));chunks.push(keep);size+=keep.length;if(size>=MAX_BYTES)break;}}finally{await reader.cancel().catch(()=>{});}body=Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8');}
   else {body=(await response.text()).slice(0,MAX_BYTES);}
  }else{await response.body?.cancel?.().catch(()=>{});}
  return {...classify({status:response.status,contentType:ct,body,url,needsHeaders:hasRequestHeaders}),httpStatus:response.status};
 }catch(error){return {status:error.name==='AbortError'?'timeout':'network-error',format:'Unknown',detail:error.name==='AbortError'?'Timed out after 8 seconds':'Network or connection error'};}
 finally{clearTimeout(timeout);}
}
module.exports={classify,probeStream};
