# Scabard connector setup

Savage Planet Canon Sync currently uses the Scabard API in read-only mode. It does not create, update, connect, or delete Scabard pages.

## Refresh the Windows credential

1. Sign in to Scabard and open your user profile.
2. Use the profile menu to generate an **API Access Key**.
3. In `SavagePlanet_Relay_Control_Windows`, run `Set-Scabard-Credentials.bat`.
4. Enter the Scabard username and access key when prompted. Key input is hidden.
5. Stop and restart Savage Planet Canon Sync from the control panel.

The access key is protected with Windows DPAPI for the current Windows account. The username, encrypted key, and expiration metadata are stored below `%LOCALAPPDATA%\SavagePlanet\Relay`. Do not copy these files to another account or computer. The relay refuses to load the local credential after its recorded 24-hour lifetime.

## Available MCP tools

- `scabardListCampaigns`
- `scabardGetCampaign`
- `scabardListPages`
- `scabardGetPage`

All campaign and page identifiers are numeric. Page concepts are restricted to the allowlist declared in `relay/operations.mjs`.

## Failure behavior

- Missing credential: Foundry tools remain available; Scabard tools return a configuration error.
- Expired local credential: startup stops and instructs the operator to refresh the key.
- HTTP 401: the tool reports that the key may have expired without logging it.
- HTTP 403, 404, and 429: the tool returns bounded, non-secret diagnostic messages.

Never paste the Scabard access key into ChatGPT, commit it to Git, place it in a URL, or include it in a support log.
