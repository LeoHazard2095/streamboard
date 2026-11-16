'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const {downloadPlaylist,requestNode}=require('../playlist-download');
const {safeHeaders}=require('../request-headers');
const {createStreamBridge}=require('../stream-bridge');
const L=require('../src/logic');
function serve(handler){const server=http.createServer(handler);return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}`})));}
async function close(s){await new Promise(r=>s.close(r));}
test('connection reset in Electron retries using Node HTTP, retaining actual playlist text',async()=>{
 const {server,url}=await serve((req,res)=>{assert.match(req.headers['user-agent'],/VLC/);res.end('#EXTM3U\n#EXTINF:-1,Kids\nhttps://example.org/kids.m3u8\n');});
 try{const out=await downloadPlaylist(url,async()=>{throw Error('net::ERR_CONNECTION_RESET')});assert.equal(out.method,'Node HTTP');assert.equal(out.httpStatus,200);assert.match(out.text,/#EXTINF/);assert.match(out.fallbackReason,/CONNECTION_RESET/);}finally{await close(server);}
});
test('does not retry Electron HTTP 404 or invalid document',async()=>{
 let count=0;await assert.rejects(downloadPlaylist('https://example.com/list.m3u',async()=>({ok:false,status:404}),{nodeDownload:async()=>{count++}}),/404/);assert.equal(count,0);
});
test('Node HTTP follows bounded redirects and refuses non-M3U',async()=>{
 const {server,url}=await serve((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'/list'});res.end();}else if(req.url==='/list')res.end('#EXTM3U\n#EXTINF:-1,T\nhttps://example.com/t.m3u8');else res.end('<html>No playlist</html>');});
 try{assert.match((await requestNode(url+'/redirect')).text,/#EXTM3U/);await assert.rejects(requestNode(url+'/wrong'),/not an M3U/);}finally{await close(server);}
});
test('parses per-channel headers in EXTINF, EXTVLCOPT, and suffix without bleeding into next channel',()=>{
 const rows=L.parse('#EXTM3U\n#EXTINF:-1 http-user-agent="Mozilla/5.0 Test" http-referrer="https://origin.example/watch" group-title="Kids",One\nhttps://example.org/one.m3u8\n#EXTINF:-1,Two\n#EXTVLCOPT:http-user-agent=VLC/3.0\nhttps://example.org/two.m3u8|Referer=https%3A%2F%2Fsecond.example%2F\n#EXTINF:-1,Three\nhttps://example.org/three.m3u8','abc','Test','https://example.org/list.m3u');
 assert.equal(rows.length,3);assert.equal(rows[0].headers['User-Agent'],'Mozilla/5.0 Test');assert.equal(rows[0].headers.Referer,'https://origin.example/watch');assert.equal(rows[1].headers['User-Agent'],'VLC/3.0');assert.equal(rows[1].headers.Referer,'https://second.example/');assert.deepEqual(rows[2].headers,{});
});
test('blocks untrusted header types and injection',()=>{
 assert.deepEqual(safeHeaders({'Authorization':'Bearer secret','Cookie':'session=abc','Host':'foo','User-Agent':'VLC/3.0','Referer':'javascript:alert(1)'}),{'User-Agent':'VLC/3.0'});
 assert.deepEqual(safeHeaders({'User-Agent':'bad\r\nInjected: yes'}),{});
});
test('HLS local bridge forwards selected User-Agent and Referer to both manifest and segment',async()=>{
 const requests=[];const {server,url}=await serve((req,res)=>{requests.push({url:req.url,ua:req.headers['user-agent'],referer:req.headers.referer});if(req.url==='/master.m3u8'){res.setHeader('Content-Type','application/vnd.apple.mpegurl');res.end('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nsegment.ts\n');}else res.end('MEDIA');});
 const bridge=createStreamBridge();try{await bridge.start();const local=bridge.open(url+'/master.m3u8',{'User-Agent':'Custom Agent','Referer':'https://ref.example/page'});const m=await (await fetch(local)).text();const segment=m.split('\n').find(x=>x.startsWith('http://'));await fetch(segment);assert.equal(requests.length,2);for(const r of requests){assert.equal(r.ua,'Custom Agent');assert.equal(r.referer,'https://ref.example/page');}}finally{await bridge.close();await close(server);}
});
