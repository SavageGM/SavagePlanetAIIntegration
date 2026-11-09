import {TOOLS,validateTool} from './operations.mjs';
export const MCP_PROTOCOL='2025-06-18';
const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const result=(id,value)=>({jsonrpc:'2.0',id,result:value});
export async function handleMcp(message,broker,options={}){
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0')return error(null,-32600,'Invalid Request');
 if(!Object.hasOwn(message,'id'))return null;
 const {id,method,params={}}=message;
 if(typeof method!=='string')return error(id,-32600,'Invalid method');
 if(method==='initialize')return result(id,{protocolVersion:MCP_PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:{name:'savage-planet-canon-sync',version:'0.6.0'},instructions:'Savage Planet campaign access through the connected Foundry GM world and locally configured Scabard account. Reads are non-mutating. Journal creation is limited to confirmed mappings, requires a separate write scope plus exact confirmation, creates missing GM-only entries, and never overwrites existing journals.'});
 if(method==='ping')return result(id,{});
 if(method==='tools/list')return result(id,{tools:options.oauthScope?TOOLS.map(t=>({...t,_meta:{securitySchemes:[{type:'oauth2',scopes:t.name==='canonCreateCharacterJournal'?[options.oauthScope,options.oauthWriteScope??'canon:write']:[options.oauthScope]}]}})):TOOLS});
 if(method==='tools/call'){let name,args;try{name=params?.name;args=validateTool(name,params?.arguments??{});}catch(e){return error(id,-32602,String(e.message));}
 try{const data=await broker.request(name,args);return result(id,{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false});}
 catch(e){return result(id,{content:[{type:'text',text:String(e?.message??e).slice(0,250)}],isError:true});}}
 return error(id,-32601,'Method not found');}
