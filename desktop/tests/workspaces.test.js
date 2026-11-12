'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=(name)=>fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8');
test('Each management workflow has distinct controls rather than the watching sidebar',()=>{
 const html=source('index.html');
 for(const id of ['sources-pane','studio-pane','access-pane','source-list','source-detail-title','source-detail-metrics','source-detail-categories','source-detail-refresh','source-detail-inspect','source-detail-remove','access-viewport','channel-viewport','category-select']){
  assert.match(html,new RegExp(`id="${id}"`),`${id} missing`);
 }
 assert.match(html,/id="add-source-details" class="management-expander"/);
 assert.doesNotMatch(html,/id="chips" class="chips"[^>]*aria-label="Category filters"/);
});
test('Player persists across navigation, and management pages use compact layout only while watching',()=>{
 const code=source('app.js'),css=source('workspace.css');
 const start=code.indexOf('function switchTab(next)'),end=code.indexOf('function inspect(s)',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(code.slice(start,end),/(?:stop|openFeed|play)\s*\(/);
 assert.match(code,/document\.body\.dataset\.view=next/);
 assert.match(code,/document\.body\.classList\.add\('has-player'\)/);
 assert.match(code,/document\.body\.classList\.remove\('has-player'\)/);
 assert.match(css,/body\.has-player:is\(\[data-view="sources"\]/);
 assert.match(css,/\.source-workspace\s*\{display:grid;/);
 assert.match(css,/\.access-workspace\s*\{display:grid;/);
});
test('New source details are connected to actual selection and actions',()=>{
 const code=source('app.js');
 assert.match(code,/selectedSourceId=s\.id;renderSources\(\)/);
 assert.match(code,/source-detail-refresh'\)\.onclick=\(\)=>refreshOne\(selected\)/);
 assert.match(code,/source-detail-remove'\)\.onclick=\(\)=>removeSource\(selected\)/);
});
