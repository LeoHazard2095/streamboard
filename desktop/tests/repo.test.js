const {test}=require('node:test');const assert=require('node:assert/strict');const {parseRepo,candidates,discover}=require('../repo-discovery');
test('Only accepts repository root links, never guessed playlist paths',()=>{
 assert.deepEqual(parseRepo('https://github.com/Diljan707/new'),{owner:'Diljan707',name:'new'});
 assert.throws(()=>parseRepo('https://github.com/Diljan707/new/blob/main/playlist.m3u'));
 assert.throws(()=>parseRepo('https://example.com/Diljan707/new'));
});
test('Discovers only real M3U files in a returned repository tree',async()=>{
 const data=[{type:'blob',path:'live/India TV.m3u',size:1223},{type:'blob',path:'README.md'},{type:'blob',path:'extra.m3u8',size:421},{type:'tree',path:'directory.m3u'}];
 const found=candidates(data,'Diljan707','new','main');assert.equal(found.length,2);
 assert.match(found[0].url,/India%20TV\.m3u$/);
 const fetch=async url=>({ok:true,json:async()=>url.endsWith('/new')?{default_branch:'main'}:{tree:data}});
 const result=await discover('https://github.com/Diljan707/new',fetch);assert.equal(result.length,2);
});
