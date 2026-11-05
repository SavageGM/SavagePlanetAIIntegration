# Persistent MCP relay deployment (Docker + Caddy)

This deployment is suitable for an **always-on VPS or other Docker host with inbound ports 80/443**. It cannot be deployed on a serverless runtime that does not support persistent WebSocket connections.

**Before deployment:** Review the relay source and use a dedicated domain (e.g., ai.yourdomain.example). Keep the Foundry bridge disabled until the host is secured.

1. Point your domain's DNS A/AAAA record at the server.
2. Create `relay/.env` based on `relay/.env.example`. Generate two distinct random secrets of at least 32 characters. Do not commit that file or share the secrets in chat.
3. Set `BRIDGE_ALLOWED_ORIGINS` to the exact **origin** of your Forge GM page (obtained from your browser's address bar; no path).
4. From the repository's `deploy/` directory, set `RELAY_DOMAIN` and run `docker compose up -d --build`.
5. Check `docker compose logs --tail=100 relay` and `docker compose logs --tail=100 caddy` for startup or certificate failures. Do not publish the logs if they contain credentials.
6. In Foundry's module settings, enter `wss://YOUR_DOMAIN/bridge` and the **bridge** secret. Enable the read-only bridge.
7. Connect a bearer-token-capable MCP client to `https://YOUR_DOMAIN/mcp` with the **separate MCP** secret. Begin with `tools/list`, then `getActor` for actor ID `Ow9mrwRNhmKZuXbc`.

No credentials should appear in URLs. Caddy handles TLS and forwards WebSocket upgrades automatically.

**Important:** This does not create the VPS, buy a domain, or configure DNS. ChatGPT's custom MCP app may require an OAuth-facing adapter; this relay does not currently provide OAuth.

If the bridge reads `unauthorized`, check the two credentials are different and that Foundry uses the bridge secret. If the bridge reads `reconnecting`, inspect DNS, HTTPS certificates, firewall and the Forge browser console. If the MCP call returns `Foundry GM is not connected`, verify the GM client is open and the bridge status reads `connected`.
