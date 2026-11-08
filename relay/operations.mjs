export const NAMES=Object.freeze(['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations','listJournals']);
const actorSchema={type:'object',properties:{actorId:{type:'string',description:'16-character Foundry character Actor ID'}},required:['actorId'],additionalProperties:false};
const listSchema={type:'object',properties:{},additionalProperties:false};
const journalListSchema={type:'object',properties:{
 offset:{type:'integer',minimum:0,description:'Zero-based offset (default 0)'},
 limit:{type:'integer',minimum:1,maximum:200,description:'Entries per page (default 100, maximum 200)'},
 query:{type:'string',minLength:1,maxLength:100,description:'Case-insensitive journal title substring filter'},
 folderId:{type:'string',pattern:'^[A-Za-z0-9]{16}$',description:'Filter by 16-character journal folder ID'}
},additionalProperties:false};
const descriptions={getActor:'Read a GGA character summary, prepared attributes, defenses and validation (read-only).',listActors:'List character actor IDs and names visible to the GM (read-only).',getSkills:'Read prepared and imported GURPS skills for one actor (read-only).',getAttacks:'Read melee and ranged GURPS attack data for one actor (read-only).',getEquipment:'Read GGA carried and other equipment collections (read-only).',getHitLocations:'Read GURPS hit location DR and targeting modifiers (read-only).',listJournals:'Paginate and filter journal entry IDs, titles, and folder IDs in the connected GM world (read-only; no page content).'};
export const TOOLS=NAMES.map(name=>({name,description:descriptions[name],inputSchema:name==='listJournals'?journalListSchema:name==='listActors'?listSchema:actorSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}));
export function validateTool(name,args){
 if(!NAMES.includes(name))throw new Error('Unknown tool');
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Tool arguments must be an object');
 if(name==='listActors'){if(Object.keys(args).length)throw new Error('listActors takes no arguments');return {};}
 if(name==='listJournals'){
  if(Object.keys(args).some(k=>!['offset','limit','query','folderId'].includes(k)))throw new Error('Unsupported listJournals argument');
  const {offset=0,limit=100,query,folderId}=args;
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('offset must be a nonnegative integer');
  if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('limit must be an integer between 1 and 200');
  if(query!==undefined&&(typeof query!=='string'||query.trim().length<1||query.length>100))throw new Error('query must be a nonempty string of at most 100 characters');
  if(folderId!==undefined&&(typeof folderId!=='string'||!/^[A-Za-z0-9]{16}$/.test(folderId)))throw new Error('folderId must be a 16-character ID');
  return {offset,limit,...(query!==undefined?{query:query.trim()}:{}),...(folderId!==undefined?{folderId}:{})};
 }
 if(Object.keys(args).length!==1||!Object.hasOwn(args,'actorId')||typeof args.actorId!=='string'||!/^[A-Za-z0-9]{16}$/.test(args.actorId))throw new Error('actorId must be a 16-character Foundry actor ID');
 return {actorId:args.actorId};
}
