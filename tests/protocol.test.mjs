import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleMcp} from '../relay/protocol.mjs';
const call=(method,params={})=>({jsonrpc:'2.0',id:1,method,params});
const broker={request:async(name,args)=>({name,args,ST:9})};
test('MCP initialize/list',async()=>{
 const initialized=await handleMcp(call('initialize'),broker);
 assert.equal(initialized.result.protocolVersion,'2025-06-18');
 const tools=(await handleMcp(call('tools/list'),broker)).result.tools;
 assert.deepEqual(tools.map(x=>x.name),['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations']);
 assert.ok(tools.every(x=>x.annotations.readOnlyHint));
});
test('read-only calls and strict arguments',async()=>{
 const good=await handleMcp(call('tools/call',{name:'getActor',arguments:{actorId:'Ow9mrwRNhmKZuXbc'}}),broker);
 assert.equal(good.result.structuredContent.ST,9);
 for(const args of [{name:'updateActor',arguments:{}},{name:'getActor',arguments:{actorId:'bad'}},{name:'getActor',arguments:{actorId:'Ow9mrwRNhmKZuXbc',extra:true}}]){
  const response=await handleMcp(call('tools/call',args),broker);
  assert.equal(response.error.code,-32602);
 }
});
test('notifications and offline responses',async()=>{
 assert.equal(await handleMcp({jsonrpc:'2.0',method:'notifications/initialized'},broker),null);
 const offline={request:async()=>{throw new Error('Foundry disconnected');}};
 const answer=await handleMcp(call('tools/call',{name:'listActors',arguments:{}}),offline);
 assert.equal(answer.result.isError,true);
});
