import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScabardClient} from './scabard-client.mjs';

const jsonResponse=(body,status=200)=>({ok:status>=200&&status<300,status,headers:{get:()=> 'application/json'},json:async()=>body});

test('Scabard client sends credentials only in headers and reads campaign resources',async()=>{
 const calls=[];
 const client=new ScabardClient({username:'savagegm',accessKey:'temporary-secret',baseUrl:'https://www.scabard.com/api/v0/',fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return jsonResponse({rows:[]});}});
 await client.listCampaigns();
 await client.getCampaign(121);
 await client.listPages(121,'character');
 await client.getPage(121,'character',162);
 assert.deepEqual(calls.map(x=>x.url),[
  'https://www.scabard.com/api/v0/campaign',
  'https://www.scabard.com/api/v0/campaign/121',
  'https://www.scabard.com/api/v0/campaign/121/character',
  'https://www.scabard.com/api/v0/campaign/121/character/162'
 ]);
 for(const call of calls){
  assert.equal(call.options.method,'GET');
  assert.equal(call.options.headers.username,'savagegm');
  assert.equal(call.options.headers.accessKey,'temporary-secret');
  assert.ok(!call.url.includes('temporary-secret'));
 }
});

test('Scabard client fails closed without credentials',async()=>{
 const client=new ScabardClient({fetchImpl:async()=>{throw new Error('should not fetch');}});
 await assert.rejects(client.listCampaigns(),/not configured/i);
});

test('Scabard authentication errors do not expose credentials',async()=>{
 const client=new ScabardClient({username:'savagegm',accessKey:'never-log-this',fetchImpl:async()=>jsonResponse({},401)});
 await assert.rejects(client.getCampaign(121),error=>{
  assert.match(error.message,/may have expired/i);
  assert.ok(!error.message.includes('never-log-this'));
  return true;
 });
});
