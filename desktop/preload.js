'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('streamBoard',Object.freeze({
 load:()=>ipcRenderer.invoke('catalog:load'),
 save:state=>ipcRenderer.invoke('catalog:save',state),
 fetchPlaylist:url=>ipcRenderer.invoke('playlist:fetch',url),
 openStream:url=>ipcRenderer.invoke('player:open',url),
 discoverGithub:url=>ipcRenderer.invoke('github:discover',url),
 exportFile:request=>ipcRenderer.invoke('export:write',request)
}));
