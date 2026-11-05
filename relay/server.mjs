import http from 'node:http';
import crypto from 'node:crypto';
import {WebSocketServer} from 'ws';
import {handleMcp} from './protocol.mjs';
import {validateTool} from './operations.mjs';
const {BRIDGE_TOKEN,MCP_TOKEN}=process.env;
if(!BRIDGE_TOKEN||!MCP_TOKEN||BRIDGE_TOKEN.length<32||MCP_TOKEN.length<32||BRIDGE_TOKEN===MCP_TOKEN)
 throw new Error('Set different BRIDGE_TOKEN and MCP_TOKEN secrets, 32+ characters each');
const HOST=process.env.HOST??'127.0.0.1',PORT=Number(process.env.PORT??8787);
const allowedOrigins=(process.env.BRIDGE_ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean);
const equals=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=crypto.createHash('sha256').update(a).digest(),y=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(x,y);};
const readBody=req=>new Promise((resolve,reject)=>{let data='',total=0;req.on('data',chunk=>{total+=chunk.length;if(total>100000){reject(new Error('Request too large'));req.destroy();return;}data+=chunk;});req.on('end',()=>resolve(data));req.on('error',reject);});
export class BridgeBroker{
 constructor(){this.client=null;this.pending=new Map();}
 attach(ws){
  if(this.client){ws.close(1013,'Another GM is connected');return false;}
  this.client=ws;
  ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw.toString());}catch{return;}
   if(msg.kind!=='response'||typeof msg.id!=='string')return;const p=this.pending.get(msg.id);if(!p)return;
   this.pending.delete(msg.id);clearTimeout(p.timer);
   if(msg.ok===true&&msg.result&&typeof msg.result==='object')p.resolve(msg.result);
   else p.reject(new Error(String(msg.error??'Foundry request failed').slice(0,250)));
  });
  ws.on('close',()=>{if(this.client!==ws)return;this.client=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Foundry disconnected'));}this.pending.clear();});
  return true;
 }
 request(name,args){validateTool(name,args);if(!this.client||this.client.readyState!==1)return Promise.reject(new Error('Foundry GM is not connected'));
  if(this.pending.size>=16)return Promise.reject(new Error('Too many pending requests'));
  const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Foundry request timed out'));},12000);
   this.pending.set(id,{resolve,reject,timer});
   try{this.client.send(JSON.stringify({kind:'request',id,operation:name,args}));}
   catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
  });
 }
}
export function startServer({port=PORT,host=HOST,broker=new BridgeBroker()}={}){
 const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.url!=='/mcp'){res.writeHead(404);res.end();return;}
  if(req.method!=='POST'){res.setHeader('Allow','POST');res.writeHead(405);res.end();return;}
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!equals(token,MCP_TOKEN)){res.writeHead(401,{'WWW-Authenticate':'Bearer'});res.end();return;}
  if(!String(req.headers['content-type']??'').startsWith('application/json')){res.writeHead(415);res.end();return;}
  try{const msg=JSON.parse(await readBody(req));const response=await handleMcp(msg,broker);
   res.setHeader('MCP-Protocol-Version','2025-06-18');
   if(response===null){res.writeHead(202);res.end();return;}
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(response));
  }catch{if(!res.writableEnded){res.writeHead(400);res.end(JSON.stringify({error:'Invalid JSON or request'}));}}
 });
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/bridge'||(allowedOrigins.length>0&&!allowedOrigins.includes(req.headers.origin??''))){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   ws.on('error',()=>{});
   const timer=setTimeout(()=>ws.close(4003,'Handshake timed out'),8000);
   ws.once('message',raw=>{clearTimeout(timer);let hello;try{hello=JSON.parse(raw.toString());}catch{ws.close(4003,'Invalid handshake');return;}
    if(hello.kind!=='hello'||hello.protocol!==1||!equals(hello.token,BRIDGE_TOKEN)){ws.close(4003,'Unauthorized');return;}
    if(broker.attach(ws))ws.send(JSON.stringify({kind:'ready',protocol:1}));
   });
  });
 });
 server.listen(port,host,()=>console.log('Savage Planet MCP relay listening '+host+':'+server.address().port+'; configure TLS reverse proxy for external use'));
 return {server,broker,close:()=>new Promise(resolve=>{broker.client?.close();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)startServer();
