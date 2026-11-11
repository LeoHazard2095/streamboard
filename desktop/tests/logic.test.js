const {test}=require('node:test');const assert=require('node:assert/strict');
const {parse,merge,category}=require('../src/logic.js');
test('M3U with group, logos and aliases',()=>{
 const text='#EXTM3U\n#EXTINF:-1 tvg-id="cn.in" tvg-logo="https://cdn.example/logo.png" group-title="Kids",Cartoon Network HD\nhttps://one.example/cn/master.m3u8';
 const list=parse(text,'1','List A','https://example.com/a.m3u');assert.equal(list.length,1);assert.equal(list[0].category,'Kids');
 const other=parse('#EXTM3U\n#EXTINF:-1 group-title="Kids",Cartoon Network SD\nhttps://two.example/cn.m3u8','2','List B','https://x.example/playlist.m3u');
 const combined=merge(list.concat(other));assert.equal(combined.length,1);assert.equal(combined[0].feeds.length,2);
});
test('Country conflicts and duplicate stream URL',()=>{
 const input=parse('#EXTM3U\n#EXTINF:-1 tvg-country="IN",One Channel\nhttps://a.example/a.m3u8\n#EXTINF:-1 tvg-country="PK",One Channel\nhttps://b.example/b.m3u8\n#EXTINF:-1 tvg-country="PK",One Channel\nhttps://b.example/b.m3u8','1','List','https://a.example/list.m3u');
 const groups=merge(input);assert.equal(groups.length,2);assert.equal(groups[1].feeds.length,1);
});
test('Direct HLS is a single source, decorative headers ignored',()=>{
 assert.equal(parse('#EXTM3U\n#EXT-X-TARGETDURATION:3','one','Direct','https://one.example/live.m3u8').length,1);
 assert.equal(parse('#EXTM3U\n#EXTINF:-1,⚡ IPTV LINKS\nhttps://x.example/not-channel\n#EXTINF:-1,Actual\nhttps://x.example/real','one','A','https://x.example/a.m3u').length,1);
});
test('8000 alternate streams merge without pathological runtime',()=>{
 const raw=[];
 for(let i=0;i<8000;i++)raw.push({name:i%2?'Cartoon Network SD':'Cartoon Network HD',url:`https://example.com/${i}.m3u8`,logo:'',tvgId:'',group:'Kids',category:'Kids',language:'Hindi',country:'IN',sourceId:'test',sourceName:'Test'});
 const t=Date.now();const groups=merge(raw);
 assert.equal(groups.length,1);assert.equal(groups[0].feeds.length,8000);
 assert.ok(Date.now()-t<5000,'Merging 8000 feeds should remain responsive');
});
