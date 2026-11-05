# Savage Planet AI Integration

## Savage Planet AI Adapter v0.1.1

GM-only, read-only GURPS Game Aid diagnostics for Foundry v14 Build 369 and GGA 0.18.27.

### The GGA attribute distinction
GGA's actor preparation in `module/actor/actor.js` copies `system.attributes.*.import` into the working `value` before applying item modifiers. The serialized export can retain default `value: 10` while `import` contains the correct GCS value. This **does not prove** the live character uses 10.

v0.1.1 shows:
- **Imported**: GCS-origin value stored under `import`.
- **Stored**: serialized `value` field from `actor.toObject()`.
- **Runtime**: effective value from the prepared live `actor.system`.
- **Source metadata**: current installed GGA, historical document version, and version recorded in the export.

Validation reports **PASS**, **INFO**, **WARN** or **FAIL** separately and does not overwrite character data.

### Installation from manifest
`https://raw.githubusercontent.com/SavageGM/SavagePlanetAIIntegration/main/module.json`

### Usage
Enable the module in Foundry. Run a Script Macro:

```js
game.modules.get("savage-planet-ai-adapter").api.openDiagnostics();
```

### Test
```bash
node tests/test-extraction.mjs "/path/to/Belladonna Marshall.json" "/path/to/Gia Segarra.json"
```

### Important limitations
- This is a local read-only diagnostic module, **not yet** an external MCP or AI chat integration.
- Tests against supplied actor files passed; test the live actor in Foundry after updating.
- Active advantages, temporary effects, and equipment may alter runtime values.
- JSON diagnostic exports may reveal private campaign information; do not publish them.
- The adapter is not affiliated with Steve Jackson Games or the GGA developers.
