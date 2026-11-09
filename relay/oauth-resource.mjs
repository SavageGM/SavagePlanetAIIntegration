import {createRemoteJWKSet,jwtVerify} from 'jose';

// OAuth resource-server mode. An independent OAuth 2.1 provider handles
// authorization code, PKCE, login, consent, token issuance and refresh.
export function createOAuthResource(config,{keyResolver=null}={}) {
 const {issuer,audience,jwksUri,allowedSubject,requiredScope='gurps:read',writeScope='canon:write'}=config;
 if(typeof allowedSubject!=='string'||!allowedSubject.trim()||allowedSubject.length>256)throw new Error('OAUTH_ALLOWED_SUBJECT must identify the single GM identity');
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
 if(!/^[a-zA-Z][a-zA-Z0-9:._-]{2,80}$/.test(writeScope)||writeScope===requiredScope)throw new Error('Invalid OAuth write scope');
 const normalizedIssuer=issuerURL.href.replace(/\/$/,'');
 const metadataURL=new URL('/.well-known/oauth-protected-resource',resourceURL.origin).href;
 const keys=keyResolver??createRemoteJWKSet(keysURL);
 const metadata=Object.freeze({
  resource:resourceURL.href,
  authorization_servers:[normalizedIssuer],
  scopes_supported:[requiredScope,writeScope],
  bearer_methods_supported:['header']
 });
 return {
  metadata,metadataURL,requiredScope,writeScope,
  challenge(scope=requiredScope){return 'Bearer resource_metadata="'+metadataURL+'", scope="'+scope+'"';},
  async verify(token){
   if(typeof token!=='string'||token.length>8192||!token)return {ok:false,reason:'invalid_token',diagnostic:'missing_or_malformed_bearer'};
   try {
    const {payload}=await jwtVerify(token,keys,{
     issuer:issuerURL.href,audience:resourceURL.href,
     algorithms:['RS256','ES256'],clockTolerance:'30 seconds',
     requiredClaims:['sub','exp','iat']
    });
    const scopes=new Set([
     ...(typeof payload.scope==='string'?payload.scope.split(/\s+/):[]),
     ...(Array.isArray(payload.scp)?payload.scp:[])
    ]);
    if(!scopes.has(requiredScope))return {ok:false,reason:'insufficient_scope'};
    if(payload.sub!==allowedSubject)return {ok:false,reason:'invalid_token',diagnostic:'subject_mismatch'};
    return {ok:true,subject:payload.sub,scopes};
   }catch(e){
    const code=typeof e?.code==='string'&&/^ERR_[A-Z_]+$/.test(e.code)?e.code:'verification_error';
    const claim=['iss','aud','exp','nbf','iat','sub'].includes(e?.claim)?e.claim:null;
    return {ok:false,reason:'invalid_token',diagnostic:claim?code+':'+claim:code};
   }
  }
 };
}
