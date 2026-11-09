export const FOUNDRY_NAMES=Object.freeze(['getActor','listActors','getSkills','getAttacks','getEquipment','getHitLocations','listJournals']);
export const INTERNAL_FOUNDRY_NAMES=Object.freeze(['getCanonJournalStatus','createCanonCharacterJournal','adoptCanonCharacterJournal']);
export const SCABARD_NAMES=Object.freeze(['scabardListCampaigns','scabardGetCampaign','scabardListPages','scabardGetPage']);
export const CANON_NAMES=Object.freeze(['canonListMappings','canonGetCharacter','canonCompareCharacter','canonPlanCharacterJournal','canonCreateCharacterJournal','canonAdoptCharacterJournal']);
export const NAMES=Object.freeze([...FOUNDRY_NAMES,...SCABARD_NAMES,...CANON_NAMES]);
export const SCABARD_CONCEPTS=Object.freeze(['character','place','group','item','event','vehicle','category','attribute','note','folder']);
const actorSchema={type:'object',properties:{actorId:{type:'string',description:'16-character Foundry character Actor ID'}},required:['actorId'],additionalProperties:false};
const listSchema={type:'object',properties:{},additionalProperties:false};
const journalListSchema={type:'object',properties:{
 offset:{type:'integer',minimum:0,description:'Zero-based offset (default 0)'},
 limit:{type:'integer',minimum:1,maximum:200,description:'Entries per page (default 100, maximum 200)'},
 query:{type:'string',minLength:1,maxLength:100,description:'Case-insensitive journal title substring filter'},
 folderId:{type:'string',pattern:'^[A-Za-z0-9]{16}$',description:'Filter by 16-character journal folder ID'}
},required:['offset','limit'],additionalProperties:false};
const campaignId={type:'integer',minimum:1,description:'Numeric Scabard campaign ID'};
const concept={type:'string',enum:SCABARD_CONCEPTS,description:'Scabard page concept'};
const thingId={type:'integer',minimum:1,description:'Numeric Scabard page ID'};
const scabardSchemas={
 scabardListCampaigns:listSchema,
 scabardGetCampaign:{type:'object',properties:{campaignId},required:['campaignId'],additionalProperties:false},
 scabardListPages:{type:'object',properties:{campaignId,concept},required:['campaignId','concept'],additionalProperties:false},
 scabardGetPage:{type:'object',properties:{campaignId,concept,thingId},required:['campaignId','concept','thingId'],additionalProperties:false}
};
const canonSchemas={
 canonListMappings:{type:'object',properties:{offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:200},query:{type:'string',minLength:1,maxLength:100}},additionalProperties:false},
 canonGetCharacter:{type:'object',properties:{canonicalId:{type:'string',pattern:'^character:[0-9]+$'}},required:['canonicalId'],additionalProperties:false},
 canonCompareCharacter:{type:'object',properties:{canonicalId:{type:'string',pattern:'^character:[0-9]+$'}},required:['canonicalId'],additionalProperties:false},
 canonPlanCharacterJournal:{type:'object',properties:{canonicalId:{type:'string',pattern:'^character:[0-9]+$'}},required:['canonicalId'],additionalProperties:false},
 canonCreateCharacterJournal:{type:'object',properties:{canonicalId:{type:'string',pattern:'^character:[0-9]+$'},confirmation:{type:'string',enum:['CREATE_MISSING_SCABARD_CHARACTER_JOURNAL'],description:'Exact confirmation required for this write'}},required:['canonicalId','confirmation'],additionalProperties:false},
 canonAdoptCharacterJournal:{type:'object',properties:{canonicalId:{type:'string',pattern:'^character:[0-9]+$'},journalId:{type:'string',pattern:'^[A-Za-z0-9]{16}$'},confirmation:{type:'string',enum:['ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL'],description:'Exact confirmation required for this write'}},required:['canonicalId','journalId','confirmation'],additionalProperties:false}
};
const descriptions={getActor:'Read a GGA character summary, prepared attributes, defenses and validation (read-only).',listActors:'List character actor IDs and names visible to the GM (read-only).',getSkills:'Read prepared and imported GURPS skills for one actor (read-only).',getAttacks:'Read melee and ranged GURPS attack data for one actor (read-only).',getEquipment:'Read GGA carried and other equipment collections (read-only).',getHitLocations:'Read GURPS hit location DR and targeting modifiers (read-only).',listJournals:'Paginate and filter journal entry IDs, titles, and folder IDs in the connected GM world (read-only; no page content).',scabardListCampaigns:'List campaigns available to the configured Scabard account (read-only).',scabardGetCampaign:'Read one Scabard campaign and its page summaries (read-only).',scabardListPages:'List Scabard pages of one supported concept in a campaign (read-only).',scabardGetPage:'Read one Scabard campaign page by concept and numeric ID (read-only).',canonListMappings:'List confirmed local links between Scabard characters and Foundry actors (read-only).',canonGetCharacter:'Read one confirmed canonical character as a joined Scabard page and live Foundry actor (read-only).',canonCompareCharacter:'Assess identity alignment, Scabard lore coverage, and Foundry sheet coverage without returning secret text or writing changes.',canonPlanCharacterJournal:'Preview whether one confirmed Scabard character needs a Foundry journal and which pages would be created (read-only; secret text is not returned).',canonCreateCharacterJournal:'Create one missing GM-only Foundry Journal Entry from a confirmed Scabard character mapping. Requires exact confirmation and never updates or overwrites an existing journal.',canonAdoptCharacterJournal:'Adopt one exact-name legacy Foundry journal into a confirmed mapping and add a GM-only Actor link page without changing existing pages.'};
export const TOOLS=NAMES.map(name=>{const write=['canonCreateCharacterJournal','canonAdoptCharacterJournal'].includes(name);return {name,description:descriptions[name],inputSchema:canonSchemas[name]??scabardSchemas[name]??(name==='listJournals'?journalListSchema:name==='listActors'?listSchema:actorSchema),annotations:{readOnlyHint:!write,destructiveHint:false,idempotentHint:write,openWorldHint:name.startsWith('scabard')||name.startsWith('canon')}};});
const positiveId=(value,label)=>{if(!Number.isSafeInteger(value)||value<1)throw new Error(`${label} must be a positive integer`);return value;};
export function validateTool(name,args){
 if(!NAMES.includes(name))throw new Error('Unknown tool');
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Tool arguments must be an object');
 if(name==='scabardListCampaigns'){if(Object.keys(args).length)throw new Error('scabardListCampaigns takes no arguments');return {};}
 if(name==='canonListMappings'){
  if(Object.keys(args).some(k=>!['offset','limit','query'].includes(k)))throw new Error('Unsupported canonListMappings argument');
  const {offset=0,limit=100,query}=args;
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('offset must be a nonnegative integer');
  if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw new Error('limit must be an integer between 1 and 200');
  if(query!==undefined&&(typeof query!=='string'||query.trim().length<1||query.length>100))throw new Error('query must be a nonempty string of at most 100 characters');
  return {offset,limit,...(query!==undefined?{query:query.trim()}: {})};
 }
 if(['canonGetCharacter','canonCompareCharacter','canonPlanCharacterJournal'].includes(name)){
  if(Object.keys(args).length!==1||typeof args.canonicalId!=='string'||!/^character:[0-9]+$/.test(args.canonicalId))throw new Error('canonicalId must use character:<numeric Scabard ID>');
  return {canonicalId:args.canonicalId};
 }
 if(name==='canonCreateCharacterJournal'){
  if(Object.keys(args).length!==2||typeof args.canonicalId!=='string'||!/^character:[0-9]+$/.test(args.canonicalId)||args.confirmation!=='CREATE_MISSING_SCABARD_CHARACTER_JOURNAL')throw new Error('canonicalId and exact journal creation confirmation are required');
  return {canonicalId:args.canonicalId,confirmation:args.confirmation};
 }
 if(name==='canonAdoptCharacterJournal'){
  if(Object.keys(args).length!==3||typeof args.canonicalId!=='string'||!/^character:[0-9]+$/.test(args.canonicalId)||typeof args.journalId!=='string'||!/^[A-Za-z0-9]{16}$/.test(args.journalId)||args.confirmation!=='ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL')throw new Error('canonicalId, journalId, and exact journal adoption confirmation are required');
  return {canonicalId:args.canonicalId,journalId:args.journalId,confirmation:args.confirmation};
 }
 if(SCABARD_NAMES.includes(name)){
  const allowed=name==='scabardGetCampaign'?['campaignId']:name==='scabardListPages'?['campaignId','concept']:['campaignId','concept','thingId'];
  if(Object.keys(args).length!==allowed.length||Object.keys(args).some(k=>!allowed.includes(k)))throw new Error(`Invalid ${name} arguments`);
  const output={campaignId:positiveId(args.campaignId,'campaignId')};
  if(allowed.includes('concept')){
   if(typeof args.concept!=='string'||!SCABARD_CONCEPTS.includes(args.concept.toLowerCase()))throw new Error(`concept must be one of: ${SCABARD_CONCEPTS.join(', ')}`);
   output.concept=args.concept.toLowerCase();
  }
  if(allowed.includes('thingId'))output.thingId=positiveId(args.thingId,'thingId');
  return output;
 }
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

export function validateBridgeOperation(name,args){
 if(!INTERNAL_FOUNDRY_NAMES.includes(name))return validateTool(name,args);
 if(name==='getCanonJournalStatus'){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==2||typeof args.canonicalId!=='string'||!/^character:[0-9]+$/.test(args.canonicalId)||typeof args.actorId!=='string'||!/^[A-Za-z0-9]{16}$/.test(args.actorId))throw new Error('Invalid canonical journal status arguments');
  return {canonicalId:args.canonicalId,actorId:args.actorId};
 }
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid canonical journal write arguments');
 if(name==='createCanonCharacterJournal'&&args.confirmation!=='CREATE_MISSING_SCABARD_CHARACTER_JOURNAL')throw new Error('Invalid canonical journal creation arguments');
 if(name==='adoptCanonCharacterJournal'&&args.confirmation!=='ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL')throw new Error('Invalid canonical journal adoption arguments');
 return args;
}
