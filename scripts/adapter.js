import {extractActor,validateActor} from './extract.mjs';
import {executeOperation,executeReadOperation} from './actor-operations.mjs';
import {bridge} from './bridge.mjs';
const MODULE='savage-planet-ai-adapter';let panel;
const el=(tag,cls='',text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
function requireGM(){if(!game.user?.isGM)throw new Error('GM permission required');}
function inspect(actor){requireGM();const data=extractActor(actor.toObject(),actor.system,game.system?.version??null);return {data,checks:validateActor(data)};}
function section(parent,title,lines){const d=el('details','spai-section');d.open=['Core','Validation'].includes(title);d.append(el('summary','',title+' ('+lines.length+')'),el('pre','',lines.join('\n')||'None'));parent.append(d);}
function download(name,json){const b=new Blob([JSON.stringify(json,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=el('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function render(body,actor){
 const {data,checks}=inspect(actor);body.replaceChildren(el('h3','',data.identity.name+' • '+(data.pointTotal??'?')+' points'));
 section(body,'Core',[...Object.entries(data.attributes).map(([k,v])=>k+': '+(v.display??'?')+' ['+v.displaySource+']'+(v.storedDiffersFromImport?' (saved '+v.stored+' / imported '+v.imported+')':'')),
  'HP: '+data.resources.HP.current+'/'+data.resources.HP.maximum,'FP: '+data.resources.FP.current+'/'+data.resources.FP.maximum,
  'Speed: '+data.movement.basicSpeed+' Move: '+data.movement.currentMove,
  'Dodge: '+data.defenses.dodge+' Parry: '+data.defenses.parry,
  'GGA installed: '+(data.provenance.installedGGA??'?')+' | historical document: '+(data.provenance.documentGGA??'?')+' | exported with: '+(data.provenance.exportedWithGGA??'?')]);
 section(body,'Validation',checks.map(c=>c.status.toUpperCase()+' '+c.name+' — '+c.detail));
 section(body,'Skills',data.skills.filter(x=>!x.isContainer).map(x=>x.name+': '+(x.level??'?')+' ['+x.levelSource+'] imported '+(x.importedLevel??'?')));
 section(body,'Advantages / Disadvantages',data.advantages.filter(x=>!x.isContainer).map(x=>x.name+' ['+x.points+']'));
 section(body,'Attacks',[...data.attacks.melee,...data.attacks.ranged].map(x=>(x.mode??x.name)+' ('+x.skillLevel+') '+x.damage+' '+(x.type==='melee'?'reach '+x.reach:'range '+x.range+' RoF '+x.rof)));
 section(body,'Equipment',[...data.equipment.carried,...data.equipment.other].map(x=>x.name));
 section(body,'Hit Locations',data.hitLocations.map(x=>x.name+': DR '+x.dr+' (stored '+x.storedDR+', base '+x.importedDR+')'));
 section(body,'Warnings / notes',data.warnings);
 const btn=el('button','','Export diagnostic JSON (contains campaign data)');btn.onclick=()=>download('spai-'+actor.name.replace(/[^a-z0-9-]/gi,'_')+'.json',{data,checks});body.append(btn);
}
function openDiagnostics(){
 requireGM();if(panel?.isConnected){panel.focus();return;}
 panel=el('div','spai-overlay');panel.tabIndex=-1;const d=el('section','spai-dialog');d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
 const head=el('header','spai-header');head.append(el('h2','','Savage Planet AI Adapter v0.4.0'));const close=el('button','','×');close.onclick=()=>panel.remove();head.append(close);
 d.append(head,el('p','spai-help','GM-only GGA diagnostics and confirmed Scabard character journal sync. The external connection is disabled by default.'));
 const state=bridge.status();const connection=el('div','spai-connection','External bridge: '+state.state+(state.lastError?' — '+state.lastError:'')+'; configure under Module Settings and reopen to refresh.');d.append(connection);
 const bar=el('div','spai-toolbar'),select=el('select'),actors=[...game.actors.contents].filter(a=>a.type==='character').sort((a,b)=>a.name.localeCompare(b.name));
 for(const a of actors){const opt=el('option','',a.name);opt.value=a.id;select.append(opt);}
 const button=el('button','','Inspect');bar.append(select,button);d.append(bar);const body=el('div','spai-body');d.append(body);
 const show=()=>{const a=game.actors.get(select.value);if(a)render(body,a);else body.replaceChildren(el('p','','No character actors found.'));};
 select.onchange=show;button.onclick=show;panel.onclick=e=>{if(e.target===panel)panel.remove();};panel.onkeydown=e=>{if(e.key==='Escape')panel.remove();};panel.append(d);document.body.append(panel);show();panel.focus();
}
Hooks.once('ready',()=>{if(!game.user?.isGM)return;const mod=game.modules.get(MODULE);if(mod)mod.api=Object.freeze({openDiagnostics,extractActor,validateActor,getActorDiagnostic(id){requireGM();const actor=game.actors.get(id);if(!actor)throw new Error('Actor not found');return inspect(actor);},executeRead(name,args){requireGM();return executeReadOperation(game,name,args);},execute(name,args){requireGM();return executeOperation(game,name,args);},bridgeStatus:bridge.status,reconnectBridge:bridge.connect,disconnectBridge:bridge.stop});console.info('[Savage Planet AI Adapter] v0.4.0 ready');});
