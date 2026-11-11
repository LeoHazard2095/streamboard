'use strict';
const {URL}=require('node:url');
function parseRepo(input){
 const url=new URL(input);if(url.protocol!=='https:'||url.hostname!=='github.com')throw Error('Paste a GitHub repository link (https://github.com/owner/repo)');
 const parts=url.pathname.split('/').filter(Boolean);if(parts.length!==2||!parts.every(x=>/^[a-z0-9_.-]+$/i.test(x)))throw Error('Use a repository root URL, not a subfolder or file');
 return {owner:parts[0],name:parts[1].replace(/\.git$/,'')};
}
function candidates(tree,owner,name,branch){
 if(!Array.isArray(tree))return [];
 return tree.filter(item=>item.type==='blob'&&/\.(m3u|m3u8)$/i.test(item.path||''))
  .slice(0,250).map(item=>({path:item.path,url:`https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodeURIComponent(branch)}/${item.path.split('/').map(encodeURIComponent).join('/')}`,size:item.size||0}));
}
async function discover(input,fetchImpl){
 const {owner,name}=parseRepo(input);const common={headers:{'Accept':'application/vnd.github+json','User-Agent':'StreamBoard-IPTV'}};
 const repoRes=await fetchImpl(`https://api.github.com/repos/${owner}/${name}`,common);
 if(!repoRes.ok)throw Error(`GitHub repository request failed: ${repoRes.status}`);
 const repo=await repoRes.json();const branch=repo.default_branch;if(!branch)throw Error('Could not identify the default branch');
 const treeRes=await fetchImpl(`https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,common);
 if(!treeRes.ok)throw Error(`GitHub file listing failed: ${treeRes.status}`);
 const result=await treeRes.json();if(result.truncated)throw Error('Repository tree too large; please use a direct Raw playlist URL');
 return candidates(result.tree,owner,name,branch);
}
module.exports={parseRepo,candidates,discover};
