import {createRemoteJWKSet,jwtVerify} from 'jose';

// OAuth resource-server mode. An independent OAuth 2.1 provider handles
// authorization code, PKCE, login, consent, token issuance and refresh.
export function createOAuthResource(config) {
 const {issuer,audience,jwksUri,requiredScope='gurps:read'}=config;
 function secureURL(raw,label) {
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) throw new Error(label+' must be a clean HTTPS URL');
  return url;
 }
 const issuerURL=secureURL(issuer,'OAUTH_ISSUER'), resourceURL=secureURL(audience,'OAUTH_AUDIENCE'), keysURL=secureURL(jwksUri,'OAUTH_JWKS_URI');
 if(!issuerURL.pathname.endsWith('/'))throw new Error('OAUTH_ISSUER must be a canonical issuer base URL ending /');
 if(!resourceURL.pathname.endsWith('/mcp'))throw new Error('OAUTH_AUDIENCE must be the public /mcp HTTPS URL');
 if(keysURL.origin!==issuerURL.origin)throw new Error('JWKS endpoint must share the issuer HTTPS origin');
 if(!/^[a-zA-Z][a-zA-Z0-9:._-]{2,80}$/.test(requiredScope))throw new Error('Invalid OAuth scope');
 const normalizedIssuer=issuerURL.href.replace(/\/$/,'');
 const metadataURL=new URL('/.well-known/oauth-protected-resource',resourceURL.origin).href;
 const keys=createRemoteJWKSet(keysURL);
 const metadata=Object.freeze({
  resource:resourceURL.href,
  authorization_servers:[normalizedIssuer],
  scopes_supported:[requiredScope],
  bearer_methods_supported:['header']
 });
 return {
  metadata,metadataURL,requiredScope,
  challenge(){return 'Bearer resource_metadata="'+metadataURL+'", scope="'+requiredScope+'"';},
  async verify(token){
   if(typeof token!=='string'||token.length>8192||!token)return {ok:false,reason:'invalid_token'};
   try {
    const {payload}=await jwtVerify(token,keys,{
     issuer:normalizedIssuer,audience:resourceURL.href,
     algorithms:['RS256','ES256'],clockTolerance:'30 seconds',
     requiredClaims:['sub','exp','iat']
    });
    const scopes=new Set([
     ...(typeof payload.scope==='string'?payload.scope.split(/\s+/):[]),
     ...(Array.isArray(payload.scp)?payload.scp:[])
    ]);
    if(!scopes.has(requiredScope))return {ok:false,reason:'insufficient_scope'};
    return {ok:true,subject:payload.sub};
   }catch{return {ok:false,reason:'invalid_token'};}
  }
 };
}
