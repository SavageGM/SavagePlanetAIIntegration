import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {createOAuthResource} from './oauth-resource.mjs';

const issuer='https://login.example.test';
const audience='https://mcp.example.test/mcp';
const jwksUri='https://login.example.test/.well-known/jwks.json';
const allowedSubject='single-gm';

test('OAuth metadata and RS256 validation, scope and audience', async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{extractable:true});
 const publicJwk=await exportJWK(publicKey);
 publicJwk.kid='test-kid';publicJwk.alg='RS256';publicJwk.use='sig';
 const keyResolver=createLocalJWKSet({keys:[publicJwk]});
 const auth=createOAuthResource({issuer:issuer+'/',audience,jwksUri,allowedSubject,requiredScope:'gurps:read'},{keyResolver});
 assert.equal(auth.metadata.resource,audience);
 assert.deepEqual(auth.metadata.authorization_servers,[issuer]);
 assert.equal(auth.metadataURL,'https://mcp.example.test/.well-known/oauth-protected-resource');
 assert.match(auth.challenge(),/resource_metadata=/);
 const sign=(claims={})=>new SignJWT({scope:'gurps:read',...claims})
  .setProtectedHeader({alg:'RS256',kid:'test-kid'})
  .setIssuer(issuer).setAudience(audience).setSubject('single-gm')
  .setIssuedAt().setExpirationTime('5m').sign(privateKey);
 assert.deepEqual(await auth.verify(await sign()),{ok:true,subject:'single-gm'});
 assert.equal((await auth.verify(await sign({scope:'other:read'}))).reason,'insufficient_scope');
 const wrongAud=await new SignJWT({scope:'gurps:read'}).setProtectedHeader({alg:'RS256',kid:'test-kid'})
  .setIssuer(issuer).setAudience('https://another.example/mcp').setSubject('single-gm')
  .setIssuedAt().setExpirationTime('5m').sign(privateKey);
 assert.equal((await auth.verify(wrongAud)).reason,'invalid_token');
 assert.equal((await auth.verify('not-a-jwt')).reason,'invalid_token');
 const other=await new SignJWT({scope:'gurps:read'}).setProtectedHeader({alg:'RS256',kid:'test-kid'}).setIssuer(issuer).setAudience(audience).setSubject('not-gm').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 assert.equal((await auth.verify(other)).reason,'invalid_token');
});
test('OAuth mode rejects insecure or malformed resource settings',()=>{
 const defaults={issuer:issuer+'/',audience,jwksUri,allowedSubject};
 assert.throws(()=>createOAuthResource({...defaults,audience:'http://mcp.example.test/mcp'}),/HTTPS/);
 assert.throws(()=>createOAuthResource({...defaults,jwksUri:'https://untrusted.example/keys'}),/issuer HTTPS origin/);
 assert.throws(()=>createOAuthResource({...defaults,audience:'https://mcp.example.test/other'}),/public \/mcp/);
});
