const DEFAULT_BASE_URL='https://www.scabard.com/api/v0/';

export class ScabardClient{
 constructor({username,accessKey,baseUrl=DEFAULT_BASE_URL,fetchImpl=globalThis.fetch,timeoutMs=12000}={}){
  this.username=typeof username==='string'?username.trim():'';
  this.accessKey=typeof accessKey==='string'?accessKey.trim():'';
  this.baseUrl=new URL(baseUrl);
  this.fetchImpl=fetchImpl;
  this.timeoutMs=timeoutMs;
  if(this.baseUrl.protocol!=='https:'&&this.baseUrl.hostname!=='127.0.0.1'&&this.baseUrl.hostname!=='localhost')throw new Error('Scabard API base URL must use HTTPS');
 }
 static fromEnv(env=process.env){return new ScabardClient({username:env.SCABARD_USERNAME,accessKey:env.SCABARD_ACCESS_KEY,baseUrl:env.SCABARD_API_BASE_URL??DEFAULT_BASE_URL});}
 get configured(){return this.username.length>0&&this.accessKey.length>0;}
 async request(path){
  if(!this.configured)throw new Error('Scabard access is not configured. Refresh the local Scabard API credential and restart the relay.');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const response=await this.fetchImpl(new URL(path.replace(/^\//,''),this.baseUrl),{method:'GET',headers:{username:this.username,accessKey:this.accessKey,Accept:'application/json','User-Agent':'Savage Planet Canon Sync/0.4'},signal:controller.signal});
   if(!response.ok){
    if(response.status===401)throw new Error('Scabard authentication failed. The access key may have expired; refresh it locally and restart the relay.');
    if(response.status===403)throw new Error('Scabard denied access to that campaign or page.');
    if(response.status===404)throw new Error('Scabard campaign or page was not found.');
    if(response.status===429)throw new Error('Scabard rate limit reached. Wait before trying again.');
    throw new Error(`Scabard API request failed with HTTP ${response.status}.`);
   }
   const contentType=response.headers?.get?.('content-type')??'';
   if(contentType&&!contentType.toLowerCase().includes('application/json'))throw new Error('Scabard returned an unexpected response format.');
   return await response.json();
  }catch(error){
   if(error?.name==='AbortError')throw new Error('Scabard API request timed out.');
   throw error;
  }finally{clearTimeout(timer);}
 }
 listCampaigns(){return this.request('campaign');}
 getCampaign(campaignId){return this.request(`campaign/${campaignId}`);}
 listPages(campaignId,concept){return this.request(`campaign/${campaignId}/${encodeURIComponent(concept)}`);}
 getPage(campaignId,concept,thingId){return this.request(`campaign/${campaignId}/${encodeURIComponent(concept)}/${thingId}`);}
}
