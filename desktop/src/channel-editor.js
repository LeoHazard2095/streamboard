/* Persistent per-channel stream URL overrides. Source playlists remain untouched. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.StreamChannelEditor=value;})(typeof self!=='undefined'?self:this,function(){
'use strict';
function validUrl(value){try{const u=new URL(value);return (u.protocol==='http:'||u.protocol==='https:')&&!!u.hostname&&!u.username&&!u.password&&value.length<=2048;}catch{return false;}}
function cleanLabel(label){return String(label||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,80)||'Custom source';}
function normalize(edit){return {replacements:edit?.replacements&&typeof edit.replacements==='object'&&!Array.isArray(edit.replacements)?edit.replacements:{},removed:Array.isArray(edit?.removed)?edit.removed:[],extras:Array.isArray(edit?.extras)?edit.extras:[]};}
function apply(groups,overrides={}){
 for(const channel of groups){const edit=normalize(overrides[channel.id]);const removed=new Set(edit.removed);const used=new Set();const feeds=[];
  for(const feed of channel.feeds){if(removed.has(feed.url))continue;const patch=edit.replacements[feed.url];const url=patch&&validUrl(patch.url)?patch.url:feed.url;const sourceName=patch?.sourceName?cleanLabel(patch.sourceName):feed.sourceName;
   if(!used.has(url)){used.add(url);feeds.push({...feed,url,sourceName,originalUrl:feed.url,manualEdit:!!patch});}}
  for(const extra of edit.extras){if(!validUrl(extra.url)||used.has(extra.url))continue;used.add(extra.url);feeds.push({...channel.feeds[0],url:extra.url,sourceId:'manual',sourceName:cleanLabel(extra.sourceName),originalUrl:null,manualEdit:true});}
  channel.feeds=feeds;
 }
 return groups;
}
function saveFeed(edit,originalUrl,newUrl,sourceName){if(!validUrl(newUrl))throw Error('Enter a valid HTTP or HTTPS stream URL.');const next=normalize(edit);if(originalUrl){next.replacements[originalUrl]={url:newUrl,sourceName:cleanLabel(sourceName)};next.removed=next.removed.filter(x=>x!==originalUrl);}else if(next.extras.some(x=>x.url===newUrl))throw Error('This URL is already saved as a custom source.');else next.extras.push({url:newUrl,sourceName:cleanLabel(sourceName)});return next;}
function removeFeed(edit,feed){const next=normalize(edit);if(feed.originalUrl){next.removed=[...new Set([...next.removed,feed.originalUrl])];delete next.replacements[feed.originalUrl];}else next.extras=next.extras.filter(x=>x.url!==feed.url);return next;}
function restore(edit,originalUrl){const next=normalize(edit);delete next.replacements[originalUrl];next.removed=next.removed.filter(x=>x!==originalUrl);return next;}
return {validUrl,cleanLabel,normalize,apply,saveFeed,removeFeed,restore};
});
