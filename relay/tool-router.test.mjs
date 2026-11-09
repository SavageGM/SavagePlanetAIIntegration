import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ToolRouter} from './tool-router.mjs';

const mapping={
 canonicalId:'character:4499025',name:'Belladonna Marshall',status:'confirmed',
 scabard:{campaignId:2543388,concept:'character',thingId:4499025},
 foundry:{worldId:'tpm',documentType:'Actor',documentId:'Ow9mrwRNhmKZuXbc'}
};
const registry={version:1,sources:{scabardCampaign:{id:2543388,name:'Savage Planet'},foundryWorld:{id:'tpm',title:'Savage Planet'}},mappings:[mapping]};

test('canon mapping list is paginated and filtered',async()=>{
 const router=new ToolRouter({foundryBroker:{},scabardClient:{},registryLoader:()=>registry});
 const result=await router.request('canonListMappings',{offset:0,limit:10,query:'bella'});
 assert.equal(result.total,1);
 assert.equal(result.mappings[0].canonicalId,'character:4499025');
 assert.equal(result.hasMore,false);
});

test('canon character joins Scabard and Foundry reads',async()=>{
 const calls=[];
 const router=new ToolRouter({
  foundryBroker:{request:async(name,args)=>{calls.push({source:'foundry',name,args});return {identity:{name:'Belladonna Marshall'}};}},
  scabardClient:{getPage:async(campaignId,concept,thingId)=>{calls.push({source:'scabard',campaignId,concept,thingId});return {main:{name:'Belladonna Marshall'}};}},
  registryLoader:()=>registry
 });
 const result=await router.request('canonGetCharacter',{canonicalId:'character:4499025'});
 assert.equal(result.mapping.name,'Belladonna Marshall');
 assert.equal(result.scabard.main.name,'Belladonna Marshall');
 assert.equal(result.foundry.identity.name,'Belladonna Marshall');
 assert.deepEqual(calls,[
  {source:'scabard',campaignId:2543388,concept:'character',thingId:4499025},
  {source:'foundry',name:'getActor',args:{actorId:'Ow9mrwRNhmKZuXbc'}}
 ]);
});

test('canon comparison summarizes coverage without returning secret text',async()=>{
 const router=new ToolRouter({
  foundryBroker:{request:async()=>({identity:{id:'Ow9mrwRNhmKZuXbc',name:'Belladonna Marshall',type:'character'},attributes:{ST:{display:9},IQ:{display:14}},pointTotal:250,validation:[{}],warnings:[]})},
  scabardClient:{getPage:async()=>({main:{name:'Belladonna Marshall',concept:'Character',aliases:'Bella, Marshall',briefSummary:'A survivor',description:'Public lore',rawDescription:'Public lore',secrets:'hidden text',gmSecrets:'deeper hidden text',isSecret:false,dateLastEditedUnix:123,imageURL:'https://example.test/image'},conns:[{},{}]})},
  registryLoader:()=>registry
 });
 const result=await router.request('canonCompareCharacter',{canonicalId:'character:4499025'});
 assert.equal(result.identity.status,'aligned');
 assert.deepEqual(result.scabard.aliases,['Bella','Marshall']);
 assert.equal(result.scabard.secrets.present,true);
 assert.equal(result.scabard.secrets.length,11);
 assert.equal(result.foundry.attributes.ST,9);
 assert.equal(result.reconciliation.secretTextReturned,false);
 assert.ok(!JSON.stringify(result).includes('hidden text'));
 assert.equal(result.reconciliation.status,'aligned');
});

test('canon character rejects missing confirmed mapping',async()=>{
 const router=new ToolRouter({foundryBroker:{},scabardClient:{},registryLoader:()=>registry});
 await assert.rejects(router.request('canonGetCharacter',{canonicalId:'character:1'}),/not found/i);
});

test('canon journal plan is read-only and does not return secret text',async()=>{
 const calls=[];
 const router=new ToolRouter({
  foundryBroker:{request:async(name,args)=>{calls.push({name,args});return {status:'missing',actor:{id:'Ow9mrwRNhmKZuXbc',name:'Belladonna Marshall'}};}},
  scabardClient:{getPage:async()=>({main:{briefSummary:'Summary',rawDescription:'Description',secrets:'hidden text',gmSecrets:'deeper hidden text',imageURL:'https://example.test/bella.jpg'}})},
  registryLoader:()=>registry
 });
 const result=await router.request('canonPlanCharacterJournal',{canonicalId:'character:4499025'});
 assert.equal(result.wouldCreate,true);
 assert.deepEqual(result.pages,['Overview','Description','Secrets','GM Secrets','Image']);
 assert.equal(result.overwritesExisting,false);
 assert.ok(!JSON.stringify(result).includes('hidden text'));
 assert.deepEqual(calls,[{name:'getCanonJournalStatus',args:{canonicalId:'character:4499025',actorId:'Ow9mrwRNhmKZuXbc'}}]);
});

test('canon journal create sends confirmed mapped content and skips existing journals',async()=>{
 const calls=[];
 const foundryBroker={request:async(name,args)=>{
  calls.push({name,args});
  if(name==='getCanonJournalStatus')return {status:'missing'};
  return {created:true,journal:{id:'JOURNAL000000001',name:'Belladonna Marshall'}};
 }};
 const router=new ToolRouter({foundryBroker,scabardClient:{getPage:async()=>({main:{aliases:'Bella',rawDescription:'Public',secrets:'Secret',dateLastEditedUnix:123}})},registryLoader:()=>registry});
 const result=await router.request('canonCreateCharacterJournal',{canonicalId:'character:4499025',confirmation:'CREATE_MISSING_SCABARD_CHARACTER_JOURNAL'});
 assert.equal(result.created,true);
 assert.equal(calls[1].name,'createCanonCharacterJournal');
 assert.equal(calls[1].args.actorId,'Ow9mrwRNhmKZuXbc');
 assert.equal(calls[1].args.scabard.thingId,4499025);
 assert.equal(calls[1].args.confirmation,'CREATE_MISSING_SCABARD_CHARACTER_JOURNAL');

 const existingRouter=new ToolRouter({foundryBroker:{request:async()=>({status:'exists',journal:{id:'JOURNAL000000001'}})},scabardClient:{getPage:async()=>{throw new Error('must not fetch');}},registryLoader:()=>registry});
 assert.deepEqual(await existingRouter.request('canonCreateCharacterJournal',{canonicalId:'character:4499025',confirmation:'CREATE_MISSING_SCABARD_CHARACTER_JOURNAL'}),{created:false,reason:'exists',status:{status:'exists',journal:{id:'JOURNAL000000001'}}});
});

test('canon journal adoption requires the selected exact unmanaged match',async()=>{
 const calls=[];const journalId='aEYDnSh7IeSE65Bs';
 const router=new ToolRouter({
  foundryBroker:{request:async(name,args)=>{calls.push({name,args});if(name==='getCanonJournalStatus')return {status:'conflict',reason:'unmanaged-name-match',matches:[{id:journalId,name:'Belladonna Marshall'}]};return {adopted:true,journal:{id:journalId},linkPage:{name:'Canon Sync',created:true}};}},
  scabardClient:{getPage:async()=>({main:{dateLastEditedUnix:123}})},registryLoader:()=>registry
 });
 const result=await router.request('canonAdoptCharacterJournal',{canonicalId:'character:4499025',journalId,confirmation:'ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'});
 assert.equal(result.adopted,true);assert.equal(calls[1].name,'adoptCanonCharacterJournal');assert.equal(calls[1].args.journalId,journalId);assert.equal(calls[1].args.actorId,'Ow9mrwRNhmKZuXbc');
 const rejected=new ToolRouter({foundryBroker:{request:async()=>({status:'missing'})},scabardClient:{getPage:async()=>{throw new Error('must not fetch');}},registryLoader:()=>registry});
 const no=await rejected.request('canonAdoptCharacterJournal',{canonicalId:'character:4499025',journalId,confirmation:'ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'});
 assert.equal(no.adopted,false);assert.equal(no.reason,'journal-is-not-an-exact-unmanaged-match');
});
