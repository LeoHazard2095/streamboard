const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'../node_modules/hls.js/dist/hls.min.js');
const target=path.join(__dirname,'../src/hls.min.js');
fs.copyFileSync(src,target);
console.log('HLS.js bundled for desktop playback');
