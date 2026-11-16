// Dependency-free inline bundle builder; the rest of the existing HTML is preserved.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const START = '<!-- BALANCE_CONFIG:START -->', END = '<!-- BALANCE_CONFIG:END -->';
function loadBalance(source) {
  const context = {}; vm.runInNewContext(source, context, { timeout: 1000 });
  const balance = context.ALCHEMY_BALANCE;
  if (!balance) throw Error('ALCHEMY_BALANCE was not defined');
  function numericCheck(value, key = 'balance') {
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw Error('Invalid number: ' + key);
    if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) numericCheck(child, key + '.' + name);
  }
  numericCheck(balance);
  for (const [name, value] of Object.entries({ hp: balance.player.maxHp, speed: balance.player.moveSpeed, cooldown: balance.weapons.sword.cooldown, range: balance.weapons.sword.range, minimumDamage: balance.combat.minimumAttackDamage, questKills: balance.quests.slimeTraining.requiredKills, xpBase: balance.progression.xpBase, frameDt: balance.combat.maxFrameDt, protectedHp: balance.automaton.protectedHp })) {
    if (!(value > 0)) throw Error(name + ' must be positive');
  }
  for (const id of ['sword','spear','bow','staff']) {
    const weapon = balance.weapons[id];
    if (!weapon || !['range','cooldown','duration','damageMultiplier'].every(key => Number.isFinite(weapon[key]) && weapon[key] > 0)) throw Error('Invalid player weapon: ' + id);
  }
  if (!(balance.weapons.bow.projectileSpeed > 0 && balance.weapons.bow.projectileRadius > 0 && balance.weapons.staff.blastRadius > 0 && balance.weapons.staff.castDelay > 0)) throw Error('Invalid ranged weapon');
  for (const [id, monster] of Object.entries(balance.monsters)) if (!(monster.hp > 0)) throw Error('Monster HP must be positive: ' + id);
  if (!Number.isInteger(balance.quests.slimeTraining.requiredKills) || !Number.isInteger(balance.progression.initialLevel) || balance.progression.initialLevel < 1) throw Error('Quest kills and initial level must be positive integers');
  if (!(balance.weapons.sword.arcDegrees > 0 && balance.weapons.sword.arcDegrees <= 360)) throw Error('Invalid sword cone');
  if (balance.automaton.patterns.map(p => p.id).join(',') !== 'sword,spear,bow,staff') throw Error('Keep four implemented enemy patterns in order');
  for (const p of balance.automaton.patterns) {
    if (p.id === 'sword' && !(p.arcDegrees > 0 && p.arcDegrees <= 360)) throw Error('Invalid enemy sword cone');
    if (!(p.range > 0 && p.windup > 0 && p.recovery > 0)) throw Error('Invalid pattern: ' + p.id);
    if (p.minDistance !== undefined && !(p.minDistance < p.maxDistance && p.maxDistance < p.range)) throw Error('Invalid spacing: ' + p.id);
  }
  if (!(balance.monsters.automaton.hp >= balance.automaton.patterns.length * balance.automaton.protectedHp)) throw Error('Automaton HP too low for phase protection');
  return balance;
}
function embedBalance(html, source) {
  loadBalance(source);
  if (/<\/script/i.test(source)) throw Error('Config cannot contain a closing script tag');
  const start = html.indexOf(START), end = html.indexOf(END);
  if (start < 0 || end < start || html.indexOf(START, start + START.length) >= 0) throw Error('Expected one balance bundle marker');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const block = `${START}\n<!-- Generated from balance-config.js; SHA-256 ${hash}. Do not edit this block. -->\n<script id="balance-config">\n${source.trimEnd()}\n</script>\n${END}`;
  return html.slice(0, start) + block + html.slice(end + END.length);
}
if (require.main === module) {
  const root = path.join(__dirname, '..'), file = path.join(root, 'v0.2.html');
  const old = fs.readFileSync(file, 'utf8'), next = embedBalance(old, fs.readFileSync(path.join(root, 'balance-config.js'), 'utf8'));
  if (process.argv.includes('--check')) { if (old !== next) { console.error('Stale balance bundle. Run node scripts/build-balance.cjs'); process.exitCode = 1; } else console.log('PASS balance bundle is current'); }
  else { if (old !== next) fs.writeFileSync(file, next); console.log('Built self-contained v0.2.html'); }
}
module.exports = { embedBalance, loadBalance };
