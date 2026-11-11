'use strict';
/** Local, session-scoped media fetch bridge for HLS. No remote code execution, no CORS bypass in renderer. */
const http = require('node:http');
const crypto = require('node:crypto');
const {Readable}=require('node:stream');

function httpUrl(address){
  const url=new URL(address);
  if(!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('Stream must be an HTTP/HTTPS URL without embedded credentials');
  }
  return url.href;
}
function isManifest(url,contentType){
  return /(?:mpegurl|vnd\.apple\.mpegurl)/i.test(contentType||'') || /\.m3u8?(?:[?#]|$)/i.test(url);
}
function rewriteManifest(text,base,register){
  if(!text.replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U'))throw Error('Upstream response is not an HLS manifest');
  const lines=text.split(/\r?\n/);
  return lines.map(line=>{
    if(line.startsWith('#')){
      // Media/iframe playlists, init segments, AES-128 keys, LL-HLS parts and rendition reports.
      return line.replace(/\bURI=(['"])(.*?)\1/g,(all,q,uri)=>{
        try {const absolute=new URL(uri,base).href;return `URI=${q}${register(absolute)}${q}`;}catch{return all;}
      });
    }
    if(!line.trim())return line;
    try{return register(new URL(line.trim(),base).href);}catch{return line;}
  }).join('\n');
}
function createStreamBridge({fetchImpl=global.fetch, requestTimeoutMs=18000}={}){
  const sessions=new Map();
  let server,port=0;
  const HEADERS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range, Accept, Content-Type','Cross-Origin-Resource-Policy':'cross-origin','X-Content-Type-Options':'nosniff'};
  function send(res,status,message){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8',...HEADERS});res.end(message);}
  function sessionFor(initial){
    const token=crypto.randomBytes(24).toString('hex');
    const session={token,resources:new Map(),byUrl:new Map(),created:Date.now()};
    sessions.set(token,session);
    while(sessions.size>4){sessions.delete(sessions.keys().next().value);}
    function register(raw){
      const url=httpUrl(raw);
      let key=session.byUrl.get(url);
      if(!key){
        if(session.resources.size>=25000)throw new Error('HLS resource limit reached');
        key=crypto.randomBytes(12).toString('hex');session.byUrl.set(url,key);session.resources.set(key,url);
      }
      return `http://127.0.0.1:${port}/s/${token}/${key}`;
    }
    return register(initial);
  }
  async function handler(req,res){
    const host=req.headers.host;
    if(host!==`127.0.0.1:${port}`)return send(res,403,'Host not allowed');
    if(req.method==='OPTIONS'){res.writeHead(204,HEADERS);res.end();return;}
    if(!['GET','HEAD'].includes(req.method))return send(res,405,'Method not allowed');
    const matched=/^\/s\/([a-f0-9]{48})\/([a-f0-9]{24})$/.exec((req.url||'').split('?')[0]);
    if(!matched)return send(res,404,'Not found');
    const session=sessions.get(matched[1]);
    if(!session || Date.now()-session.created>8*60*60*1000)return send(res,404,'Stream session expired');
    const upstream=session.resources.get(matched[2]);
    if(!upstream)return send(res,404,'Resource not registered');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);
    // Abort when the viewer stops consuming data, but not when response naturally ends.
    res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try {
      const headers={Accept:'*/*','User-Agent':'StreamBoard-IPTV/1.2 (Windows; local media player)'};
      if(req.headers.range && /^bytes=\d*-\d*$/.test(req.headers.range))headers.Range=req.headers.range;
      const response=await fetchImpl(upstream,{method:req.method,headers,signal:controller.signal,redirect:'follow'});
      clearTimeout(timeout);
      if(!response.ok){return send(res,response.status,`Upstream HTTP ${response.status}`);}
      const base=response.url||upstream;
      const type=response.headers.get('content-type')||'';
      const manifest=isManifest(base,type)||isManifest(upstream,type);
      if(manifest){
        const length=Number(response.headers.get('content-length')||0);
        if(length>2*1024*1024)return send(res,413,'HLS manifest too large');
        if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl',...HEADERS});res.end();return;}
        const parts=[];let size=0;
        for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)return send(res,413,'HLS manifest too large');parts.push(chunk);}
        const rewritten=rewriteManifest(Buffer.concat(parts).toString('utf8'),base,(url)=>{
          const valid=httpUrl(url);
          let id=session.byUrl.get(valid);
          if(!id){if(session.resources.size>=25000)throw Error('HLS resource limit reached');id=crypto.randomBytes(12).toString('hex');session.byUrl.set(valid,id);session.resources.set(id,valid);}
          return `http://127.0.0.1:${port}/s/${session.token}/${id}`;
        });
        res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl; charset=utf-8','Cache-Control':'no-cache',...HEADERS});res.end(rewritten);return;
      }
      const passthrough={'Content-Type':type||'application/octet-stream',...HEADERS};
      for(const field of ['content-range','accept-ranges','cache-control','last-modified','etag']){
        const value=response.headers.get(field);if(value)passthrough[field]=value;
      }
      // Never copy upstream Content-Length; fetch may transparently decode a transfer.
      res.writeHead(response.status,passthrough);
      if(req.method==='HEAD'){res.end();return;}
      if(!response.body){res.end();return;}
      await new Promise((resolve,reject)=>{
        const stream=Readable.fromWeb(response.body);
        stream.on('error',reject);res.on('error',reject);res.on('finish',resolve);res.on('close',resolve);
        stream.pipe(res);
      });
    }catch(err){
      clearTimeout(timeout);
      if(!res.headersSent)send(res,502,`Playback source error: ${err.message}`);
      else res.destroy();
    }
  }
  async function start(){
    if(server)return port;
    server=http.createServer((req,res)=>{handler(req,res).catch(err=>{if(!res.headersSent)send(res,500,err.message);else res.destroy();});});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    port=server.address().port;
    return port;
  }
  return {
    start,open:(url)=>{if(!port)throw Error('Playback bridge has not started');return sessionFor(url);},
    close:()=>new Promise(resolve=>{sessions.clear();if(server){server.close(()=>resolve());server.closeAllConnections?.();server=null;}else resolve();}),
    get port(){return port;}
  };
}
module.exports={createStreamBridge,rewriteManifest,httpUrl,isManifest};
