import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./dist/',import.meta.url)),port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname)==='/'?'index.html':decodeURIComponent(u.pathname).slice(1),target=path.resolve(root,name);
  if(!target.startsWith(path.resolve(root)+path.sep)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
  const content=await readFile(target),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
