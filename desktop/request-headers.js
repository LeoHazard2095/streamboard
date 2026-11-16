'use strict';
// Only benign media request headers; never relay authorization/cookies from unknown playlists.
function safeHeaders(input){const out={};if(!input||typeof input!=='object'||Array.isArray(input))return out;
 for(const [name,value] of Object.entries(input)){
  const key=name.toLowerCase();if(!['user-agent','referer'].includes(key)||typeof value!=='string')continue;
  const v=value.trim();if(!v||v.length>512||/[\r\n\0]/.test(v))continue;
  if(key==='referer'){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;}catch{continue;}}
  out[key==='referer'?'Referer':'User-Agent']=v;
 }
 return out;
}
module.exports={safeHeaders};
