import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleMcp} from '../relay/protocol.mjs';
const call=(method,params={})=>({jsonrpc:'2.0',id:1,method,params});
const broker={request:async(name,args)=>({name,args,ST:9})};
test('MCP initialize/list',async()=>{
 const initialized=await handleMcp(call('initialize'),broker);
 assert.equal(initialized.result.protocolVersion,'2025-06-18');
 const tools=(await handleMcp(call('tools/list'),broker)).result.tools;
 assert.deepEqual(tools.map(x=>x.name),['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations','listJournals','scabardListCampaigns','scabardGetCampaign','scabardListPages','scabardGetPage','canonListMappings','canonGetCharacter','canonCompareCharacter','canonPlanCharacterJournal','canonCreateCharacterJournal','canonAdoptCharacterJournal']);
 assert.ok(tools.filter(x=>!['canonCreateCharacterJournal','canonAdoptCharacterJournal'].includes(x.name)).every(x=>x.annotations.readOnlyHint));
 assert.equal(tools.find(x=>x.name==='canonCreateCharacterJournal').annotations.readOnlyHint,false);
 assert.equal(tools.find(x=>x.name==='canonAdoptCharacterJournal').annotations.readOnlyHint,false);
});
test('read-only calls and strict arguments',async()=>{
 const good=await handleMcp(call('tools/call',{name:'getActor',arguments:{actorId:'Ow9mrwRNhmKZuXbc'}}),broker);
 assert.equal(good.result.structuredContent.ST,9);
 for(const args of [{name:'updateActor',arguments:{}},{name:'getActor',arguments:{actorId:'bad'}},{name:'getActor',arguments:{actorId:'Ow9mrwRNhmKZuXbc',extra:true}},{name:'listJournals',arguments:{extra:true}},{name:'listJournals',arguments:{limit:201}},{name:'listJournals',arguments:{offset:-1}},{name:'listJournals',arguments:{query:''}},{name:'listJournals',arguments:{folderId:'bad'}}]){
  const response=await handleMcp(call('tools/call',args),broker);
  assert.equal(response.error.code,-32602);
 }
 for(const args of [{name:'scabardListCampaigns',arguments:{extra:true}},{name:'scabardGetCampaign',arguments:{campaignId:0}},{name:'scabardListPages',arguments:{campaignId:121,concept:'unknown'}},{name:'scabardGetPage',arguments:{campaignId:121,concept:'character',thingId:'162'}}]){
  const response=await handleMcp(call('tools/call',args),broker);
  assert.equal(response.error.code,-32602);
 }
 for(const args of [{name:'canonListMappings',arguments:{limit:0}},{name:'canonListMappings',arguments:{query:''}},{name:'canonGetCharacter',arguments:{canonicalId:'bad'}},{name:'canonGetCharacter',arguments:{canonicalId:'character:1',extra:true}},{name:'canonCompareCharacter',arguments:{canonicalId:'bad'}},{name:'canonPlanCharacterJournal',arguments:{canonicalId:'bad'}},{name:'canonCreateCharacterJournal',arguments:{canonicalId:'character:1',confirmation:'yes'}},{name:'canonAdoptCharacterJournal',arguments:{canonicalId:'character:1',journalId:'bad',confirmation:'ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'}}]){
  const response=await handleMcp(call('tools/call',args),broker);
  assert.equal(response.error.code,-32602);
 }
});
test('Scabard arguments are normalized and routed read-only',async()=>{
 const page=await handleMcp(call('tools/call',{name:'scabardGetPage',arguments:{campaignId:121,concept:'Character',thingId:162}}),broker);
 assert.deepEqual(page.result.structuredContent.args,{campaignId:121,concept:'character',thingId:162});
 const campaigns=await handleMcp(call('tools/call',{name:'scabardListCampaigns',arguments:{}}),broker);
 assert.deepEqual(campaigns.result.structuredContent.args,{});
});
test('Canon arguments are normalized and routed read-only',async()=>{
 const list=await handleMcp(call('tools/call',{name:'canonListMappings',arguments:{query:'  Bella  '}}),broker);
 assert.deepEqual(list.result.structuredContent.args,{offset:0,limit:100,query:'Bella'});
 const character=await handleMcp(call('tools/call',{name:'canonGetCharacter',arguments:{canonicalId:'character:4499025'}}),broker);
 assert.deepEqual(character.result.structuredContent.args,{canonicalId:'character:4499025'});
 const comparison=await handleMcp(call('tools/call',{name:'canonCompareCharacter',arguments:{canonicalId:'character:4499025'}}),broker);
 assert.deepEqual(comparison.result.structuredContent.args,{canonicalId:'character:4499025'});
 const plan=await handleMcp(call('tools/call',{name:'canonPlanCharacterJournal',arguments:{canonicalId:'character:4499025'}}),broker);
 assert.deepEqual(plan.result.structuredContent.args,{canonicalId:'character:4499025'});
 const create=await handleMcp(call('tools/call',{name:'canonCreateCharacterJournal',arguments:{canonicalId:'character:4499025',confirmation:'CREATE_MISSING_SCABARD_CHARACTER_JOURNAL'}}),broker);
 assert.deepEqual(create.result.structuredContent.args,{canonicalId:'character:4499025',confirmation:'CREATE_MISSING_SCABARD_CHARACTER_JOURNAL'});
 const adopt=await handleMcp(call('tools/call',{name:'canonAdoptCharacterJournal',arguments:{canonicalId:'character:4499025',journalId:'aEYDnSh7IeSE65Bs',confirmation:'ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'}}),broker);
 assert.deepEqual(adopt.result.structuredContent.args,{canonicalId:'character:4499025',journalId:'aEYDnSh7IeSE65Bs',confirmation:'ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'});
});
test('journal pagination and filter arguments',async()=>{
 const response=await handleMcp(call('tools/call',{name:'listJournals',arguments:{offset:200,limit:75,query:'  Cheyenne  ',folderId:'RyqHyckQHV6Hy9fa'}}),broker);
 assert.deepEqual(response.result.structuredContent.args,{offset:200,limit:75,query:'Cheyenne',folderId:'RyqHyckQHV6Hy9fa'});
 const defaults=await handleMcp(call('tools/call',{name:'listJournals',arguments:{}}),broker);
 assert.deepEqual(defaults.result.structuredContent.args,{offset:0,limit:100});
});
test('notifications and offline responses',async()=>{
 assert.equal(await handleMcp({jsonrpc:'2.0',method:'notifications/initialized'},broker),null);
 const offline={request:async()=>{throw new Error('Foundry disconnected');}};
 const answer=await handleMcp(call('tools/call',{name:'listActors',arguments:{}}),offline);
 assert.equal(answer.result.isError,true);
});

test('OAuth mode advertises read and separate write security requirements',async()=>{
 const response=await handleMcp(call('tools/list'),broker,{oauthScope:'gurps:read',oauthWriteScope:'canon:write'});
 assert.equal(response.result.tools.length,17);
 for(const tool of response.result.tools){
  assert.deepEqual(tool._meta.securitySchemes,[{type:'oauth2',scopes:['canonCreateCharacterJournal','canonAdoptCharacterJournal'].includes(tool.name)?['gurps:read','canon:write']:['gurps:read']}]);
 }
 assert.equal(response.result.tools.find(x=>x.name==='canonCreateCharacterJournal').annotations.readOnlyHint,false);
 assert.equal(response.result.tools.find(x=>x.name==='canonAdoptCharacterJournal').annotations.readOnlyHint,false);
});
