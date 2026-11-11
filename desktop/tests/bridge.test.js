'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');const {createStreamBridge,rewriteManifest}=require('../stream-bridge');
test('HLS manifest rewriting retains nested segments and keys',()=>{
 const input='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000\nsub/720.m3u8\n#EXT-X-KEY:METHOD=AES-128,URI="keys/test.key"\nvideo/one.ts';
 const urls=[];const out=rewriteManifest(input,'https://cdn.example/live/master.m3u8',url=>{urls.push(url);return 'http://localhost/proxy/'+urls.length;});
 assert.deepEqual(urls,['https://cdn.example/live/sub/720.m3u8','https://cdn.example/live/keys/test.key','https://cdn.example/live/video/one.ts']);
 assert.match(out,/URI="http:\/\/localhost\/proxy\/2"/);
});
test('Loopback HLS bridge proxies HTTP playlist and media without requiring upstream CORS',async()=>{
 const upstream=http.createServer((req,res)=>{
  if(req.url==='/master.m3u8'){res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl'});res.end('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nchunk.ts\n');}
  else if(req.url==='/chunk.ts'){res.writeHead(200,{'Content-Type':'video/mp2t'});res.end(Buffer.from([0x47,0x41,0x42,0x43]));}
  else{res.writeHead(404);res.end();}
 });
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const bridge=createStreamBridge();try{
  await bridge.start();const url=bridge.open(`http://127.0.0.1:${upstream.address().port}/master.m3u8`);
  const response=await fetch(url);assert.equal(response.status,200);
  const manifest=await response.text();assert.match(manifest,/127\.0\.0\.1/);assert.ok(manifest.includes('#EXTM3U'));
  const segment=manifest.split('\n').find(x=>x.startsWith('http://'));const media=await fetch(segment);
  assert.equal(media.status,200);assert.deepEqual(Buffer.from(await media.arrayBuffer()),Buffer.from([0x47,0x41,0x42,0x43]));
  const forbidden=await fetch(url.replace(/\/s\/[a-f0-9]{48}\//,'/s/'+ '0'.repeat(48) +'/'));assert.equal(forbidden.status,404);
 }finally{await bridge.close();await new Promise(r=>upstream.close(r));}
});
