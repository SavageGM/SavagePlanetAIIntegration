import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectAuth0Discovery,fetchAuth0Discovery} from './check-auth0.mjs';
const issuer='https://savage-planet-demo.us.auth0.com/';
const audience='https://mcp.example.org/mcp';
const discovery={
 issuer:issuer.slice(0,-1),
 authorization_endpoint:issuer+'authorize',
 token_endpoint:issuer+'oauth/token',
 jwks_uri:issuer+'.well-known/jwks.json',
 grant_types_supported:['authorization_code','refresh_token'],
 code_challenge_methods_supported:['S256'],
 registration_endpoint:issuer+'oidc/register',
 id_token_signing_alg_values_supported:['RS256']
};
test('Auth0 discovery preflight accepts PKCE DCR tenant and exact issuer',()=>{
 const result=inspectAuth0Discovery(discovery,{issuer,audience});
 assert.equal(result.passed,true,JSON.stringify(result.findings));
 assert.equal(result.audience,audience);
});
test('Auth0 discovery rejects incompatible PKCE and missing client registration',()=>{
 const result=inspectAuth0Discovery({...discovery,code_challenge_methods_supported:['plain'],registration_endpoint:undefined},{issuer,audience});
 assert.equal(result.passed,false);
 assert.equal(result.findings.find(f=>f.id==='pkce_s256').pass,false);
 assert.equal(result.findings.find(f=>f.id==='client_registration').pass,false);
});
test('discovery fetch uses tenant HTTPS origin only',async()=>{
 let actual;
 const fetched=await fetchAuth0Discovery(issuer,async url=>{actual=url.href;return {ok:true,json:async()=>discovery};});
 assert.equal(actual,issuer+'.well-known/openid-configuration');
 assert.equal(fetched.issuer,discovery.issuer);
 await assert.rejects(()=>fetchAuth0Discovery('http://evil.example/'),/HTTPS/);
});
