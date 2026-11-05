// Read-only GGA diagnostics. Serialized values may be defaults until actor preparation.
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const val=v=>v===null||v===undefined||v===''?null:v;
const entries=v=>Object.entries(obj(v)).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
function flatten(tree,family){
 const out=[];
 function visit(tree,depth=0){if(depth>24)return;for(const [key,raw] of entries(tree)){
  const e=obj(raw),children=obj(e.contains),imported=num(e.import),effective=num(e.level);
  out.push({name:e.name??e.originalName??key,importedLevel:imported,effectiveLevel:effective>0?effective:null,
   level:effective>0?effective:imported,levelSource:effective>0?'prepared':imported!==null?'imported':'unknown',
   relativeLevel:val(e.relativelevel),points:num(e.points),notes:val(e.notes),cr:num(e.cr),
   isContainer:Object.keys(children).length>0,depth,family});visit(children,depth+1);
 }}visit(tree);return out;
}
const attacks=(tree,type)=>entries(tree).map(([key,e])=>({key,type,name:val(e.name),mode:val(e.mode),
 skillLevel:num(e.level)>0?num(e.level):num(e.import),skillLevelSource:num(e.level)>0?'prepared':'imported',
 damage:val(e.damage),reach:val(e.reach),range:val(e.range),rof:val(e.rof),parry:val(e.parry)}));
export function extractActor(input,runtimeSystem=null,installedGGA=null){
 const a=obj(input),s=obj(a.system),runtime=runtimeSystem?obj(runtimeSystem):null,attributes={};
 for(const [key,raw] of entries(s.attributes)){
  const imported=num(raw.import),stored=num(raw.value),effective=runtime?num(runtime.attributes?.[key]?.value):null;
  attributes[key]={imported,stored,effective,display:effective??imported??stored,
   displaySource:effective!==null?'runtime':imported!==null?'imported':'stored',
   storedDiffersFromImport:stored!==null&&imported!==null&&stored!==imported,
   effectiveDiffersFromImport:effective!==null&&imported!==null&&effective!==imported,points:num(raw.points)};
 }
 const skills=flatten(s.skills,'skills');
 if(runtime){flatten(runtime.skills,'skills').forEach((p,i)=>{const row=skills[i];if(row&&row.name===p.name&&p.effectiveLevel!==null){
  row.effectiveLevel=p.effectiveLevel;row.level=p.effectiveLevel;row.levelSource='prepared';
 }});}
 const advantages=flatten(s.ads,'advantages');
 const equipment={carried:flatten(s.equipment?.carried,'equipment'),other:flatten(s.equipment?.other,'equipment')};
 const hitLocations=entries(s.hitlocations).map(([key,h])=>({key,name:h.where,
  dr:num(runtime?.hitlocations?.[key]?.dr)??num(h.dr),storedDR:num(h.dr),importedDR:num(h.import),
  itemDR:num(h.drItem),modifierDR:num(h.drMod),penalty:val(h.penalty)}));
 const encumbrance=entries(s.encumbrance).map(([key,e])=>({key,level:num(e.level),current:Boolean(e.current),dodge:num(e.dodge),move:num(e.move)}));
 const activeEnc=encumbrance.find(e=>e.current);
 const itemSummary=(Array.isArray(a.items)?a.items:[]).reduce((map,i)=>(map[i.type??'unknown']=(map[i.type??'unknown']??0)+1,map),{});
 const data={schema:'savage-planet.gga.actor.v0.1.1',identity:{id:a._id??a.id??(/^Actor\.[A-Za-z0-9]{16}$/.test(a._stats?.exportSource?.uuid??'')?a._stats.exportSource.uuid.slice(6):null),name:a.name??'',type:a.type??null},
 provenance:{exportedWithGGA:a._stats?.exportSource?.systemVersion??null,documentGGA:a._stats?.systemVersion??null,
  installedGGA:installedGGA??null,foundry:a._stats?.exportSource?.coreVersion??a._stats?.coreVersion??null,
  gcsImport:val(s.additionalresources?.importname),lastImport:val(s.lastImport),runtimeCompared:!!runtime},
 attributes,resources:{HP:{current:num(runtime?.HP?.value)??num(s.HP?.value),maximum:num(runtime?.HP?.max)??num(s.HP?.max)},
  FP:{current:num(runtime?.FP?.value)??num(s.FP?.value),maximum:num(runtime?.FP?.max)??num(s.FP?.max)}},
 movement:{basicSpeed:num(runtime?.basicspeed?.value)??num(s.basicspeed?.value),currentMove:num(runtime?.currentmove)??num(s.currentmove)},
 defenses:{dodge:num(runtime?.currentdodge)??num(s.currentdodge)??num(activeEnc?.dodge),parry:num(runtime?.parry)??num(s.parry)},
 pointTotal:num(s.totalpoints?.total),skills,advantages,equipment,
 attacks:{melee:attacks(runtime?.melee??s.melee,'melee'),ranged:attacks(runtime?.ranged??s.ranged,'ranged')},
 hitLocations,encumbrance,itemSummary,warnings:[]};
 const diffs=Object.entries(attributes).filter(([,v])=>v.storedDiffersFromImport).map(([k])=>k);
 if(diffs.length)data.warnings.push('Serialized attribute values differ from imports ('+diffs.join(', ')+'). GGA derives working values during actor preparation.');
 if(!runtime)data.warnings.push('Offline export: displaying imported attributes, not verified effective attributes.');
 if(runtime&&Object.values(attributes).some(v=>v.effective===null))data.warnings.push('Some live effective values are unavailable.');
 if(skills.some(v=>v.levelSource==='imported'))data.warnings.push('Some skill levels are imported; modifiers can change effective levels.');
 if(!equipment.carried.length&&!equipment.other.length)data.warnings.push('Equipment inventory empty in actor system data.');
 return data;
}
export function validateActor(data){
 const attrs=['ST','DX','IQ','HT','WILL','PER'];
 const checks=[
 {name:'Core imported attributes',status:attrs.every(k=>num(data.attributes[k]?.imported)!==null)?'pass':'fail',detail:'Required imported fields'},
 {name:'Live effective attributes',status:!data.provenance.runtimeCompared?'info':attrs.every(k=>num(data.attributes[k]?.effective)!==null)?'pass':'warn',detail:data.provenance.runtimeCompared?'Prepared actor checked':'Offline: cannot validate live values'},
 {name:'Stored versus imported attributes',status:Object.values(data.attributes).some(v=>v.storedDiffersFromImport)?'info':'pass',detail:'Serialized values may be defaults'},
 {name:'HP and FP data',status:num(data.resources.HP.current)!==null&&num(data.resources.FP.current)!==null?'pass':'fail',detail:'Resource fields'},
 {name:'Skill source fields',status:Array.isArray(data.skills)?'pass':'fail',detail:'Imported/prepared levels distinguished'},
 {name:'Attack lists',status:Array.isArray(data.attacks.melee)&&Array.isArray(data.attacks.ranged)?'pass':'fail',detail:'Attack lists readable'},
 {name:'Hit locations',status:Array.isArray(data.hitLocations)?'pass':'fail',detail:'Location DR retained'}];
 return checks.map(c=>({...c,passed:c.status==='pass'}));
}
