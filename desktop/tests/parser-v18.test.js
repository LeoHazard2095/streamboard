const {test}=require('node:test');const assert=require('node:assert/strict');
const L=require('../src/logic.js'),A=require('../src/analyzer.js');
test('Zio-style DASH tags and URL suffix are recognized without treating options as URL',()=>{
 const text='#EXTM3U\n#KODIPROP:inputstream.adaptive.manifest_type=mpd\n#KODIPROP:inputstream.adaptive.license_type=org.w3.clearkey\n#KODIPROP:inputstream.adaptive.license_key=example-sensitive-value\n#KODIPROP:inputstream.adaptive.manifest_headers=User-Agent=Example\n#EXTINF:-1 tvg-id="123" tvg-name="News Example" group-title="English",News Example\n#EXTVLCOPT:http-user-agent=Example\nhttps://example.org/live/index.mpd?signature=abc|User-Agent=Example%2F1.0\n';
 const rows=L.parse(text,'zio','Zio TV','https://example.org/playlist.m3u');assert.equal(rows.length,1);assert.equal(rows[0].url,'https://example.org/live/index.mpd?signature=abc');assert.equal(rows[0].formatHint,'DASH');assert.equal(rows[0].requiresDrm,true);assert.equal(rows[0].hasRequestHeaders,true);assert.equal(A.streamFormat(rows[0].url,rows[0]),'DASH');assert.ok(!JSON.stringify(rows).includes('example-sensitive-value'));
});
test('metadata does not leak into next channel',()=>{
 const rows=L.parse('#EXTM3U\n#KODIPROP:inputstream.adaptive.license_type=org.w3.clearkey\n#EXTINF:-1,Protected\nhttps://example.org/one.mpd\n#EXTINF:-1,Open\nhttps://example.org/two.m3u8','a','A','https://example.org/list.m3u');assert.equal(rows.length,2);assert.equal(rows[0].requiresDrm,true);assert.equal(rows[1].requiresDrm,false);
});
test('explicit HLS hint recognizes extensionless endpoint',()=>{
 const rows=L.parse('#EXTM3U\n#KODIPROP:inputstream.adaptive.manifest_type=hls\n#EXTINF:-1,Example\nhttps://example.org/channel?id=123','a','A','https://example.org/list.m3u');assert.equal(A.streamFormat(rows[0].url,rows[0]),'HLS');
});
test('standalone HLS playlist is detected',()=>{const rows=L.parse('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:1\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nchunk1.ts','a','A','https://example.org/list.m3u8');assert.equal(rows.length,1);assert.equal(rows[0].formatHint,'HLS');});
test('HLS only export excludes Zio protected DASH',()=>{const rows=L.parse('#EXTM3U\n#KODIPROP:inputstream.adaptive.manifest_type=mpd\n#EXTINF:-1,One\nhttps://example.org/a.mpd\n#EXTINF:-1,Two\nhttps://example.org/b.m3u8','a','A','https://example.org/list.m3u');const groups=L.merge(rows);assert.equal(A.choose(groups,{categories:['Other'],sources:['a'],approvedOnly:false,hlsOnly:true}).length,1);});
