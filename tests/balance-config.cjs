const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {embedBalance,loadBalance}=require('../scripts/build-balance.cjs');
(async()=>{
 const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'balance-config.js'),'utf8'),html=fs.readFileSync(path.join(root,'v0.2.html'),'utf8');
 assert.equal(embedBalance(html,source),html,'committed HTML must be current');assert.equal(embedBalance(embedBalance(html,source),source),html,'idempotent build');
 const original=JSON.parse(JSON.stringify(loadBalance(source))),changed=structuredClone(original);
 changed.player.maxHp=140;changed.player.moveSpeed=200;changed.player.baseStats.attack=3;changed.player.levelUpHeal=13;
 changed.weapons.sword.range=85;changed.weapons.sword.cooldown=.27;changed.weapons.sword.arcDegrees=60;
 changed.monsters.slime.hp=5;changed.monsters.slime.speed=60;changed.monsters.slime.damage=7;changed.monsters.automaton.hp=20;changed.monsters.automaton.speed=110;
 changed.automaton.patterns[0].range=90;changed.automaton.patterns[0].windup=.55;changed.automaton.patterns[0].recovery=.31;changed.automaton.patterns[0].damage=6;
 changed.automaton.projectile.speed=400;changed.automaton.projectile.lifetime=1.5;
 changed.equipment.trainingSword.bonuses.attack=2;changed.progression.xpBase=40;changed.progression.xpPerLevel=20;changed.quests.slimeTraining.requiredKills=4;
 changed.rewards.monsters.slime.currencies.alchemyCoin=11;changed.rewards.monsters.slime.items.slimeMucus=2;changed.rewards.quests.slimeTraining.items.slimeMucus=4;
 const variantSource='globalThis.ALCHEMY_BALANCE = '+JSON.stringify(changed)+';';
 assert.throws(()=>embedBalance(html,variantSource.replace('"maxHp":140','"maxHp":-1')),/Invalid number/);
 assert.throws(()=>embedBalance(html,variantSource.replace('"cooldown":0.27','"cooldown":0')),/positive/);
 const baseline=cp.execFileSync('git',['show','94e6b329d3aa4e82b04174c4f993a7c531c6fd20:v0.2.html'],{cwd:root,encoding:'utf8'});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
  const results={};const errors=[];
  for(const [name,body] of [['before',baseline],['default',html],['changed',embedBalance(html,variantSource)]]){
   const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
   const requests=[];page.on('request',r=>requests.push(r.url()));
   await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
   await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:body.replace('  preload().catch(error=>{',`window.balanceTest={MELEE,MONSTERS,AUTOMATON_PATTERNS,EQUIPMENT,MONSTER_REWARDS,QUEST_REWARDS,calculateStats,calculateAttackDamage,requiredXp,reset,selectRegion,update,attack,newEnemy,rewardDefeat,equipItem,damageAutomaton,updateAutomaton,get state(){return state;}};\n  preload().catch(error=>{`)}));
   await page.goto('http://alchemy.test/');await page.waitForSelector('#region-dialog[open]');await page.locator('#forest-btn').click();
   const snapshot=await page.evaluate(()=>{const g=balanceTest;return {hp:g.state.player.hp,damage:g.calculateAttackDamage(),melee:g.MELEE,monsters:Object.fromEntries(Object.entries(g.MONSTERS).map(([key,m])=>[key,{hp:m.hp,speed:m.speed,damage:m.damage,name:m.name}])),patterns:g.AUTOMATON_PATTERNS,equipment:g.EQUIPMENT,rewards:[g.MONSTER_REWARDS,g.QUEST_REWARDS],xp:g.requiredXp()};});
   // New config includes extra melee metadata; compare every previously present field.
   if(name==='default'){
    for(const [key,value] of Object.entries(results.before.melee))assert.deepEqual(snapshot.melee[key],value,key);
    const comparable=structuredClone(snapshot);comparable.melee=results.before.melee;assert.deepEqual(comparable,results.before,'all default values unchanged');
    assert.equal(await page.evaluate(()=>Object.isFrozen(ALCHEMY_BALANCE.player.baseStats)),true);
   }
   results[name]=snapshot;
   const initial=await page.evaluate(()=>({x:balanceTest.state.player.x,y:balanceTest.state.player.y}));await page.keyboard.down('ArrowRight');await page.evaluate(()=>balanceTest.update(.1));await page.keyboard.up('ArrowRight');
   assert.ok(Math.abs((await page.evaluate(()=>balanceTest.state.player.x))-initial.x-(name==='changed'?20:17.8))<1e-8);
   if(name==='changed'){
    assert.ok(Math.abs(snapshot.melee.minDot-Math.cos(Math.PI/6))<1e-12);assert.equal(snapshot.hp,140);assert.equal(snapshot.damage,3);assert.equal(snapshot.monsters.slime.hp,5);assert.equal(snapshot.monsters.slime.speed,60);assert.equal(snapshot.patterns[0].windup,.55);
    assert.match(await page.locator('#hp-text').innerText(),/140 \/ 140/);assert.match(await page.locator('#quest-progress').innerText(),/0 \/ 4/);
    await page.evaluate(()=>{
     const g=balanceTest,e=g.newEnemy(g.state.player.x+80,g.state.player.y);g.state.enemies=[e];g.attack();if(e.hp!==2||g.state.player.cool!==.27)throw Error('configured range, attack and cooldown not used');
     g.state.player.hp=90;
     for(let i=0;i<4;i++){const dead=g.newEnemy(550,350);dead.hp=0;g.state.enemies.push(dead);g.rewardDefeat(dead);}
     if(g.state.player.hp!==103||g.state.level!==2||g.state.xp!==15)throw Error('configured progression/heal');
     if(g.state.inventory.currencies.alchemyCoin!==64||g.state.inventory.items.slimeMucus!==12)throw Error('configured rewards');
     g.equipItem('trainingSword');if(g.calculateAttackDamage()!==5)throw Error('configured equipment bonus');
    });
    await page.locator('#inventory-btn').click();assert.match(await page.locator('#equipment-content').innerText(),/공격력 5/);assert.match(await page.locator('#equipment-content').innerText(),/피해량 \+2/);await page.locator('#inventory-close').click();
    await page.evaluate(()=>{
     const g=balanceTest;g.selectRegion('training');const e=g.state.enemies[0];if(e.hp!==20)throw Error('configured automaton HP');
     for(let phase=0;phase<4;phase++){e.ai.used[phase]=1;g.damageAutomaton(e,999);if(e.hp!==15-phase*5)throw Error('HP-relative phase threshold');}
     g.selectRegion('training');g.state.evaluation.status='active';g.selectRegion('training');const robot=g.state.enemies[0];robot.ai.timer=0;g.state.player.x=robot.x-50;g.state.player.y=robot.y;g.updateAutomaton(robot,.01);g.updateAutomaton(robot,.56);if(g.state.player.hp!==134)throw Error('configured enemy damage');
     robot.ai.index=2;robot.ai.mode='approach';robot.ai.timer=0;g.updateAutomaton(robot,.01);g.updateAutomaton(robot,.51);const shot=g.state.automatonShots[0];if(Math.abs(Math.hypot(shot.vx,shot.vy)-400)>1e-8||shot.life!==1.5)throw Error('configured projectile');
    });
   }
   assert.deepEqual(requests,['http://alchemy.test/'],'single HTML needs no external config/assets');await page.close();
  }
  const offline=await browser.newPage();await offline.context().setOffline(true);await offline.setContent(html);await offline.waitForSelector('#region-dialog[open]');assert.equal(await offline.evaluate(()=>ALCHEMY_BALANCE.weapons.sword.range),70);await offline.close();
  assert.deepEqual(errors,[]);console.log('PASS unchanged defaults vs 94e6b32; config-only changes affect HP, movement, damage, sword range/cooldown, equipment, progression/heal, quest/rewards, enemy AI and projectile; self-contained HTML; idempotent build/invalid config checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
