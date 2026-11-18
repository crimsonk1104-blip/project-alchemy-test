/* Single source of numeric game balance. Run: node scripts/build-balance.cjs
 * Units: world pixels, seconds, degrees, HP/damage points. No production/student data.
 * Stat maps can grow later; defense/critical/skill mechanics are NOT implemented.
 */
(function (root) {
  'use strict';
  const balance = {
    player: { maxHp: 100, moveSpeed: 178, radius: 17, baseStats: { attack: 1 }, levelUpHeal: 20 },
    weapons: {
      sword: { range: 70, arcDegrees: 90, duration: .24, cooldown: .39, buffer: .13,
        knockback: 16, knockDuration: .10, hitFlash: .19, damageMultiplier: 1 },
      spear: { range: 155, width: 20, duration: .22, cooldown: .58, buffer: .13, damageMultiplier: 1, knockback: 12, knockDuration: .10, hitFlash: .19 },
      bow: { range: 380, projectileSpeed: 440, projectileRadius: 6, duration: .2, cooldown: .65, buffer: .13, damageMultiplier: 1, aimAssistDegrees: 20, knockback: 5, knockDuration: .08, hitFlash: .15 },
      staff: { range: 240, minRange: 45, maxChargeTime: .7, tapGrace: .08, blastRadius: 48, castDelay: .35, effectDuration: .22, duration: .25, cooldown: .9, buffer: .13, damageMultiplier: 2, knockback: 6, knockDuration: .08, hitFlash: .19 }
    },
    monsters: {
      slime: { name: '슬라임', hp: 3, speed: 42, damage: 9, radius: 19, collisionRadius: 16,
        aggroRange: 350, stopDistance: 35, contactRange: 38, damageInvulnerability: .95 },
      automaton: { name: '훈련용 자동인형', hp: 12, speed: 124.6, radius: 19, collisionRadius: 16 }
    },
    automaton: {
      initialDelay: .4, transitionDelay: .25, approachRatio: .85, strafeRatio: .45,
      damageInvulnerability: .7, effectDuration: .22, protectedHp: 1,
      projectile: { speed: 310, lifetime: 2 },
      patterns: [
        { id: 'sword', range: 70, width: 0, arcDegrees: 90, windup: .42, recovery: .22, damage: 4 },
        { id: 'spear', range: 210, width: 28, windup: .42, recovery: .28, damage: 5 },
        { id: 'bow', range: 620, width: 8, windup: .5, recovery: .28, minDistance: 170, maxDistance: 270, damage: 4 },
        { id: 'staff', range: 620, width: 66, windup: .8, recovery: .35, minDistance: 145, maxDistance: 230, damage: 6 }
      ]
    },
    equipment: { starterSword: { bonuses: { attack: 0 } }, starterSpear: { bonuses: { attack: 0 } }, starterBow: { bonuses: { attack: 0 } }, starterStaff: { bonuses: { attack: 0 } } },
    progression: { initialLevel: 1, xpBase: 30, xpPerLevel: 15 },
    quests: { slimeTraining: { requiredKills: 3 } },
    rewards: {
      monsters: { slime: { xp: 10, currencies: { alchemyCoin: 5 }, items: { slimeMucus: 1 } } },
      quests: { slimeTraining: { xp: 15, currencies: { alchemyCoin: 20 }, items: { slimeMucus: 2, upgradeStone: 1 } } }
    },
    spawning: { forestTargetCount: 2, initialDelay: 2.5, repeatDelay: 2.6, attempts: 100, distanceMin: 155, distanceMax: 340, minPlayerDistance: 150, minEnemyDistance: 80, clearanceRadius: 21 },
    combat: { minimumAttackDamage: 1, maxFrameDt: .04 }
  };
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  root.ALCHEMY_BALANCE = freeze(balance);
})(globalThis);
