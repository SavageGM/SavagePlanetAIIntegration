import {executeReadOperation} from './actor-operations.mjs';

const CREATE_CONFIRMATION='CREATE_MISSING_SCABARD_CHARACTER_JOURNAL';
const ADOPT_CONFIRMATION='ADOPT_EXISTING_SCABARD_CHARACTER_JOURNAL';
const el=(tag,cls='',text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const statusLabel=status=>{
 if(status.status==='exists')return 'Linked';
 if(status.status==='missing')return 'Missing';
 if(status.reason==='unmanaged-name-match')return 'Existing journal needs adoption';
 return status.status==='conflict'?'Conflict':'Review';
};

export function openCanonManager({game,bridge,version}){
 if(!game.user?.isGM)throw new Error('GM permission required');
 const overlay=el('div','spai-overlay'),dialog=el('section','spai-dialog spai-canon-dialog');
 const header=el('header','spai-header');header.append(el('h2','',`Canon Journal Sync v${version}`));
 const close=el('button','','×');close.onclick=()=>overlay.remove();header.append(close);
 const help=el('p','spai-help','Confirmed Scabard character mappings only. Create never overwrites; Adopt preserves every existing journal page.');
 const state=el('div','spai-connection','Ready to load confirmed mappings.');
 const controls=el('div','spai-toolbar'),filter=el('input'),load=el('button','','Load / Refresh');filter.placeholder='Filter characters';filter.type='search';controls.append(filter,load);
 const summary=el('div','spai-canon-summary','');
 const table=el('table','spai-canon-table');table.innerHTML='<thead><tr><th>Character</th><th>Actor</th><th>Status</th><th>Action</th></tr></thead>';
 const body=el('tbody');table.append(body);dialog.append(header,help,state,controls,summary,table);overlay.append(dialog);document.body.append(overlay);
 let rows=[];
 const notify=(message,error=false)=>{state.textContent=message;state.classList.toggle('spai-error',error);};
 const refreshRow=async row=>{try{row.status=executeReadOperation(game,'getCanonJournalStatus',{canonicalId:row.mapping.canonicalId,actorId:row.mapping.foundry.documentId});}catch(error){row.status={status:'review',error:String(error?.message??error)};}};
 const render=()=>{
  const needle=filter.value.trim().toLocaleLowerCase('en-US');body.replaceChildren();
  const visible=rows.filter(row=>!needle||row.mapping.name.toLocaleLowerCase('en-US').includes(needle));
  const counts=rows.reduce((acc,row)=>{const key=statusLabel(row.status);acc[key]=(acc[key]??0)+1;return acc;},{});
  summary.textContent=`${rows.length} confirmed mappings • `+Object.entries(counts).map(([key,value])=>`${key}: ${value}`).join(' • ');
  for(const row of visible){
   const tr=el('tr'),name=el('td','',row.mapping.name),actor=el('td','',row.mapping.foundry.documentId),status=el('td','',statusLabel(row.status)),action=el('td');
   if(row.status.status==='missing'){
    const button=el('button','','Create');button.onclick=async()=>{
     button.disabled=true;try{notify(`Planning ${row.mapping.name}…`);const plan=await bridge.request('canonPlanCharacterJournal',{canonicalId:row.mapping.canonicalId});
      if(!plan.wouldCreate)throw new Error(`Journal is no longer missing (${plan.status?.status??'unknown'})`);
      const pages=plan.pages.join(', ')||'Overview';if(!window.confirm(`Create a GM-only journal for ${row.mapping.name}?\n\nPages: ${pages}\n\nNo existing journal will be overwritten.`)){notify('Create cancelled.');return;}
      notify(`Creating ${row.mapping.name}…`);await bridge.request('canonCreateCharacterJournal',{canonicalId:row.mapping.canonicalId,confirmation:CREATE_CONFIRMATION});await refreshRow(row);render();notify(`${row.mapping.name} journal created and linked.`);
     }catch(error){notify(String(error?.message??error),true);}finally{button.disabled=false;}
    };action.append(button);
   }else if(row.status.status==='conflict'&&row.status.reason==='unmanaged-name-match'&&row.status.matches?.length===1){
    const match=row.status.matches[0],button=el('button','','Adopt');button.onclick=async()=>{
     button.disabled=true;try{if(!window.confirm(`Adopt the existing journal “${match.name}” for ${row.mapping.name}?\n\nJournal ID: ${match.id}\n\nAll existing pages will be preserved and a GM-only Actor link page will be added.`)){notify('Adoption cancelled.');return;}
      notify(`Adopting ${row.mapping.name}…`);await bridge.request('canonAdoptCharacterJournal',{canonicalId:row.mapping.canonicalId,journalId:match.id,confirmation:ADOPT_CONFIRMATION});await refreshRow(row);render();notify(`${row.mapping.name} journal adopted and linked.`);
     }catch(error){notify(String(error?.message??error),true);}finally{button.disabled=false;}
    };action.append(button);
   }else action.textContent=row.status.status==='exists'?'—':'Manual review';
   if(row.status.error)status.title=row.status.error;tr.append(name,actor,status,action);body.append(tr);
  }
 };
 const loadRows=async()=>{load.disabled=true;notify('Loading confirmed mappings…');try{
  const result=await bridge.request('canonListMappings',{offset:0,limit:200});rows=result.mappings.map(mapping=>({mapping,status:{status:'review'}}));
  for(const row of rows)await refreshRow(row);render();notify(`Loaded ${rows.length} confirmed mappings from the authenticated relay.`);
 }catch(error){notify(String(error?.message??error),true);rows=[];render();}finally{load.disabled=false;}};
 load.onclick=loadRows;filter.oninput=render;overlay.onclick=event=>{if(event.target===overlay)overlay.remove();};overlay.onkeydown=event=>{if(event.key==='Escape')overlay.remove();};overlay.tabIndex=-1;overlay.focus();loadRows();
 return overlay;
}
