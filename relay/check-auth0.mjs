import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
// Read-only Auth0 configuration diagnostic. Does not exchange tokens or change a tenant.
// Use a dedicated Auth0 tenant. Never provide client secrets to this script.
export function inspectAuth0Discovery(discovery,{issuer,audience}={}){
 const findings=[];
 const check=(id,pass,message)=>findings.push({id,pass:Boolean(pass),message});
 let base;
 try{base=new URL(issuer);}
 catch{throw new Error('AUTH0_ISSUER must be a valid HTTPS issuer URL');}
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('AUTH0_ISSUER must be HTTPS without credentials');
 let resource;
 try{resource=new URL(audience);}
 catch{throw new Error('OAUTH_AUDIENCE must be your public HTTPS /mcp URL');}
 if(resource.protocol!=='https:'||!resource.pathname.endsWith('/mcp'))throw new Error('OAUTH_AUDIENCE must be an HTTPS URL ending /mcp');
 const normal=u=>typeof u==='string'?u.replace(/\/$/,''):null;
 check('issuer',normal(discovery.issuer)===normal(base.href),'Issuer must match AUTH0_ISSUER exactly');
 for(const field of ['authorization_endpoint','token_endpoint','jwks_uri']){
  let ok=false;try{const u=new URL(discovery[field]);ok=u.protocol==='https:'&&u.origin===base.origin;}catch{}
  check(field,ok,field+' must be an HTTPS endpoint on your Auth0 tenant');
 }
 check('pkce_s256',Array.isArray(discovery.code_challenge_methods_supported)&&discovery.code_challenge_methods_supported.includes('S256'),'Metadata must advertise PKCE S256');
 check('authorization_code',Array.isArray(discovery.grant_types_supported)&&discovery.grant_types_supported.includes('authorization_code'),'Authorization code flow must be supported');
 check('client_registration',Boolean(discovery.registration_endpoint||discovery.client_id_metadata_document_supported),'Configure DCR or verified CIMD for ChatGPT');
 check('jwt_alg',Array.isArray(discovery.id_token_signing_alg_values_supported)&&discovery.id_token_signing_alg_values_supported.includes('RS256'),'Provider metadata should advertise RS256');
 return {issuer:normal(base.href),audience:resource.href,findings,passed:findings.every(x=>x.pass)};
}
export async function fetchAuth0Discovery(issuer,fetcher=fetch){
 const base=new URL(issuer);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('AUTH0_ISSUER must be a root HTTPS tenant issuer ending /');
 const url=new URL('/.well-known/openid-configuration',base);
 const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Auth0 discovery failed: HTTP '+response.status);
 return response.json();
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1].replaceAll('\\','/')).href){
 const issuer=process.env.OAUTH_ISSUER;
 const audience=process.env.OAUTH_AUDIENCE;
 if(!issuer||!audience){console.error('Set OAUTH_ISSUER and OAUTH_AUDIENCE first. Do not provide credentials.');process.exitCode=2;}
 else{
  try{
   const metadata=await fetchAuth0Discovery(issuer);
   const result=inspectAuth0Discovery(metadata,{issuer,audience});
   for(const item of result.findings)console.log((item.pass?'PASS':'CHECK')+' '+item.id+': '+item.message);
   console.log('Authorization server issuer:',result.issuer);
   console.log('Expected MCP audience:',result.audience);
   console.log('Dashboard-only checks: dedicated tenant; API identifier matches audience; gurps:read permission; Resource Parameter Compatibility Profile; DCR or CIMD enabled; single GM account allowed.');
   if(!result.passed)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1;}
 }
}
