const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('streamBoard',{
  load:()=>ipcRenderer.invoke('catalog:load'),
  save:state=>ipcRenderer.invoke('catalog:save',state),
  fetchPlaylist:url=>ipcRenderer.invoke('playlist:fetch',url)
});
