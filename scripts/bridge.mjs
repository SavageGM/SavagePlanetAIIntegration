import {executeOperation,OP_NAMES} from './actor-operations.mjs';
const ID='savage-planet-ai-adapter';
let socket=null,state='disabled',retryTimer=null,lastError=null,attempts=0,stopping=false;
const pending=new Map();
const RELAY_OPS=new Set(['canonListMappings','canonPlanCharacterJournal','canonCreateCharacterJournal','canonAdoptCharacterJournal']);
const setting=key=>game.settings.get(ID,key);
const status=()=>({state,connected:state==='connected',lastError});
function clearRetry(){if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;}}
function rejectPending(message){for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error(message));}pending.clear();}
function stop(){stopping=true;clearRetry();attempts=0;
 if(socket){const old=socket;socket=null;old.onclose=null;old.onerror=null;old.onmessage=null;old.close(1000,'Bridge disabled');}
 rejectPending('Bridge disabled');
 state='disabled';lastError=null;
}
function validUrl(raw){const url=new URL(raw);
 if(url.protocol!=='wss:'&&!(url.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use wss:// or ws://localhost for local testing');
 if(url.username||url.password||url.search||url.hash)throw new Error('Do not include credentials in bridge URL');
 if(url.pathname!=='/bridge')throw new Error('Bridge URL must end with /bridge');
 return url.toString();
}
function schedule(){if(stopping||!setting('bridgeEnabled'))return;clearRetry();state='reconnecting';
 const delay=Math.min(30000,1500*2**Math.min(attempts++,4));retryTimer=setTimeout(connect,delay);}
function connect(){
 clearRetry();
 if(!game.user?.isGM||game.system?.id!=='gurps'||!setting('bridgeEnabled')){stop();return;}
 stopping=false;const secret=setting('bridgeToken');
 if(typeof secret!=='string'||secret.length<32){state='not-configured';lastError='Configure bridge token (32+ characters)';return;}
 let url;try{url=validUrl(setting('bridgeUrl'));}catch(e){state='not-configured';lastError=e.message;return;}
 if(socket){const old=socket;socket=null;old.onclose=null;old.close();}
 state='connecting';lastError=null;const ws=new WebSocket(url);socket=ws;
 ws.onopen=()=>{if(socket===ws){state='authenticating';ws.send(JSON.stringify({kind:'hello',token:secret,protocol:1}));}};
 ws.onmessage=async event=>{if(socket!==ws)return;
  let msg;try{msg=JSON.parse(event.data);}catch{ws.close(1003,'Invalid JSON');return;}
  if(msg.kind==='ready'){state='connected';attempts=0;lastError=null;return;}
  if(msg.kind==='error'){lastError=String(msg.message??'Remote error').slice(0,200);return;}
  if(msg.kind==='client-response'&&typeof msg.id==='string'){
   const item=pending.get(msg.id);if(!item)return;pending.delete(msg.id);clearTimeout(item.timer);
   if(msg.ok===true&&msg.result&&typeof msg.result==='object')item.resolve(msg.result);
   else item.reject(new Error(String(msg.error??'Relay request failed').slice(0,250)));
   return;
  }
  if(msg.kind!=='request'||state!=='connected')return;
  if(typeof msg.id!=='string'||msg.id.length>100||!OP_NAMES.includes(msg.operation))return;
  let reply;try{reply={kind:'response',id:msg.id,ok:true,result:await executeOperation(game,msg.operation,msg.args)};}
  catch(err){reply={kind:'response',id:msg.id,ok:false,error:String(err?.message??err).slice(0,200)};}
  if(socket===ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(reply));
 };
 ws.onerror=()=>{if(socket===ws)lastError='WebSocket connection failed';};
 ws.onclose=event=>{if(socket!==ws)return;socket=null;rejectPending('Relay disconnected');if(event.code===4003){state='unauthorized';lastError='Bridge authentication rejected';return;}schedule();};
}
function request(operation,args={}){
 if(!RELAY_OPS.has(operation))return Promise.reject(new Error('Relay operation is not available to the Foundry UI'));
 if(!socket||socket.readyState!==WebSocket.OPEN||state!=='connected')return Promise.reject(new Error('External canon bridge is not connected'));
 if(!args||typeof args!=='object'||Array.isArray(args))return Promise.reject(new Error('Relay arguments must be an object'));
 if(pending.size>=8)return Promise.reject(new Error('Too many pending relay requests'));
 const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Relay request timed out'));},20000);
  pending.set(id,{resolve,reject,timer});
  try{socket.send(JSON.stringify({kind:'client-request',id,operation,args}));}
  catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
 });
}
function register(){
 const settings=[
 ['bridgeEnabled',{name:'Enable external canon bridge',hint:'GM browser only. Reads are allowed; journal creation requires confirmed mappings and explicit authorization. Disabled until the relay is secured.',type:Boolean,default:false}],
 ['bridgeUrl',{name:'Bridge WebSocket URL',hint:'Secure wss:// relay URL ending /bridge. Never include a secret in the URL.',type:String,default:''}],
 ['bridgeToken',{name:'Bridge secret (GM browser only)',hint:'Separate random BRIDGE_TOKEN with 32+ characters. Treat as a password.',type:String,default:''}]
 ];
 for(const [key,data] of settings)game.settings.register(ID,key,{scope:'client',config:true,...data,onChange:()=>{stop();if(game.user?.isGM)connect();}});
}
Hooks.once('init',register);
Hooks.once('ready',()=>{if(game.user?.isGM)connect();});
Hooks.on('shutdown',stop);
export const bridge=Object.freeze({status,connect,stop,request});
