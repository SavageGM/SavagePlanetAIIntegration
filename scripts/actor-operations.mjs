import {extractActor,validateActor} from './extract.mjs';
export const OP_NAMES=Object.freeze(['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations']);
function authorize(game){if(!game?.user?.isGM)throw new Error('GM permission required');if(game.system?.id!=='gurps')throw new Error('GURPS Game Aid required');}
function actorById(game,id){if(typeof id!=='string'||!/^[a-zA-Z0-9]{16}$/.test(id))throw new Error('Invalid actor ID');
 const a=game.actors.get(id);if(!a||a.type!=='character')throw new Error('Character actor not found');return a;}
export function executeReadOperation(game,name,args={}){
 authorize(game);if(!OP_NAMES.includes(name))throw new Error('Unknown or forbidden operation');
 if(name==='listActors'){const list=[...game.actors.contents].filter(a=>a.type==='character').sort((a,b)=>a.name.localeCompare(b.name));
 return {actors:list.slice(0,500).map(a=>({id:a.id,name:a.name,type:a.type})),total:list.length,truncated:list.length>500};}
 const actor=actorById(game,args?.actorId);const data=extractActor(actor.toObject(),actor.system,game.system.version);
 if(name==='getActor')return {identity:data.identity,attributes:data.attributes,resources:data.resources,movement:data.movement,defenses:data.defenses,pointTotal:data.pointTotal,provenance:data.provenance,validation:validateActor(data),warnings:data.warnings};
 if(name==='getSkills')return {actor:data.identity,skills:data.skills};
 if(name==='getAttacks')return {actor:data.identity,attacks:data.attacks};
 if(name==='getEquipment')return {actor:data.identity,equipment:data.equipment,itemSummary:data.itemSummary};
 return {actor:data.identity,hitLocations:data.hitLocations};
}
