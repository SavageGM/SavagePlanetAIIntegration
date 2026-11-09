const MODULE_ID='savage-planet-ai-adapter';
const FLAG_KEY='canonSync';
export const JOURNAL_FOLDER_NAME='Scabard Characters';
export const JOURNAL_WRITE_CONFIRMATION='CREATE_MISSING_SCABARD_CHARACTER_JOURNAL';
export const JOURNAL_ADOPT_CONFIRMATION='ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL';

const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const escapeHTML=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const safeId=(value,label)=>{if(typeof value!=='string'||!/^[A-Za-z0-9]{16}$/.test(value))throw new Error(`Invalid ${label}`);return value;};
const safeCanonicalId=value=>{if(typeof value!=='string'||!/^character:[0-9]+$/.test(value))throw new Error('Invalid canonical ID');return value;};
const boundedString=(value,label,max,{empty=true}={})=>{
 if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw new Error(`Invalid ${label}`);
 return value.trim();
};
const safeURL=(value,label)=>{
 if(value===null||value===undefined||value==='')return null;
 const text=boundedString(value,label,2000,{empty:false});let url;
 try{url=new URL(text);}catch{throw new Error(`Invalid ${label}`);}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error(`Invalid ${label}`);
 return url.href;
};
const textHTML=value=>{
 const clean=String(value??'').replace(/\r\n?/g,'\n').trim();
 if(!clean)return '';
 return clean.split(/\n{2,}/).map(part=>`<p>${escapeHTML(part).replaceAll('\n','<br>')}</p>`).join('');
};
const flagOf=document=>document?.getFlag?.(MODULE_ID,FLAG_KEY)??document?.flags?.[MODULE_ID]?.[FLAG_KEY]??document?._source?.flags?.[MODULE_ID]?.[FLAG_KEY]??null;
const normalizedName=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();

export function validateJournalIdentity(args){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['canonicalId','actorId'].includes(key)))throw new Error('Invalid journal identity arguments');
 return {canonicalId:safeCanonicalId(args.canonicalId),actorId:safeId(args.actorId,'actor ID')};
}

export function validateJournalCreate(args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid journal create arguments');
 const allowed=['confirmation','canonicalId','actorId','name','aliases','briefSummary','description','secrets','gmSecrets','imageURL','scabard'];
 if(Object.keys(args).some(key=>!allowed.includes(key))||args.confirmation!==JOURNAL_WRITE_CONFIRMATION)throw new Error('Explicit journal creation confirmation is required');
 if(!Array.isArray(args.aliases)||args.aliases.length>50||args.aliases.some(value=>typeof value!=='string'||value.length>200))throw new Error('Invalid aliases');
 if(!args.scabard||typeof args.scabard!=='object'||Array.isArray(args.scabard)||Object.keys(args.scabard).some(key=>!['campaignId','concept','thingId','uri','lastEditedUnix'].includes(key)))throw new Error('Invalid Scabard identity');
 if(!Number.isSafeInteger(args.scabard.campaignId)||args.scabard.campaignId<1||args.scabard.concept!=='character'||!Number.isSafeInteger(args.scabard.thingId)||args.scabard.thingId<1)throw new Error('Invalid Scabard identity');
 if(args.scabard.lastEditedUnix!==null&&args.scabard.lastEditedUnix!==undefined&&(!Number.isSafeInteger(args.scabard.lastEditedUnix)||args.scabard.lastEditedUnix<0))throw new Error('Invalid Scabard edit timestamp');
 return {
  confirmation:args.confirmation,canonicalId:safeCanonicalId(args.canonicalId),actorId:safeId(args.actorId,'actor ID'),
  name:boundedString(args.name,'character name',200,{empty:false}),aliases:args.aliases.map(value=>value.trim()).filter(Boolean),
  briefSummary:boundedString(args.briefSummary??'','brief summary',20000),description:boundedString(args.description??'','description',200000),
  secrets:boundedString(args.secrets??'','secrets',100000),gmSecrets:boundedString(args.gmSecrets??'','GM secrets',100000),
  imageURL:safeURL(args.imageURL,'image URL'),
  scabard:{campaignId:args.scabard.campaignId,concept:'character',thingId:args.scabard.thingId,uri:safeURL(args.scabard.uri,'Scabard URI'),lastEditedUnix:args.scabard.lastEditedUnix??null}
 };
}

export function validateJournalAdopt(args){
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid journal adoption arguments');
 const allowed=['confirmation','canonicalId','actorId','journalId','name','scabard'];
 if(Object.keys(args).some(key=>!allowed.includes(key))||args.confirmation!==JOURNAL_ADOPT_CONFIRMATION)throw new Error('Explicit journal adoption confirmation is required');
 if(!args.scabard||typeof args.scabard!=='object'||Array.isArray(args.scabard)||Object.keys(args.scabard).some(key=>!['campaignId','concept','thingId','uri','lastEditedUnix'].includes(key)))throw new Error('Invalid Scabard identity');
 if(!Number.isSafeInteger(args.scabard.campaignId)||args.scabard.campaignId<1||args.scabard.concept!=='character'||!Number.isSafeInteger(args.scabard.thingId)||args.scabard.thingId<1)throw new Error('Invalid Scabard identity');
 if(args.scabard.lastEditedUnix!==null&&args.scabard.lastEditedUnix!==undefined&&(!Number.isSafeInteger(args.scabard.lastEditedUnix)||args.scabard.lastEditedUnix<0))throw new Error('Invalid Scabard edit timestamp');
 return {confirmation:args.confirmation,canonicalId:safeCanonicalId(args.canonicalId),actorId:safeId(args.actorId,'actor ID'),journalId:safeId(args.journalId,'journal ID'),name:boundedString(args.name,'character name',200,{empty:false}),scabard:{campaignId:args.scabard.campaignId,concept:'character',thingId:args.scabard.thingId,uri:safeURL(args.scabard.uri,'Scabard URI'),lastEditedUnix:args.scabard.lastEditedUnix??null}};
}

function actorFor(game,actorId){
 const actor=game.actors?.get?.(actorId);
 if(!actor||actor.type!=='character')throw new Error('Mapped Foundry character actor not found');
 return actor;
}
function matchingJournals(game,canonicalId){return [...(game.journal?.contents??[])].filter(entry=>flagOf(entry)?.canonicalId===canonicalId);}

export function getCanonJournalStatus(game,args){
 const identity=validateJournalIdentity(args);const actor=actorFor(game,identity.actorId);const matches=matchingJournals(game,identity.canonicalId);
 if(matches.length>1)return {status:'conflict',canonicalId:identity.canonicalId,actor:{id:actor.id,name:actor.name},matches:matches.map(entry=>({id:entry.id,name:entry.name,folderId:entry.folder?.id??null}))};
 if(matches.length===1){const entry=matches[0],flag=flagOf(entry);return {status:flag?.actorId===identity.actorId?'exists':'conflict',canonicalId:identity.canonicalId,actor:{id:actor.id,name:actor.name},journal:{id:entry.id,name:entry.name,folderId:entry.folder?.id??null,actorId:flag?.actorId??null}};}
 const unmanagedNameMatches=[...(game.journal?.contents??[])].filter(entry=>!flagOf(entry)&&normalizedName(entry.name)===normalizedName(actor.name));
 if(unmanagedNameMatches.length)return {status:'conflict',reason:'unmanaged-name-match',canonicalId:identity.canonicalId,actor:{id:actor.id,name:actor.name},matches:unmanagedNameMatches.map(entry=>({id:entry.id,name:entry.name,folderId:entry.folder?.id??null}))};
 return {status:'missing',canonicalId:identity.canonicalId,actor:{id:actor.id,name:actor.name}};
}

export function buildCharacterJournalData(input,folderId=null){
 const data=validateJournalCreate(input);const actorLabel=data.name.replace(/[\[\]{}]/g,'');const actorLink=`@UUID[Actor.${data.actorId}]{${actorLabel}}`;
 const sourceLink=data.scabard.uri?`<p><strong>Scabard:</strong> <a href="${escapeHTML(data.scabard.uri)}" target="_blank" rel="noopener noreferrer">Open source page</a></p>`:'';
 const aliases=data.aliases.length?`<p><strong>Aliases:</strong> ${escapeHTML(data.aliases.join(', '))}</p>`:'';
 const overview=`<p><strong>Foundry Actor:</strong> ${actorLink}</p>${aliases}${textHTML(data.briefSummary)}${sourceLink}`;
 const flag={canonicalId:data.canonicalId,actorId:data.actorId,source:'scabard',scabard:data.scabard};
 const page=(name,content,secret=false)=>({name,type:'text',text:{content,format:1},ownership:{default:0},flags:{[MODULE_ID]:{[FLAG_KEY]:{...flag,page:name,secret}}}});
 const pages=[page('Overview',overview)];
 if(data.description)pages.push(page('Description',textHTML(data.description)));
 if(data.secrets)pages.push(page('Secrets',textHTML(data.secrets),true));
 if(data.gmSecrets)pages.push(page('GM Secrets',textHTML(data.gmSecrets),true));
 if(data.imageURL)pages.push({name:'Image',type:'image',src:data.imageURL,ownership:{default:0},flags:{[MODULE_ID]:{[FLAG_KEY]:{...flag,page:'Image',secret:false}}}});
 return {name:data.name,folder:folderId,ownership:{default:0},pages,flags:{[MODULE_ID]:{[FLAG_KEY]:flag}}};
}

async function findOrCreateFolder(game,FolderClass){
 const folders=[...(game.folders?.contents??game.folders??[])];
 const existing=folders.find(folder=>folder.type==='JournalEntry'&&(folder.getFlag?.(MODULE_ID,'canonSyncFolder')===true||folder.name===JOURNAL_FOLDER_NAME));
 if(existing)return existing;
 if(!FolderClass?.create)throw new Error('Foundry Folder API is unavailable');
 return FolderClass.create({name:JOURNAL_FOLDER_NAME,type:'JournalEntry',sorting:'a',flags:{[MODULE_ID]:{canonSyncFolder:true}}});
}

export async function createCanonCharacterJournal(game,args,{FolderClass=globalThis.Folder,JournalEntryClass=globalThis.JournalEntry}={}){
 const data=validateJournalCreate(args);actorFor(game,data.actorId);
 const before=getCanonJournalStatus(game,{canonicalId:data.canonicalId,actorId:data.actorId});
 if(before.status!=='missing')return {created:false,reason:before.status,status:before};
 const folder=await findOrCreateFolder(game,FolderClass);
 if(!folder?.id)throw new Error('Scabard Characters folder could not be created');
 if(!JournalEntryClass?.create)throw new Error('Foundry JournalEntry API is unavailable');
 const entry=await JournalEntryClass.create(buildCharacterJournalData(data,folder.id));
 if(!entry?.id)throw new Error('Character journal could not be created');
 return {created:true,canonicalId:data.canonicalId,journal:{id:entry.id,name:entry.name??data.name,folderId:folder.id},actor:{id:data.actorId,name:data.name},pages:entry.pages?.size??entry.pages?.length??buildCharacterJournalData(data,folder.id).pages.length};
}

export async function adoptCanonCharacterJournal(game,args){
 const data=validateJournalAdopt(args);const actor=actorFor(game,data.actorId);
 const entry=game.journal?.get?.(data.journalId)??[...(game.journal?.contents??[])].find(journal=>journal.id===data.journalId);
 if(!entry)throw new Error('Foundry journal to adopt was not found');
 if(normalizedName(entry.name)!==normalizedName(actor.name)||normalizedName(entry.name)!==normalizedName(data.name))throw new Error('Journal, actor, and canonical names do not match');
 const flag={canonicalId:data.canonicalId,actorId:data.actorId,source:'scabard',adopted:true,scabard:data.scabard};
 const existingFlag=flagOf(entry);
 if(existingFlag&&(existingFlag.canonicalId!==data.canonicalId||existingFlag.actorId!==data.actorId))return {adopted:false,reason:'conflict',journal:{id:entry.id,name:entry.name},existing:{canonicalId:existingFlag.canonicalId??null,actorId:existingFlag.actorId??null}};
 if(!existingFlag){
  if(typeof entry.update!=='function')throw new Error('Foundry journal update API is unavailable');
  await entry.update({flags:{[MODULE_ID]:{[FLAG_KEY]:flag}}});
 }
 const pages=[...(entry.pages?.contents??entry.pages??[])];
 let linkPage=pages.find(page=>flagOf(page)?.role==='actor-link');
 let linkPageCreated=false;
 if(!linkPage){
  if(typeof entry.createEmbeddedDocuments!=='function')throw new Error('Foundry journal page creation API is unavailable');
  const actorLabel=data.name.replace(/[\[\]{}]/g,'');const actorLink=`@UUID[Actor.${data.actorId}]{${actorLabel}}`;
  const sourceLink=data.scabard.uri?`<p><strong>Scabard:</strong> <a href="${escapeHTML(data.scabard.uri)}" target="_blank" rel="noopener noreferrer">Open source page</a></p>`:`<p><strong>Scabard character ID:</strong> ${data.scabard.thingId}</p>`;
  const created=await entry.createEmbeddedDocuments('JournalEntryPage',[{name:'Canon Sync',type:'text',text:{content:`<p><strong>Foundry Actor:</strong> ${actorLink}</p>${sourceLink}`,format:1},ownership:{default:0},flags:{[MODULE_ID]:{[FLAG_KEY]:{...flag,role:'actor-link',page:'Canon Sync',secret:false}}}}]);
  linkPage=created?.[0]??null;linkPageCreated=true;
 }
 return {adopted:true,alreadyAdopted:Boolean(existingFlag),canonicalId:data.canonicalId,journal:{id:entry.id,name:entry.name,folderId:entry.folder?.id??null},actor:{id:actor.id,name:actor.name},linkPage:{id:linkPage?.id??null,name:linkPage?.name??'Canon Sync',created:linkPageCreated},existingPagesPreserved:true};
}

export const JOURNAL_MODULE_ID=MODULE_ID;
