# Savage Planet AI Integration

## Savage Planet AI Adapter v0.1.0

Read-only GM diagnostics module for **Foundry VTT v14 Stable 11 (Build 369)** with **GURPS Game Aid 0.18.27**.

### Capabilities
- Inspect actor attributes, HP, FP, defenses, advantages, disadvantages, skills, attacks, equipment, and hit-location DR.
- Export a reduced diagnostic JSON document.
- Display validation warnings for potentially stale or ambiguous imported data.

**Not yet implemented:** MCP, external ChatGPT access, in-Foundry AI chat, GURPS actions, character writes, Scabard synchronization.

### Installation
1. Back up the Foundry world.
2. Put the contents of this repository in `Data/modules/savage-planet-ai-adapter/` (with `module.json` at the root).
3. Restart Foundry; enable the module in a GURPS world.
4. Create a **Script Macro** using `OPEN_DIAGNOSTICS_MACRO.js`, then execute it as GM.

### JavaScript API

```js
const api = game.modules.get('savage-planet-ai-adapter').api;
api.openDiagnostics();
const diagnostic = api.getActorDiagnostic('ACTOR_ID');
```

### Regression test

```bash
node tests/test-extraction.mjs /path/to/GGA-export.json
```

The test checks Gia Segarra reference actor values. Do not commit character exports containing private campaign information to a public repository.

### Security
v0.1 is local, GM-facing and read-only. Exported JSON is **not anonymized**. No external endpoint is enabled.

### License
Original Savage Planet adapter code is MIT licensed. Not affiliated with Steve Jackson Games or GGA.
