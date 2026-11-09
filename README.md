# Savage Planet Canon Sync

**Foundry VTT v14 Build 369 / GURPS Game Aid v0.18.27.** Savage Planet Canon Sync provides authenticated ChatGPT access to the connected Foundry GM world and a Scabard campaign account. World Anvil is not part of the architecture. Reads are non-mutating; the only write is explicit, confirmed creation of a missing character journal.

## Implemented
Foundry tools: `getActor`, `listActors`, `getSkills`, `getAttacks`, `getEquipment`, `getHitLocations`, and `listJournals`.

Scabard tools: `scabardListCampaigns`, `scabardGetCampaign`, `scabardListPages`, and `scabardGetPage`.

Joined canon tools: `canonListMappings`, `canonGetCharacter`, `canonCompareCharacter`, `canonPlanCharacterJournal`, and `canonCreateCharacterJournal`. These use only confirmed local mappings. The plan tool is read-only and never returns secret text. The create tool requires a separate write scope plus the exact confirmation phrase, creates a GM-only entry only when missing, and never updates or overwrites an existing journal.

There are no actor writes, Scabard writes, macro execution, rolls, scene changes, deletions, or automatic conflict resolution. Journal creation is deduplicated by canonical ID and stores its Scabard and Actor identities in module flags.

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
- Only projected GURPS fields are returned; no raw existing journals, actor flags, permissions or macros are exposed.
- The relay does not intentionally persist campaign data, but connected external clients receive requested actor information. Do not grant player access.
- Use a private deployment with HTTPS/WSS, strong credentials, origin restrictions and careful log handling. Protect secret-bearing settings in the GM's browser.
- Scabard credentials are optional. On Windows, the short-lived access key is stored with per-user DPAPI encryption under `%LOCALAPPDATA%\SavagePlanet\Relay`; it is never committed, placed in a URL, or written to relay logs. The startup script rejects locally expired credentials.
- Browser and server connection have not yet been tested end-to-end against your live Forge world.

## Development
Source: `scripts/actor-operations.mjs`, `scripts/bridge.mjs`, `relay/operations.mjs`, `relay/protocol.mjs`, `relay/server.mjs`, `relay/scabard-client.mjs`, and `relay/tool-router.mjs`.
Tests include MCP tool validation and Belladonna actor extraction. Full WebSocket integration tests require the relay's `ws` dependency installed.

This is unofficial fan-made software, not endorsed by Steve Jackson Games or the GGA authors.

## Production-style relay deployment

A persistent Docker + Caddy TLS reverse-proxy configuration is available in [deploy/](deploy/README.md). The relay must run on an always-on host with DNS and inbound HTTPS; it is **not** deployed by publishing the GitHub repository. Keep the external Foundry bridge disabled until the host, domain, and separate credentials are configured.

## Automated relay validation (November 5, 2026)

The repository now includes `relay/integration.test.mjs` (authenticated MCP and simulated GM WebSocket round-trip) and `.github/workflows/relay-tests.yml` (CI). The test runs an MCP `tools/call` for Belladonna actor ID `Ow9mrwRNhmKZuXbc`, simulates a GM answer, and verifies the structured result. It also checks unauthenticated MCP access and invalid actor ID rejection.

To run these locally, with Node.js 22 or newer:

```bash
cd relay
npm install
npm test
```

**CI status:** GitHub Actions jobs have failed before exposing execution steps, so automated test success has **not** been independently verified. Review the Actions run before treating the relay as production-ready.

**Required server configuration:** Set `BRIDGE_ALLOWED_ORIGINS` to the exact origin of the Forge GM page. The relay now refuses to start if this allowlist is blank, even for local testing. Both `BRIDGE_TOKEN` and `MCP_TOKEN` must be different and 32+ characters. Keep the Foundry module's bridge disabled until a secure relay is running.

## Verify Phase 2 from within Foundry (no relay required)

The GM-only [v0.2 smoke test Script Macro](tests/FOUNDRY_SMOKE_TEST.js) exercises all six read-only operations against Belladonna Marshall (`Ow9mrwRNhmKZuXbc`), validates imported GCS values, and verifies that write operations are refused. Paste the contents into a Foundry **Script** macro and run it with the world loaded as GM. A results dialog and browser console report PASS / FAIL. **This macro makes no external requests and does not enable the bridge.**

A passing local test establishes the Foundry half of the integration. It does not establish that the external Node relay has deployed or that an MCP client can access your live world.

## Windows PC live test (Cloudflare Quick Tunnel)

For a temporary no-VPS setup, follow [Windows Quick Tunnel instructions](deploy/WINDOWS_QUICK_TUNNEL.md). The procedure generates separate secrets, starts the local Node relay, tunnels HTTPS/WSS without opening router ports, connects a Forge GM session, and tests Belladonna through MCP. The Quick Tunnel is public-facing and suitable for short tests only. Disable the Foundry bridge and close the tunnel when finished.

## Phase 2.5 — OAuth preparation (experimental)

The Node relay supports optional `MCP_AUTH_MODE=oauth` with JWT access-token verification (fixed HTTPS issuer and JWKS, resource audience, `gurps:read` plus separate `canon:write` scope, expiration and a single `OAUTH_ALLOWED_SUBJECT` GM identity). The default token mode remains available. See [ChatGPT OAuth setup and limitations](deploy/CHATGPT_OAUTH.md).


## Journal listing (v0.3.1)

`listJournals` returns read-only journal entry IDs, titles and folder IDs from the currently connected Foundry world. It supports `offset` (default 0), `limit` (default 100, maximum 200), a case-insensitive journal-title `query`, and an optional 16-character `folderId`. Responses include `total`, `hasMore`, `nextOffset`, and `world: { id, title }`; page bodies and secret journal contents are not transferred by this tool.

**Multiple worlds:** Install and enable the same adapter in each GURPS world you want to use. The operations use the active Foundry `game` context and do not hard-code any world. **The current relay supports one connected GM world at a time**, so switch worlds by closing the previous GM session before connecting the next one. Journal IDs are scoped to their world; use the returned world identity to avoid confusing similarly named entries across worlds. Concurrent multiworld connections and a `listWorlds` / `worldId` selector require a separate relay-router upgrade and are not available in this release.

## Scabard read connector (v0.4)

The relay can read Scabard campaigns and pages using the official API. It sends the configured username and access key only as HTTPS request headers. Supported concepts are `character`, `place`, `group`, `item`, `event`, `vehicle`, `category`, `attribute`, `note`, and `folder`.

Scabard access keys expire after 24 hours. On the Windows relay host, run `Set-Scabard-Credentials.bat` from the Canon Sync control folder, then restart the relay. See [Scabard setup](deploy/SCABARD_SETUP.md).

The local canon-registry loader reserves stable mappings between canonical IDs, Scabard page identities, and Foundry document identities. It rejects duplicate platform identities.

## Scabard character journals (v0.4.1)

`canonPlanCharacterJournal` checks one confirmed mapping and reports whether a journal would be created, the target folder, and page names without returning secret text. `canonCreateCharacterJournal` creates the missing entry in `Scabard Characters` with Overview, Description, optional Secrets, optional GM Secrets, and optional Image pages. All entries and pages default to GM-only. Overview contains a clickable `@UUID[Actor.…]` link to the mapped Actor. Imported text is HTML-escaped, and existing canonical entries are returned as `exists` or `conflict` rather than modified. An exact normalized-name match without canon flags is also treated as a migration conflict, preventing duplicate journals created before Canon Sync tagging existed.

