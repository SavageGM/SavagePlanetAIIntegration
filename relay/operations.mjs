export const NAMES=Object.freeze(['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations']);
const actorSchema={type:'object',properties:{actorId:{type:'string',description:'16-character Foundry character Actor ID'}},required:['actorId'],additionalProperties:false};
const listSchema={type:'object',properties:{},additionalProperties:false};
const descriptions={getActor:'Read a GGA character summary, prepared attributes, defenses and validation (read-only).',listActors:'List character actor IDs and names visible to the GM (read-only).',getSkills:'Read prepared and imported GURPS skills for one actor (read-only).',getAttacks:'Read melee and ranged GURPS attack data for one actor (read-only).',getEquipment:'Read GGA carried and other equipment collections (read-only).',getHitLocations:'Read GURPS hit location DR and targeting modifiers (read-only).'};
export const TOOLS=NAMES.map(name=>({name,description:descriptions[name],inputSchema:name==='listActors'?listSchema:actorSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}));
export function validateTool(name,args){if(!NAMES.includes(name))throw new Error('Unknown tool');if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Tool arguments must be an object');
 if(name==='listActors'){if(Object.keys(args).length)throw new Error('listActors takes no arguments');return {};}
 if(Object.keys(args).length!==1||!Object.hasOwn(args,'actorId')||typeof args.actorId!=='string'||!/^[A-Za-z0-9]{16}$/.test(args.actorId))throw new Error('actorId must be a 16-character Foundry actor ID');
 return {actorId:args.actorId};}
