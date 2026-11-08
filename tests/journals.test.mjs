import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeReadOperation} from '../scripts/actor-operations.mjs';

const folderA='RyqHyckQHV6Hy9fa',folderB='BFTDpUpISgkQZis0';
const journal=(id,name,folderId)=>({id,name,folder:folderId?{id:folderId}:null});
const mockGame=(worldId='world-alpha')=>({
 user:{isGM:true},system:{id:'gurps',version:'0.18.27'},world:{id:worldId,title:'Test World'},
 journal:{contents:[
  journal('AAAA000000000001','Cheyenne',folderA),
  journal('AAAA000000000002','Cheyenne Refinery',folderA),
  journal('AAAA000000000003','Duf-Dub',folderB),
  journal('AAAA000000000004','Cheyenne City',folderA),
  journal('AAAA000000000005','Trade Routes',null)
 ]}
});

test('journal pagination exposes every entry without truncating the world',()=>{
 const g=mockGame();
 const a=executeReadOperation(g,'listJournals',{offset:0,limit:2});
 const b=executeReadOperation(g,'listJournals',{offset:2,limit:2});
 const c=executeReadOperation(g,'listJournals',{offset:4,limit:2});
 assert.equal(a.total,5);
 assert.equal(a.journals.length,2);
 assert.equal(a.nextOffset,2);
 assert.equal(b.nextOffset,4);
 assert.equal(c.nextOffset,null);
 assert.equal(c.hasMore,false);
 assert.equal(new Set([...a.journals,...b.journals,...c.journals].map(j=>j.id)).size,5);
 assert.deepEqual(a.world,{id:'world-alpha',title:'Test World'});
});

test('journal filtering is scoped to the connected world and folder',()=>{
 const g=mockGame('world-beta');
 const response=executeReadOperation(g,'listJournals',{query:'cHeYeNnE',folderId:folderA,limit:100});
 assert.equal(response.total,3);
 assert.equal(response.world.id,'world-beta');
 assert.ok(response.journals.every(j=>j.folderId===folderA));
 assert.ok(response.journals.every(j=>j.name.toLowerCase().includes('cheyenne')));
 g.user.isGM=false;
 assert.throws(()=>executeReadOperation(g,'listJournals',{}),/GM permission required/);
});
