'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const d=require('../src/diagnostics');
test('report hides URL query tokens',()=>{const r=d.report({channel:{name:'Test'},feed:{url:'https://cdn.example/live.m3u8?token=private',sourceName:'Primary'},events:[],attempts:1,status:'Playing'});assert.match(r,/cdn.example\/live.m3u8/);assert.doesNotMatch(r,/private/);assert.equal(d.safeUrl('https://user:pass@example.com/x?secret=1'),'https://example.com/x');});
test('event log retains last 90 events',()=>{const log=d.createLog(()=>0);for(let i=0;i<110;i++)log.push('event',String(i));assert.equal(log.all().length,90);assert.equal(log.all()[0].message,'20');log.clear();assert.equal(log.all().length,0);});
test('HLS errors have readable explanations',()=>{assert.match(d.explain('hls','manifestLoadError'),/request failed/);assert.match(d.explain('hls','fragLoadTimeOut'),/too long/);assert.match(d.explain('media',''),/decoder/);});
