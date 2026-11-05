import { extractActor, validateActor } from './extract.mjs';
const MODULE_ID='savage-planet-ai-adapter';
let panel;
function gmRequired(){if(!game.user?.isGM)throw new Error('GM access required');}
const el=(tag,cls='',content)=>{const n=document.createElement(tag);n.className=cls;if(content!==undefined)n.textContent=String(content);return n;};
function diagnostic(actor){const data=extractActor(actor.toObject());return {data,checks:validateActor(data)};}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function section(where,title,rows){const d=el('details','spai-section');d.open=['Core','Validation','Warnings'].includes(title);d.append(el('summary','',title+' ('+rows.length+')'),el('pre','',rows.join('\n')||'None'));where.append(d);}
function render(where,actor){
 where.replaceChildren();
 const {data,checks}=diagnostic(actor);
 where.append(el('h3','',data.identity.name+' • '+(data.pointTotal??'?')+' points'));
 section(where,'Core',[...Object.entries(data.attributes).map(([k,v])=>k+': '+v.value), 'HP: '+data.resources.HP.current+'/'+data.resources.HP.maximum,'FP: '+data.resources.FP.current+'/'+data.resources.FP.maximum,'Move: '+data.movement.currentMove+' Speed: '+data.movement.basicSpeed,'Dodge: '+data.defenses.dodge+' Parry: '+data.defenses.parry,'GGA export provenance: '+data.provenance.gga]);
 section(where,'Validation',checks.map(c=>(c.passed?'PASS':'FAIL')+' '+c.name));
 section(where,'Skills',data.skills.filter(x=>!x.isContainer).map(x=>x.name+': '+(x.level??'?')+' ('+x.levelSource+')'));
 section(where,'Advantages / Disadvantages',data.advantages.filter(x=>!x.isContainer).map(x=>x.name+' ['+x.points+']'));
 section(where,'Attacks',[...data.attacks.melee,...data.attacks.ranged].map(x=>(x.mode??x.name)+' ('+x.skillLevel+') '+x.damage+' '+(x.type==='melee'?'reach '+x.reach:'range '+x.range+' RoF '+x.rof)));
 section(where,'Equipment',[...data.equipment.carried,...data.equipment.other].map(x=>x.name));
 section(where,'Hit Locations',data.hitLocations.map(x=>x.name+': DR '+x.dr));
 section(where,'Warnings',data.warnings);
 const btn=el('button','','Export diagnostic JSON');btn.type='button';btn.onclick=()=>download('spai-'+actor.name.replace(/[^a-z0-9-]/gi,'_')+'.json',{data,checks});where.append(btn);
}
function openDiagnostics(){
 gmRequired();if(panel?.isConnected){panel.focus();return;}
 panel=el('div','spai-overlay');panel.tabIndex=-1;const dialog=el('section','spai-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 const header=el('header','spai-header');header.append(el('h2','','Savage Planet AI Adapter v0.1'));const close=el('button','','×');close.onclick=()=>panel.remove();header.append(close);dialog.append(header,el('p','spai-help','GM-only read-only GGA actor diagnostics.'));
 const bar=el('div','spai-toolbar'),select=el('select');const actors=[...game.actors.contents].filter(a=>a.type==='character').sort((a,b)=>a.name.localeCompare(b.name));for(const a of actors){const opt=el('option','',a.name);opt.value=a.id;select.append(opt);}
 const inspect=el('button','','Inspect');bar.append(select,inspect);dialog.append(bar);const body=el('div','spai-body');dialog.append(body);
 const show=()=>{const actor=game.actors.get(select.value);if(actor)render(body,actor);else body.replaceChildren(el('p','','No characters found.'));};
 select.onchange=show;inspect.onclick=show;panel.onclick=e=>{if(e.target===panel)panel.remove();};panel.onkeydown=e=>{if(e.key==='Escape')panel.remove();};panel.append(dialog);document.body.append(panel);show();panel.focus();
}
Hooks.once('ready',()=>{if(!game.user?.isGM)return;const mod=game.modules.get(MODULE_ID);if(mod)mod.api=Object.freeze({openDiagnostics,extractActor,validateActor,getActorDiagnostic(actorId){gmRequired();const actor=game.actors.get(actorId);if(!actor)throw new Error('Actor not found');return diagnostic(actor);}});console.info('[Savage Planet AI Adapter] Ready');});
