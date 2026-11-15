const {test}=require('node:test');const assert=require('node:assert/strict');const R=require('../stream-report');
const rows=[{entry:{name:'HLS',url:'https://example.com/a'},result:{status:'manifest',format:'HLS'}},{entry:{name:'DRM',url:'https://example.com/b'},result:{status:'protected',format:'DASH / DRM'}},{entry:{name:'Not Found',url:'https://example.com/c'},result:{status:'missing',httpStatus:404,detail:'not found'}}];
test('stream reports count manifests, DRM, issues',()=>assert.deepEqual(R.summarize(rows),{checked:3,manifests:1,protected:1,issues:1}));
test('filters isolate manifest and failures',()=>{assert.equal(rows.filter(x=>R.matchesFilter(x,'manifest')).length,1);assert.equal(rows.filter(x=>R.matchesFilter(x,'issues')).length,1)});
test('headers-required HLS counts as detected but not playable',()=>assert.equal(R.isManifest({status:'headers-required',format:'HLS'}),true));
test('CSV safely quotes URLs and spreadsheet formulas',()=>{const csv=R.toCsv([{entry:{name:'=DANGEROUS',url:'https://example.com/a?x=1,2'},result:{status:'manifest',format:'HLS'}}],'Test');assert.match(csv,/"'=DANGEROUS"/);assert.match(csv,/"https:\/\/example.com\/a\?x=1,2"/)});
