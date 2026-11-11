'use strict';
importScripts('logic.js');
self.onmessage=e=>{try{const {type,payload}=e.data||{};
 if(type==='parse'){self.postMessage({result:self.StreamLogic.parse(payload.text,payload.id,payload.title,payload.url)});}else{self.postMessage({error:'Unknown worker action'});}
}catch(err){self.postMessage({error:err.message});}};
