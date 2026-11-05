// Run as GM in a Foundry VTT Script Macro.
const api = game.modules.get('savage-planet-ai-adapter')?.api;
if (api?.openDiagnostics) api.openDiagnostics();
else ui.notifications.warn('Savage Planet AI Adapter is not ready or is not enabled.');
