const {test}=require('node:test');const assert=require('node:assert/strict');const {classify,probeStream}=require('../stream-probe');
test('HLS manifest response detected',()=>assert.equal(classify({status:200,contentType:'application/vnd.apple.mpegurl',body:'#EXTM3U\n#EXT-X-TARGETDURATION:6'}).format,'HLS'));
test('DASH manifest response detected',()=>assert.equal(classify({status:200,contentType:'application/dash+xml',body:'<MPD></MPD>'}).format,'DASH'));
test('403 is access denied, not automatically geoblocked',()=>assert.equal(classify({status:403}).status,'forbidden'));
test('HTML is not video',()=>assert.equal(classify({status:200,contentType:'text/html',body:'<html>login</html>'}).status,'not-media'));
test('Protected entries are skipped before request',async()=>{const out=await probeStream({url:'https://example.org/a.mpd',requiresDrm:true},()=>{throw Error('network request should not occur')});assert.equal(out.status,'protected')});
test('manifest probe with injected fetch',async()=>{const response={ok:true,status:200,headers:{get:()=> 'application/vnd.apple.mpegurl'},text:async()=> '#EXTM3U\n#EXT-X-VERSION:3'};const result=await probeStream({url:'https://example.org/live.m3u8'},async()=>response);assert.equal(result.status,'manifest')});
