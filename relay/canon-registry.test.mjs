import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,rmSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadCanonRegistry} from './canon-registry.mjs';

test('missing canon registry safely loads empty',()=>assert.deepEqual(loadCanonRegistry(join(tmpdir(),'definitely-missing-savage-planet-registry.json')),{version:1,mappings:[]}));
test('canon registry rejects duplicate platform identities',()=>{
 const folder=mkdtempSync(join(tmpdir(),'canon-registry-'));
 const file=join(folder,'registry.json');
 try{
  writeFileSync(file,JSON.stringify({version:1,mappings:[
   {canonicalId:'character:one',scabard:{campaignId:1,concept:'character',thingId:2}},
   {canonicalId:'character:two',scabard:{campaignId:1,concept:'character',thingId:2}}
  ]}));
  assert.throws(()=>loadCanonRegistry(file),/Duplicate Scabard identity/);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
