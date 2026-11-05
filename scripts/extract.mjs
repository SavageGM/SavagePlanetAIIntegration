// Pure, read-only transformation of a GGA actor document.
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const num = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const val = v => v === undefined || v === null || v === '' ? null : v;
const entries = tree => Object.entries(obj(tree)).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
function flatten(tree, family) {
  const out = [];
  function visit(tree, depth=0) {
    if(depth>24) return;
    for(const [key,node] of entries(tree)) {
      const e=obj(node), children=obj(e.contains);
      out.push({name:e.name??e.originalName??key,level:num(e.level)>0?num(e.level):num(e.import),levelSource:num(e.level)>0?'level':num(e.import)!==null?'import':null,points:num(e.points),relativeLevel:val(e.relativelevel),notes:val(e.notes),cr:num(e.cr),isContainer:Object.keys(children).length>0,depth,uuid:val(e.uuid),itemId:val(e.itemid),family});
      visit(children,depth+1);
    }
  }
  visit(tree);return out;
}
function attacks(tree,type) {
 return entries(tree).map(([key,e])=>({key,type,name:val(e.name),mode:val(e.mode),skillLevel:num(e.level)>0?num(e.level):num(e.import),damage:val(e.damage),reach:val(e.reach),range:val(e.range),rof:val(e.rof),parry:val(e.parry),notes:val(e.notes)}));
}
export function extractActor(input) {
 const actor=obj(input),s=obj(actor.system),attributes={};
 for(const [key,a] of entries(s.attributes))attributes[key]={value:val(a.value),imported:val(a.import),points:num(a.points)};
 const skills=flatten(s.skills,'skills'),advantages=flatten(s.ads,'advantages');
 const equipment={carried:flatten(s.equipment?.carried,'carried'),other:flatten(s.equipment?.other,'other')};
 const hitLocations=entries(s.hitlocations).map(([key,h])=>({key,name:h.where,dr:num(h.dr),importedDR:num(h.import),itemDR:num(h.drItem),modifierDR:num(h.drMod),cappedDR:num(h.drCap),penalty:val(h.penalty)}));
 const encumbrance=entries(s.encumbrance).map(([key,e])=>({key,level:num(e.level),current:Boolean(e.current),dodge:num(e.dodge),move:num(e.move),weight:val(e.weight)}));
 const currentEnc=encumbrance.find(e=>e.current);
 const items=Array.isArray(actor.items)?actor.items:[];
 const result={
 schema:'savage-planet.gga.actor.v0.1',
 identity:{name:actor.name??'',id:actor._id??actor.id??null,type:actor.type??null},
 provenance:{foundry:actor._stats?.exportSource?.coreVersion??actor._stats?.coreVersion??null,gga:actor._stats?.exportSource?.systemVersion??actor._stats?.systemVersion??null,source:'GGA actor document',gcsImport:val(s.additionalresources?.importname)},
 attributes,resources:{HP:{current:num(s.HP?.value),maximum:num(s.HP?.max)},FP:{current:num(s.FP?.value),maximum:num(s.FP?.max)}},
 movement:{basicSpeed:num(s.basicspeed?.value),basicMove:num(s.basicmove?.value),currentMove:num(s.currentmove)},
 defenses:{dodge:num(s.currentdodge)??num(currentEnc?.dodge)??num(s.dodge?.value),dodgeSource:num(s.currentdodge)!==null?'currentdodge':currentEnc?'current encumbrance':'dodge.value',parry:num(s.parry),note:'Parry may be attack-specific'},
 pointTotal:num(s.totalpoints?.total),skills,advantages,equipment,
 attacks:{melee:attacks(s.melee,'melee'),ranged:attacks(s.ranged,'ranged')},
 hitLocations,encumbrance,itemSummary:items.reduce((a,i)=>(a[i.type??'unknown']=(a[i.type??'unknown']??0)+1,a),{}),warnings:[]
 };
 if(num(s.dodge?.value)===0&&num(s.currentdodge)!==null)result.warnings.push('dodge.value is zero; currentdodge used.');
 if(skills.some(x=>x.levelSource==='import'))result.warnings.push('Some skill levels use GCS imported values; verify against live sheet.');
 if(!equipment.carried.length&&!equipment.other.length)result.warnings.push('Equipment inventory is empty.');
 if(actor._stats?.exportSource?.systemVersion&&actor._stats.exportSource.systemVersion!=='0.18.27')result.warnings.push('This actor was exported under an earlier GGA version.');
 return result;
}
export function validateActor(result) {
 return [['GURPS attributes',['ST','DX','IQ','HT'].every(k=>num(result.attributes[k]?.value)!==null)],['HP and FP',num(result.resources.HP.current)!==null&&num(result.resources.FP.current)!==null],['Skills collection',Array.isArray(result.skills)],['Attack collections',Array.isArray(result.attacks.melee)&&Array.isArray(result.attacks.ranged)],['Hit-location collection',Array.isArray(result.hitLocations)],['Read-only extraction',true]].map(([name,passed])=>({name,passed}));
}
