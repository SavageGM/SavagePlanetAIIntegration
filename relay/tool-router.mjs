import {SCABARD_NAMES} from './operations.mjs';
import {loadCanonRegistry} from './canon-registry.mjs';

export class ToolRouter{
 constructor({foundryBroker,scabardClient,registryLoader=loadCanonRegistry}){this.foundryBroker=foundryBroker;this.scabardClient=scabardClient;this.registryLoader=registryLoader;}
 async request(name,args){
  if(name==='canonListMappings'){
   const registry=this.registryLoader();
   const query=args.query?.toLocaleLowerCase('en-US');
   const filtered=registry.mappings.filter(x=>x.status==='confirmed'&&(!query||x.name.toLocaleLowerCase('en-US').includes(query)));
   const mappings=filtered.slice(args.offset,args.offset+args.limit);
   return {sources:registry.sources,total:filtered.length,offset:args.offset,limit:args.limit,hasMore:args.offset+mappings.length<filtered.length,nextOffset:args.offset+mappings.length<filtered.length?args.offset+mappings.length:null,mappings};
  }
  if(name==='canonGetCharacter'||name==='canonCompareCharacter'){
   const registry=this.registryLoader();
   const mapping=registry.mappings.find(x=>x.canonicalId===args.canonicalId&&x.status==='confirmed');
   if(!mapping)throw new Error('Confirmed canonical character mapping not found.');
   const [scabard,foundry]=await Promise.all([
    this.scabardClient.getPage(mapping.scabard.campaignId,mapping.scabard.concept,mapping.scabard.thingId),
    this.foundryBroker.request('getActor',{actorId:mapping.foundry.documentId})
   ]);
   if(name==='canonGetCharacter')return {mapping,scabard,foundry};
   return compareCharacter(mapping,scabard,foundry);
  }
  if(name==='canonPlanCharacterJournal'||name==='canonCreateCharacterJournal'){
   const registry=this.registryLoader();
   const mapping=registry.mappings.find(x=>x.canonicalId===args.canonicalId&&x.status==='confirmed');
   if(!mapping)throw new Error('Confirmed canonical character mapping not found.');
   if(mapping.foundry.documentType!=='Actor'||mapping.foundry.worldId!==registry.sources?.foundryWorld?.id)throw new Error('Confirmed mapping does not target the connected Foundry world.');
   const status=await this.foundryBroker.request('getCanonJournalStatus',{canonicalId:mapping.canonicalId,actorId:mapping.foundry.documentId});
   if(name==='canonPlanCharacterJournal'){
    if(status.status!=='missing')return {mapping,status,wouldCreate:false,pages:[]};
    const scabard=await this.scabardClient.getPage(mapping.scabard.campaignId,mapping.scabard.concept,mapping.scabard.thingId);
    return {mapping,status,wouldCreate:true,folder:'Scabard Characters',ownership:'GM only',pages:plannedPages(scabard?.main??{}),overwritesExisting:false};
   }
   if(status.status!=='missing')return {created:false,reason:status.status,status};
   const scabard=await this.scabardClient.getPage(mapping.scabard.campaignId,mapping.scabard.concept,mapping.scabard.thingId);
   return this.foundryBroker.request('createCanonCharacterJournal',journalPayload(mapping,scabard?.main??{},args.confirmation));
  }
  if(name==='canonAdoptCharacterJournal'){
   const registry=this.registryLoader();
   const mapping=registry.mappings.find(x=>x.canonicalId===args.canonicalId&&x.status==='confirmed');
   if(!mapping)throw new Error('Confirmed canonical character mapping not found.');
   if(mapping.foundry.documentType!=='Actor'||mapping.foundry.worldId!==registry.sources?.foundryWorld?.id)throw new Error('Confirmed mapping does not target the connected Foundry world.');
   const status=await this.foundryBroker.request('getCanonJournalStatus',{canonicalId:mapping.canonicalId,actorId:mapping.foundry.documentId});
   if(status.status!=='conflict'||status.reason!=='unmanaged-name-match'||!status.matches?.some(match=>match.id===args.journalId))return {adopted:false,reason:'journal-is-not-an-exact-unmanaged-match',status};
   const scabard=await this.scabardClient.getPage(mapping.scabard.campaignId,mapping.scabard.concept,mapping.scabard.thingId);
   return this.foundryBroker.request('adoptCanonCharacterJournal',adoptionPayload(mapping,scabard?.main??{},args.journalId,args.confirmation));
  }
  if(!SCABARD_NAMES.includes(name))return this.foundryBroker.request(name,args);
  if(name==='scabardListCampaigns')return this.scabardClient.listCampaigns();
  if(name==='scabardGetCampaign')return this.scabardClient.getCampaign(args.campaignId);
  if(name==='scabardListPages')return this.scabardClient.listPages(args.campaignId,args.concept);
  return this.scabardClient.getPage(args.campaignId,args.concept,args.thingId);
 }
}

const aliasesOf=value=>typeof value==='string'?value.split(',').map(item=>item.trim()).filter(Boolean):Array.isArray(value)?value.map(item=>String(item).trim()).filter(Boolean):[];
const hasText=value=>typeof value==='string'&&value.trim().length>0;
function plannedPages(page){return ['Overview',...(hasText(page.rawDescription)||hasText(page.description)?['Description']:[]),...(hasText(page.secrets)?['Secrets']:[]),...(hasText(page.gmSecrets)?['GM Secrets']:[]),...(hasText(page.imageURL)?['Image']:[])];}
function journalPayload(mapping,page,confirmation){
 const sourceURI=typeof page.uri==='string'&&/^https?:\/\//i.test(page.uri)?page.uri:null;
 return {confirmation,canonicalId:mapping.canonicalId,actorId:mapping.foundry.documentId,name:mapping.name,aliases:aliasesOf(page.aliases),briefSummary:page.briefSummary??'',description:page.rawDescription||page.description||'',secrets:page.secrets??'',gmSecrets:page.gmSecrets??'',imageURL:page.imageURL??null,scabard:{campaignId:mapping.scabard.campaignId,concept:'character',thingId:mapping.scabard.thingId,uri:sourceURI,lastEditedUnix:Number.isSafeInteger(page.dateLastEditedUnix)?page.dateLastEditedUnix:null}};
}
function adoptionPayload(mapping,page,journalId,confirmation){
 const sourceURI=typeof page.uri==='string'&&/^https?:\/\//i.test(page.uri)?page.uri:null;
 return {confirmation,canonicalId:mapping.canonicalId,actorId:mapping.foundry.documentId,journalId,name:mapping.name,scabard:{campaignId:mapping.scabard.campaignId,concept:'character',thingId:mapping.scabard.thingId,uri:sourceURI,lastEditedUnix:Number.isSafeInteger(page.dateLastEditedUnix)?page.dateLastEditedUnix:null}};
}

const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const textCoverage=value=>({present:typeof value==='string'&&value.trim().length>0,length:typeof value==='string'?value.length:0});
function compareCharacter(mapping,scabard,foundry){
 const page=scabard?.main??{};
 const identity=foundry?.identity??{};
 const namesMatch=normalize(page.name)===normalize(identity.name);
 const attributes=Object.fromEntries(Object.entries(foundry?.attributes??{}).map(([key,value])=>[key,value?.display??value?.effective??value?.stored??null]));
 const issues=[];
 if(!namesMatch)issues.push('Scabard and Foundry names differ.');
 if(!textCoverage(page.description).present&&!textCoverage(page.rawDescription).present)issues.push('Scabard has no character description.');
 if(!identity.id)issues.push('Foundry actor identity is unavailable.');
 return {
  mapping,
  identity:{status:namesMatch?'aligned':'review',canonicalName:mapping.name,scabardName:page.name??null,foundryName:identity.name??null},
  scabard:{concept:page.concept??null,aliases:typeof page.aliases==='string'?page.aliases.split(',').map(x=>x.trim()).filter(Boolean):[],isSecret:page.isSecret===true,lastEditedUnix:page.dateLastEditedUnix??null,briefSummary:textCoverage(page.briefSummary),description:textCoverage(page.description),rawDescription:textCoverage(page.rawDescription),secrets:textCoverage(page.secrets),gmSecrets:textCoverage(page.gmSecrets),imagePresent:typeof page.imageURL==='string'&&page.imageURL.length>0,connectionCount:Array.isArray(scabard?.conns)?scabard.conns.length:0},
  foundry:{actorId:identity.id??null,type:identity.type??null,pointTotal:foundry?.pointTotal??null,attributes,validationCount:Array.isArray(foundry?.validation)?foundry.validation.length:0,warningCount:Array.isArray(foundry?.warnings)?foundry.warnings.length:0},
  reconciliation:{status:issues.length?'review':'aligned',issues,writesPlanned:false,secretTextReturned:false}
 };
}
