import fs from 'node:fs';
import {join} from 'node:path';

export const EMPTY_CANON_REGISTRY=Object.freeze({version:1,mappings:[]});
export function defaultRegistryPath(env=process.env){return env.CANON_REGISTRY_FILE??(env.LOCALAPPDATA?join(env.LOCALAPPDATA,'SavagePlanet','CanonSync','canon-registry.json'):null);}
export function loadCanonRegistry(path=defaultRegistryPath()){
 if(!path||!fs.existsSync(path))return {version:1,mappings:[]};
 const data=JSON.parse(fs.readFileSync(path,'utf8'));
 if(data?.version!==1||!Array.isArray(data.mappings))throw new Error('Canon registry has an unsupported format.');
 const canonicalIds=new Set(),externalIds=new Set();
 for(const mapping of data.mappings){
  if(!mapping||typeof mapping.canonicalId!=='string'||!mapping.canonicalId.trim())throw new Error('Canon registry mapping is missing canonicalId.');
  if(canonicalIds.has(mapping.canonicalId))throw new Error(`Duplicate canonicalId in canon registry: ${mapping.canonicalId}`);
  canonicalIds.add(mapping.canonicalId);
  if(mapping.scabard){
   const key=`scabard:${mapping.scabard.campaignId}:${mapping.scabard.concept}:${mapping.scabard.thingId}`;
   if(externalIds.has(key))throw new Error(`Duplicate Scabard identity in canon registry: ${key}`);
   externalIds.add(key);
  }
  if(mapping.foundry){
   const key=`foundry:${mapping.foundry.worldId}:${mapping.foundry.documentType}:${mapping.foundry.documentId}`;
   if(externalIds.has(key))throw new Error(`Duplicate Foundry identity in canon registry: ${key}`);
   externalIds.add(key);
  }
 }
 return data;
}
