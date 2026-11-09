import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adoptCanonCharacterJournal,buildCharacterJournalData,createCanonCharacterJournal,getCanonJournalStatus,JOURNAL_ADOPT_CONFIRMATION,JOURNAL_WRITE_CONFIRMATION} from '../scripts/journal-sync.mjs';

const actorId='Ow9mrwRNhmKZuXbc';
const canonicalId='character:4499025';
const payload=(overrides={})=>({
 confirmation:JOURNAL_WRITE_CONFIRMATION,canonicalId,actorId,name:'Belladonna Marshall',aliases:['Bella'],briefSummary:'A survivor & scout',
 description:'Line one\n\n<script>alert(1)</script>',secrets:'Hidden <truth>',gmSecrets:'Deep secret',imageURL:'https://example.test/bella.jpg',
 scabard:{campaignId:2543388,concept:'character',thingId:4499025,uri:'https://www.scabard.com/pbs/campaign/2543388/character/4499025',lastEditedUnix:123},...overrides
});
const game=()=>({
 actors:{get:id=>id===actorId?{id,name:'Belladonna Marshall',type:'character'}:null},
 journal:{contents:[]},folders:{contents:[]}
});

test('journal data is GM-only, actor-linked, flagged, and HTML-escaped',()=>{
 const data=buildCharacterJournalData(payload(),'FOLDER0000000001');
 assert.equal(data.ownership.default,0);
 assert.equal(data.flags['savage-planet-ai-adapter'].canonSync.canonicalId,canonicalId);
 assert.deepEqual(data.pages.map(page=>page.name),['Overview','Description','Secrets','GM Secrets','Image']);
 assert.match(data.pages[0].text.content,/@UUID\[Actor\.Ow9mrwRNhmKZuXbc\]\{Belladonna Marshall\}/);
 assert.match(data.pages[1].text.content,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.ok(!data.pages[1].text.content.includes('<script>'));
 assert.ok(data.pages.every(page=>page.ownership.default===0));
});

test('journal status detects missing, existing, and actor conflicts',()=>{
 const g=game();
 assert.equal(getCanonJournalStatus(g,{canonicalId,actorId}).status,'missing');
 const flag={canonicalId,actorId};
 g.journal.contents.push({id:'JOURNAL000000001',name:'Belladonna Marshall',folder:null,getFlag:()=>flag});
 assert.equal(getCanonJournalStatus(g,{canonicalId,actorId}).status,'exists');
 flag.actorId='AAAAAAAAAAAAAAAA';
 assert.equal(getCanonJournalStatus(g,{canonicalId,actorId}).status,'conflict');
});

test('journal status blocks an unmanaged exact-name journal from being duplicated',()=>{
 const g=game();
 g.journal.contents.push({id:'JOURNAL000000009',name:'  Belladonna   Marshall  ',folder:{id:'FOLDER0000000009'},getFlag:()=>null});
 const status=getCanonJournalStatus(g,{canonicalId,actorId});
 assert.equal(status.status,'conflict');
 assert.equal(status.reason,'unmanaged-name-match');
 assert.equal(status.matches[0].id,'JOURNAL000000009');
});

test('creation makes one folder and journal, then safely skips duplicate',async()=>{
 const g=game();let folderCreates=0,journalCreates=0;
 const FolderClass={create:async data=>{folderCreates++;const folder={id:'FOLDER0000000001',...data,getFlag:(scope,key)=>data.flags?.[scope]?.[key]};g.folders.contents.push(folder);return folder;}};
 const JournalEntryClass={create:async data=>{journalCreates++;const entry={id:'JOURNAL000000001',...data,getFlag:(scope,key)=>data.flags?.[scope]?.[key]};g.journal.contents.push(entry);return entry;}};
 const first=await createCanonCharacterJournal(g,payload(),{FolderClass,JournalEntryClass});
 const second=await createCanonCharacterJournal(g,payload(),{FolderClass,JournalEntryClass});
 assert.equal(first.created,true);
 assert.equal(second.created,false);
 assert.equal(second.reason,'exists');
 assert.equal(folderCreates,1);
 assert.equal(journalCreates,1);
});

test('creation skips an unmanaged exact-name journal',async()=>{
 const g=game();g.journal.contents.push({id:'JOURNAL000000009',name:'Belladonna Marshall',folder:null,getFlag:()=>null});
 const result=await createCanonCharacterJournal(g,payload(),{FolderClass:{create:async()=>{throw new Error('must not create');}},JournalEntryClass:{create:async()=>{throw new Error('must not create');}}});
 assert.equal(result.created,false);
 assert.equal(result.reason,'conflict');
 assert.equal(result.status.reason,'unmanaged-name-match');
});

test('creation requires exact confirmation and safe URLs',()=>{
 assert.throws(()=>buildCharacterJournalData(payload({confirmation:'yes'})),/confirmation/i);
 assert.throws(()=>buildCharacterJournalData(payload({imageURL:'javascript:alert(1)'})),/image URL/i);
});

test('adoption flags an exact legacy journal and adds one GM-only actor link page',async()=>{
 const g=game();let savedFlag=null;const createdPages=[];
 const entry={id:'JOURNAL000000009',name:'Belladonna Marshall',folder:{id:'FOLDER0000000009'},pages:{contents:[{id:'LEGACYPAGE000001',name:'Legacy Notes',getFlag:()=>null}]},getFlag:()=>savedFlag,update:async change=>{savedFlag=change.flags['savage-planet-ai-adapter'].canonSync;},createEmbeddedDocuments:async(type,pages)=>{assert.equal(type,'JournalEntryPage');createdPages.push(...pages);return pages.map((page,index)=>({id:`CANONPAGE000000${index}`, ...page,getFlag:(scope,key)=>page.flags?.[scope]?.[key]}));}};
 g.journal.contents.push(entry);g.journal.get=id=>id===entry.id?entry:null;
 const args={confirmation:JOURNAL_ADOPT_CONFIRMATION,canonicalId,actorId,journalId:entry.id,name:'Belladonna Marshall',scabard:{campaignId:2543388,concept:'character',thingId:4499025,uri:null,lastEditedUnix:123}};
 const result=await adoptCanonCharacterJournal(g,args);
 assert.equal(result.adopted,true);assert.equal(result.existingPagesPreserved,true);assert.equal(result.linkPage.created,true);
 assert.equal(savedFlag.canonicalId,canonicalId);assert.equal(savedFlag.actorId,actorId);assert.equal(savedFlag.adopted,true);
 assert.equal(createdPages.length,1);assert.equal(createdPages[0].name,'Canon Sync');assert.equal(createdPages[0].ownership.default,0);
 assert.match(createdPages[0].text.content,/@UUID\[Actor\.Ow9mrwRNhmKZuXbc\]\{Belladonna Marshall\}/);
 assert.equal(entry.pages.contents[0].name,'Legacy Notes');
});

test('adoption refuses a different journal name or existing conflicting flag',async()=>{
 const g=game();const base={id:'JOURNAL000000009',name:'Someone Else',folder:null,pages:{contents:[]},getFlag:()=>null,update:async()=>{},createEmbeddedDocuments:async()=>[]};
 g.journal.contents.push(base);g.journal.get=()=>base;
 const args={confirmation:JOURNAL_ADOPT_CONFIRMATION,canonicalId,actorId,journalId:base.id,name:'Belladonna Marshall',scabard:{campaignId:2543388,concept:'character',thingId:4499025,uri:null,lastEditedUnix:null}};
 await assert.rejects(adoptCanonCharacterJournal(g,args),/names do not match/i);
 base.name='Belladonna Marshall';base.getFlag=()=>({canonicalId:'character:1',actorId:'AAAAAAAAAAAAAAAA'});
 const result=await adoptCanonCharacterJournal(g,args);
 assert.equal(result.adopted,false);assert.equal(result.reason,'conflict');
});
