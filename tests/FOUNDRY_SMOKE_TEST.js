// Savage Planet AI Adapter v0.2 — GM-only read API smoke test.
// Create a Foundry Script Macro, paste this file, and run as GM.
// No network requests, actor writes, secrets, or external connections.
(async () => {
  const MODULE = 'savage-planet-ai-adapter';
  const ACTOR_ID = 'Ow9mrwRNhmKZuXbc';
  const mod = game.modules.get(MODULE);
  if (!game.user?.isGM) {
    ui.notifications.error('Savage Planet smoke test requires a GM.');
    return;
  }
  if (!mod?.active || typeof mod.api?.executeRead !== 'function') {
    ui.notifications.error('Savage Planet AI Adapter v0.2.0 read API is not available. Verify the module is enabled and reload.');
    return;
  }
  const rows = [];
  const check = (name, condition, detail) =>
    rows.push({name, pass: !!condition, detail: String(detail ?? '')});
  const run = (label, operation, args, inspect) => {
    try {
      const result = mod.api.executeRead(operation, args);
      check(label, inspect(result), 'Operation returned a result');
      return result;
    } catch (error) {
      check(label, false, error?.message ?? error);
      return null;
    }
  };

  const state = mod.api.bridgeStatus?.();
  check('External bridge disabled / safely configured',
    state?.state === 'disabled' || state?.state === 'not-configured' || state?.state === 'connected',
    'State: ' + (state?.state ?? 'unavailable'));

  const actors = run('listActors', 'listActors', {},
    r => Array.isArray(r?.actors) && r.actors.some(a => a.id === ACTOR_ID));
  const character = run('getActor', 'getActor', {actorId: ACTOR_ID},
    r => r?.identity?.name === 'Belladonna Marshall' && r?.identity?.id === ACTOR_ID);
  if (character) {
    for (const [key, expected] of Object.entries({ST:9, DX:11, IQ:14, HT:12, WILL:19, PER:14})) {
      const value = character.attributes?.[key]?.imported;
      check('Belladonna imported ' + key, value === expected, 'Expected '+expected+', found '+value);
    }
  }
  run('getSkills', 'getSkills', {actorId: ACTOR_ID},
    r => Array.isArray(r?.skills) && r.skills.length > 0);
  run('getAttacks', 'getAttacks', {actorId: ACTOR_ID},
    r => Array.isArray(r?.attacks?.melee) && r.attacks.melee.length === 3);
  run('getEquipment', 'getEquipment', {actorId: ACTOR_ID},
    r => Array.isArray(r?.equipment?.carried) && Array.isArray(r?.equipment?.other));
  run('getHitLocations', 'getHitLocations', {actorId: ACTOR_ID},
    r => Array.isArray(r?.hitLocations) && r.hitLocations.length > 0);

  try {
    mod.api.executeRead('updateActor', {actorId:ACTOR_ID});
    check('Write operations are forbidden', false, 'Unexpected updateActor success');
  } catch {
    check('Write operations are forbidden', true, 'Rejected');
  }
  const failed = rows.filter(r => !r.pass);
  const text = [
    'Savage Planet AI Adapter — v0.2 GM API Smoke Test',
    'Actor: ' + ACTOR_ID,
    'Bridge: ' + (state?.state ?? 'unknown'),
    'Checks: ' + (rows.length-failed.length) + '/' + rows.length + ' PASS',
    ...rows.map(r => (r.pass ? 'PASS' : 'FAIL') + ' ' + r.name + ' — ' + r.detail)
  ].join('\n');
  console.group('[Savage Planet AI Adapter] Local smoke test');
  console.log(text);
  console.groupEnd();
  const escaped = text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  new Dialog({
    title: 'Savage Planet AI Adapter — v0.2 Smoke Test',
    content: '<p><strong>'+ (rows.length-failed.length) + '/' + rows.length + ' checks passed</strong>. Details also appear in the browser console (F12).</p><textarea readonly style="width:100%;height:340px">' + escaped + '</textarea>',
    buttons: {close: {label:'Close'}},
    default:'close'
  }).render(true);
  if (failed.length) ui.notifications.warn('Savage Planet smoke test: ' + failed.length + ' failed check(s).');
  else ui.notifications.info('Savage Planet smoke test passed (' + rows.length + ' checks).');
})();
