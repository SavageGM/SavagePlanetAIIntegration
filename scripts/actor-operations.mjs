import {extractActor,validateActor} from './extract.mjs';
import {adoptCanonCharacterJournal,createCanonCharacterJournal,getCanonJournalStatus} from './journal-sync.mjs';
export const READ_OP_NAMES=Object.freeze(['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations','listJournals','getCanonJournalStatus']);
export const WRITE_OP_NAMES=Object.freeze(['createCanonCharacterJournal','adoptCanonCharacterJournal']);
export const OP_NAMES=Object.freeze([...READ_OP_NAMES,...WRITE_OP_NAMES]);
function authorize(game){if(!game?.user?.isGM)throw new Error('GM permission required');if(game.system?.id!=='gurps')throw new Error('GURPS Game Aid required');}
function actorById(game,id){if(typeof id!=='string'||!/^[a-zA-Z0-9]{16}$/.test(id))throw new Error('Invalid actor ID');
 const a=game.actors.get(id);if(!a||a.type!=='character')throw new Error('Character actor not found');return a;}
export function executeReadOperation(game,name,args={}){
 authorize(game);if(!READ_OP_NAMES.includes(name))throw new Error('Unknown or forbidden read operation');
 if(name==='getCanonJournalStatus')return getCanonJournalStatus(game,args);
 if(name==='listJournals'){
  const {offset=0,limit=100,query,folderId}=args;
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('Invalid journal pagination');
  if(query!==undefined&&(typeof query!=='string'||query.trim().length<1||query.length>100))throw new Error('Invalid journal query');
  if(folderId!==undefined&&(typeof folderId!=='string'||!/^[A-Za-z0-9]{16}$/.test(folderId)))throw new Error('Invalid journal folder ID');
  if(Object.keys(args).some(k=>!['offset','limit','query','folderId'].includes(k)))throw new Error('Unsupported journal argument');
  const needle=query?.trim().toLocaleLowerCase();
  const journals=[...game.journal.contents]
   .filter(j=>(!needle||j.name.toLocaleLowerCase().includes(needle))&&(!folderId||j.folder?.id===folderId))
   .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const total=journals.length,hasMore=offset+limit<total;
  return {world:{id:game.world?.id??null,title:game.world?.title??null},
   journals:journals.slice(offset,offset+limit).map(j=>({id:j.id,name:j.name,folderId:j.folder?.id??null})),
   total,offset,limit,hasMore,nextOffset:hasMore?offset+limit:null,truncated:hasMore};
 }
 if(name==='listActors'){const list=[...game.actors.contents].filter(a=>a.type==='character').sort((a,b)=>a.name.localeCompare(b.name));
 return {actors:list.slice(0,500).map(a=>({id:a.id,name:a.name,type:a.type})),total:list.length,truncated:list.length>500};}
 const actor=actorById(game,args?.actorId);const data=extractActor(actor.toObject(),actor.system,game.system.version);
 if(name==='getActor')return {identity:data.identity,attributes:data.attributes,resources:data.resources,movement:data.movement,defenses:data.defenses,pointTotal:data.pointTotal,provenance:data.provenance,validation:validateActor(data),warnings:data.warnings};
 if(name==='getSkills')return {actor:data.identity,skills:data.skills};
 if(name==='getAttacks')return {actor:data.identity,attacks:data.attacks};
 if(name==='getEquipment')return {actor:data.identity,equipment:data.equipment,itemSummary:data.itemSummary};
 return {actor:data.identity,hitLocations:data.hitLocations};
}
export async function executeOperation(game,name,args={}){
 authorize(game);
 if(READ_OP_NAMES.includes(name))return executeReadOperation(game,name,args);
 if(name==='createCanonCharacterJournal')return createCanonCharacterJournal(game,args);
 if(name==='adoptCanonCharacterJournal')return adoptCanonCharacterJournal(game,args);
 throw new Error('Unknown or forbidden operation');
}
