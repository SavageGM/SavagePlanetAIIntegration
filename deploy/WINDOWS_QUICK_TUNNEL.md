# Windows PC + Cloudflare Quick Tunnel: first live Foundry test

This is a **temporary development test**, not permanent hosting. It does not require a VPS, a Cloudflare account, a custom domain, or router port forwarding. Both local PowerShell windows must stay running. Cloudflare assigns a different URL on every restart. The public URL exposes the relay endpoint to the Internet; the relay's two independent random bearer secrets are the access controls.

Requirements: Node.js 22+, Git, Savage Planet AI Adapter v0.2.0 in Foundry, `npm install` completed in `relay`, and Windows PowerShell.

## 1. Determine your actual Foundry GM origin

Open the Forge world as GM. In your browser developer console, enter:

```js
location.origin
```

Copy only the HTTPS origin, for example `https://example.forge-vtt.com` (not the URL's full path). Do not use the example literally.

## 2. PowerShell window A: start the relay

```powershell
cd "$HOME\SavagePlanetAIIntegration"
git pull
cd relay
npm install
$env:BRIDGE_ALLOWED_ORIGINS = 'PASTE_YOUR_ACTUAL_FORGE_ORIGIN'
$env:HOST = '127.0.0.1'
$env:PORT = '8787'
$bytes1 = New-Object byte[] 32
$bytes2 = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes1)
$rng.GetBytes($bytes2)
$rng.Dispose()
$env:BRIDGE_TOKEN = [BitConverter]::ToString($bytes1).Replace('-','').ToLowerInvariant()
$env:MCP_TOKEN = [BitConverter]::ToString($bytes2).Replace('-','').ToLowerInvariant()
Write-Host 'BRIDGE_TOKEN for Foundry settings (keep private):' $env:BRIDGE_TOKEN
Write-Host 'MCP_TOKEN for client authentication (keep private):' $env:MCP_TOKEN
npm start
```

Do not copy credentials into chat, public issue reports, scripts committed to Git, or URLs. The secrets remain in this PowerShell process environment, but are displayed once so you can use them during the test. Clear your terminal scrollback afterwards.

Expected console: `Savage Planet MCP relay listening 127.0.0.1:8787`. If it exits with `Set BRIDGE_ALLOWED_ORIGINS`, paste your exact Forge origin before starting. If `npm start` silently exits, `git pull` again; the Windows startup-path fix was committed November 5, 2026.

## 3. PowerShell window B: install cloudflared, start Quick Tunnel

Install [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) if needed, then open a new PowerShell window:

```powershell
winget install -e --id Cloudflare.cloudflared
```

After installation, reopen PowerShell and check `cloudflared --version`. Then:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

Copy the **random** `https://...trycloudflare.com` URL printed in window B. This endpoint is reachable by anyone with the URL, but the relay requires valid authentication for MCP calls and the allowed browser origin plus bridge secret for Foundry. Do not add interactive email-login to this test tunnel: it prevents automated MCP clients from authenticating normally.

## 4. In Foundry, enable the bridge temporarily

In the GM client's **Game Settings → Configure Settings → Module Settings → Savage Planet AI Adapter**:

- Bridge URL: change the `https://` URL to `wss://` and append `/bridge`, for example `wss://example.trycloudflare.com/bridge`.
- Bridge secret: use the `BRIDGE_TOKEN` displayed in PowerShell window A.
- Enable the external canon bridge. Then reopen the diagnostics panel.

Expected status: `External bridge: connected`. Do **not** use your `MCP_TOKEN` as the bridge secret.

## 5. Test the MCP request

In another PowerShell window (C), enter this sample, substituting your tunnel URL (without `/bridge`):

```powershell
$base = 'https://YOUR_RANDOM_SUBDOMAIN.trycloudflare.com'
$token = Read-Host 'Enter MCP_TOKEN (input is visible locally)'
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$body = @{ jsonrpc = '2.0'; id = 1; method = 'tools/call'; params = @{ name = 'getActor'; arguments = @{ actorId = 'Ow9mrwRNhmKZuXbc' } } } | ConvertTo-Json -Depth 8
$result = Invoke-RestMethod -Uri "$base/mcp" -Method Post -Headers $headers -Body $body
$result.result.structuredContent.identity
$result.result.structuredContent.attributes.ST
```

Expected actor: `Belladonna Marshall`; ST imported/displayed `9`. This reads actor data and does not modify the Foundry world. Do **not** post full MCP responses publicly: they may contain campaign information.

## 6. Finish safely

Disable the bridge in Foundry's module settings, then use Ctrl+C in windows B (cloudflared) and A (relay). The Quick Tunnel URL stops working when the tunnel closes. Restarting the relay with new secrets requires updating Foundry settings.

If the bridge says `unauthorized`, verify the origin and BRIDGE_TOKEN. If `reconnecting`, verify cloudflared and the relay are both running and that the URL starts with `wss://`. If the MCP call returns `Foundry GM is not connected`, ensure your GM browser remains open and displays `connected`.

## Limitations

Cloudflare Quick Tunnels are intended for testing and have no uptime guarantee. They do not support SSE, but this project uses stateless HTTP JSON-RPC POST for MCP calls and WebSockets for the Foundry GM connection. A permanent solution should use a named, access-controlled tunnel or a dedicated always-on relay host and an OAuth layer if the selected AI client requires it.
