# Savage Planet AI Integration — v0.2.0

**Foundry VTT v14 Build 369 / GURPS Game Aid v0.18.27.** The module retains the GM-only read-only GGA diagnostic panel and adds an opt-in outbound connection to an external MCP relay.

## Implemented
Six read-only tools: `getActor`, `listActors`, `getSkills`, `getAttacks`, `getEquipment`, `getHitLocations`. Read-only is enforced on both sides. No actor writes, macro execution, rolls, or scene changes.

The GM browser connects outbound by WebSocket to a separate Node.js relay. The relay authenticates MCP clients and forwards only validated requests. This GitHub repository provides **source code**, not a hosted service. The relay must be deployed separately for live external access.

## Foundry installation
Use the Forge / Foundry manifest URL:
`https://raw.githubusercontent.com/SavageGM/SavagePlanetAIIntegration/main/module.json`

To open the diagnostic panel, run a GM Script Macro:
```js
game.modules.get('savage-planet-ai-adapter').api.openDiagnostics();
```

Local operation test in the GM browser console:
```js
game.modules.get('savage-planet-ai-adapter').api.executeRead('getActor', {actorId:'Ow9mrwRNhmKZuXbc'});
```
Belladonna Marshall's reference attributes: ST 9, DX 11, IQ 14, HT 12, Will 19, Per 14.

## External relay setup
1. Install Node.js 20+ on a server you control. From `relay/`, run `npm install`.
2. Generate **two distinct** 32+ character secrets (e.g. `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` twice). Set environment variables `BRIDGE_TOKEN` and `MCP_TOKEN` on the server. Never commit or share these tokens.
3. Run `npm start` in `relay/`. By default it binds to `127.0.0.1:8787`.
4. Configure an HTTPS reverse proxy (TLS) with WebSocket upgrade support for `/bridge` and ordinary HTTP POST forwarding for `/mcp`. Public Forge HTTPS pages cannot connect to insecure `ws://` endpoints. Set `BRIDGE_ALLOWED_ORIGINS` to the exact GM Foundry browser origin.
5. In Foundry, as GM, open **Game Settings → Configure Settings → Module Settings → Savage Planet AI Adapter**. Set Bridge URL to `wss://YOUR_DOMAIN/bridge`, set Bridge secret to `BRIDGE_TOKEN`, and enable the external bridge. Keep the GM session running. Check status by reopening the diagnostic panel.
6. Connect an MCP client to `https://YOUR_DOMAIN/mcp` with `Authorization: Bearer <MCP_TOKEN>`. Supports stateless MCP HTTP JSON-RPC `initialize`, `ping`, `tools/list`, and `tools/call`. The external client must support bearer-authenticated custom MCP.

**ChatGPT limitation:** ChatGPT's custom connector experience may require OAuth instead of a manually supplied bearer token, depending on plan/workspace. An OAuth front end is not provided in v0.2, so **direct ChatGPT connection is not yet confirmed**. Test the relay first with a compatible MCP client. The in-Foundry AI chat is planned for v0.3.

## Security
- Disabled by default, GM-only, outbound WebSocket; Foundry runs no server.
- Separate bridge and MCP secrets, validated tool allowlist, strict actor IDs and argument schemas, max 16 concurrent calls, 12-second request timeout.
- Only projected GURPS fields returned; no raw journals, actor flags, permissions or macros exposed.
- The relay does not intentionally persist campaign data, but connected external clients receive requested actor information. Do not grant player access.
- Use a private deployment with HTTPS/WSS, strong credentials, origin restrictions and careful log handling. Protect secret-bearing settings in the GM's browser.
- Browser and server connection have not yet been tested end-to-end against your live Forge world.

## Development
Source: `scripts/actor-operations.mjs`, `scripts/bridge.mjs`, `relay/operations.mjs`, `relay/protocol.mjs`, `relay/server.mjs`.
Tests include MCP tool validation and Belladonna actor extraction. Full WebSocket integration tests require the relay's `ws` dependency installed.

This is unofficial fan-made software, not endorsed by Steve Jackson Games or the GGA authors.
