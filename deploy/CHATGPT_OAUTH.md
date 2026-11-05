# Phase 2.5 — OAuth authorization for a ChatGPT MCP connection

**Status: resource-server implementation only.** This project does **not** provide its own authorization server, an OAuth login UI, authorization-code+PKCE flow, client registration, or refresh-token issuance. Supply those through a properly configured OAuth 2.1 identity provider. ChatGPT connection and live OAuth login are **not yet tested**.

The installed Foundry module remains v0.2.0. The Node relay package is v0.2.5, and keeps the working legacy static-token mode as default.

## Design

- Foundry GM ↔ relay WebSocket: uses its existing independent `BRIDGE_TOKEN`.
- External MCP client ↔ relay: choose either `MCP_AUTH_MODE=token` (existing `MCP_TOKEN`) or `MCP_AUTH_MODE=oauth` (signed OAuth access JWTs).
- OAuth mode validates RS256/ES256 JWT signatures against a fixed HTTPS JWKS URI, exact issuer, exact resource audience, expiration and `gurps:read` scope.
- OAuth mode publishes MCP Protected Resource Metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`. A 401 sends `WWW-Authenticate` with `resource_metadata`.
- The OAuth provider—not this Node relay—must support authorization-code+PKCE, client identification/registration (CIMD, DCR or pre-registration), refresh tokens when needed, and public authorization-server metadata.

## Prerequisites

1. Stable public HTTPS/WSS hostname. A random Quick Tunnel cannot serve as a reliable OAuth audience and callback target across restarts.
2. An OAuth/OIDC identity provider with a supported MCP-compatible registration flow. Configure a single GM account; never grant access to arbitrary internet users.
3. Configure the provider to issue **signed JWT access tokens** for the exact MCP resource identifier, with audience equal to the public `https://YOUR_HOST/mcp` URL and a `gurps:read` scope.
4. The provider must publish its issuer metadata, authorization endpoint, token endpoint, PKCE/S256 support, client registration/identity mechanisms, and optional offline/refresh support. This relay does not create that discovery endpoint.
5. The public HTTPS issuer and JWKS origin must match, and JWKS must use trusted certificates.

### Example environment variables

Do not paste actual credentials into documentation or chat. These are examples, not real endpoints:

```powershell
$env:MCP_AUTH_MODE = 'oauth'
$env:OAUTH_ISSUER = 'https://login.example.org/'
$env:OAUTH_AUDIENCE = 'https://mcp.example.org/mcp'
$env:OAUTH_JWKS_URI = 'https://login.example.org/.well-known/jwks.json'
$env:OAUTH_ALLOWED_SUBJECT = 'YOUR_GM_PROVIDER_ACCOUNT_SUBJECT'
$env:OAUTH_REQUIRED_SCOPE = 'gurps:read'
$env:BRIDGE_ALLOWED_ORIGINS = 'https://savagegm-tpm.forge-vtt.com'
$env:HOST = '127.0.0.1'
$env:PORT = '8787'
```

You **still** need to set a fresh 32+ character `BRIDGE_TOKEN` in this process. The independent `MCP_TOKEN` is **not required** in OAuth mode. This change does not affect the Foundry bridge URL, secret or module version.

Set these only when the identity provider is actually configured. Otherwise stay on `MCP_AUTH_MODE=token` (or omit `MCP_AUTH_MODE` entirely), preserving the existing working PowerShell path.

## Verify locally

```powershell
cd "$HOME\SavagePlanetAIIntegration"
git pull
cd relay
npm install
npm test
```

The automated tests cover OAuth metadata, signature verification, audience and scope and single-GM subject restrictions as well as the existing read-only relay and WebSocket tests. No real access tokens are needed for these tests.

When hosted with OAuth mode, verify:

1. GET `https://YOUR_HOST/.well-known/oauth-protected-resource` returns the canonical resource and identity provider.
2. POST `https://YOUR_HOST/mcp` with no Bearer token returns 401 with an OAuth resource metadata challenge.
3. MCP authorization performs OAuth authentication to the **identity provider** and uses a token whose `aud` is the exact MCP HTTPS URL.
4. `tools/list` exposes the six GURPS read-only operations.
5. `getActor` for `Ow9mrwRNhmKZuXbc` returns Belladonna Marshall **only while the GM bridge is connected**.
6. Disable the Foundry bridge and verify it returns a disconnected-tool error.

## ChatGPT setup

Current ChatGPT custom MCP support and permissions depend on account/workspace. On an eligible account, open **Plugins → Add custom MCP server**, enter the public HTTPS `/mcp` URL and follow OAuth linking. Do not try to paste `MCP_TOKEN` in place of OAuth credentials.

Useful documentation:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://developers.openai.com/plugins/build/auth
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

**Security:** OAuth does not eliminate the need to protect the GM browser, rotate the bridge secret after exposure, restrict account access at the issuer, protect the relay host, and keep the read-only bridge disabled outside approved sessions.
