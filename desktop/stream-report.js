'use strict';
// Stream check results are HTTP observations, not verified video playback.
const isManifest=r=>r?.status==='manifest'||r?.status==='headers-required'&&['HLS','DASH'].includes(r.format);
function matchesFilter(row,filter='all'){
 if(filter==='all')return true;
 if(filter==='manifest')return isManifest(row?.result);
 if(filter==='protected')return row?.result?.status==='protected';
 if(filter==='issues')return !isManifest(row?.result)&&row?.result?.status!=='protected';
 return true;
}
function summarize(results){const valid=results.filter(Boolean),counts={};for(const row of valid){const status=row.result?.status||'unknown';counts[status]=(counts[status]||0)+1;}return {checked:valid.length,manifests:valid.filter(x=>isManifest(x.result)).length,protected:counts.protected||0,issues:valid.filter(x=>matchesFilter(x,'issues')).length};}
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function toCsv(results,sourceTitle=''){const header=['Playlist','Channel','URL','Format','Status','HTTP status','Details'];return [header,...results.filter(Boolean).map(({entry,result})=>[sourceTitle,entry.name||'',entry.url||'',result.format||'',result.status||'',result.httpStatus??'',result.detail||''])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
if(typeof module!=="undefined"&&module.exports)module.exports={isManifest,matchesFilter,summarize,toCsv};
if(typeof window!=="undefined")window.StreamReport={isManifest,matchesFilter,summarize,toCsv};
