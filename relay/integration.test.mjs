import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {WebSocket} from 'ws';
process.env.BRIDGE_TOKEN=randomBytes(32).toString('hex');
process.env.MCP_TOKEN=randomBytes(32).toString('hex');
process.env.HOST='127.0.0.1';
process.env.PORT='0';
process.env.BRIDGE_ALLOWED_ORIGINS='http://localhost:3000';
// Never let an integration-test server overwrite the live Windows control
// panel's bridge-status.json when tests run on the relay host.
process.env.BRIDGE_STATUS_FILE='disabled';
const {startServer}=await import('./server.mjs');
test('MCP and authenticated bridge roundtrip',async()=>{
 const app=startServer({port:0,host:'127.0.0.1'});
 await new Promise(resolve=>app.server.listening?resolve():app.server.once('listening',resolve));
 const port=app.server.address().port;
 const base='http://127.0.0.1:'+port;
 const headers={'Authorization':'Bearer '+process.env.MCP_TOKEN,'Content-Type':'application/json'};
 const call=async(method,params={})=>{
  const res=await fetch(base+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  assert.equal(res.status,200);return res.json();};
 let socket;
 try{
  const denied=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,401);
  assert.equal((await call('tools/list')).result.tools.length,16);
  const unconfigured=await call('tools/call',{name:'scabardListCampaigns',arguments:{}});
  assert.equal(unconfigured.result.isError,true);
  assert.match(unconfigured.result.content[0].text,/not configured/i);
  assert.equal((await call('tools/call',{name:'getActor',arguments:{actorId:'bad'}})).error.code,-32602);
  socket=new WebSocket('ws://127.0.0.1:'+port+'/bridge',{headers:{Origin:'http://localhost:3000'}});
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const next=()=>new Promise((resolve,reject)=>{socket.once('message',m=>{try{resolve(JSON.parse(m.toString()));}catch(e){reject(e);}});});
  const ready=next();socket.send(JSON.stringify({kind:'hello',protocol:1,token:process.env.BRIDGE_TOKEN}));
  assert.equal((await ready).kind,'ready');
  const inbound=next(),outbound=call('tools/call',{name:'getActor',arguments:{actorId:'Ow9mrwRNhmKZuXbc'}});
  const req=await inbound;assert.equal(req.operation,'getActor');
  socket.send(JSON.stringify({kind:'response',id:req.id,ok:true,result:{identity:{name:'Belladonna Marshall'},attributes:{ST:{display:9}}}}));
  const response=await outbound;
  assert.equal(response.result.structuredContent.identity.name,'Belladonna Marshall');
 }finally{socket?.terminate();await app.close();}
});
