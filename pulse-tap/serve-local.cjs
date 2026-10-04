// Local playtest server; serves the existing MP3 files with seek support.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.cjs':'text/javascript', '.json':'application/json', '.mp3':'audio/mpeg', '.png':'image/png', '.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  let file;
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/pulse-tap/')&&!['/cvb-gemf-sample.mp3','/ALLDAT_ruffmix.mp3'].includes(pathname))throw Error('outside playtest');
    file=path.resolve(root, '.'+pathname);
    if(!file.startsWith(root+path.sep))throw Error('outside root');
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    const size=fs.statSync(file).size;
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Accept-Ranges','bytes');
    const range=req.headers.range;
    let start=0,end=size-1;
    if(range){
      const m=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!m || (!m[1]&&!m[2]))throw Error('range');
      start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
      end=m[1]&&m[2]?Math.min(Number(m[2]),size-1):size-1;
      if(start>end || start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
      res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length',end-start+1);
    if(req.method==='HEAD')return res.end();
    const stream=fs.createReadStream(file,{start,end});
    stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(8765,'127.0.0.1',()=>console.log('Pulse Tap: http://127.0.0.1:8765/pulse-tap/?track=./cvb-analyzer-test.json'));
