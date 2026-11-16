const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8'),errors=[];
 const instrument=html.replace('  preload().catch(error=>{',`window.weaponTest={images,prepareEvaluationReport,selectRegion,selectTrialWeapon,update,updatePlayerAttacks,beginStaffAim,updateStaffAim,finishStaffAim,attack:()=>{if(state.activeWeapon==='staff'){if(beginStaffAim('fixture')){updateStaffAim(B.weapons.staff.tapGrace+(B.weapons.staff.maxChargeTime-B.weapons.staff.tapGrace)*(150-B.weapons.staff.minRange)/(B.weapons.staff.range-B.weapons.staff.minRange));finishStaffAim('fixture');}}else attack();},newEnemy,draw,reset,equipItem,unequipItem,calculateAttackDamage,assistedDirection,get state(){return state;}};\n  preload().catch(error=>{`);
 const p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.requestAnimationFrame=()=>0);await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await p.goto('http://alchemy.test/');await p.waitForSelector('#region-dialog[open]');
 const results=await p.evaluate(()=>{
  const g=weaponTest,check=(v,m)=>{if(!v)throw Error(m);},result=[];
  function setup(weapon,area='forest'){g.reset('lobby');if(weapon!=='sword')g.selectTrialWeapon(weapon);g.selectRegion(area);}
  for(const weapon of ['sword','spear','bow','staff']){
   for(const type of ['slime','automaton']){
    setup(weapon,type==='slime'?'forest':'training');const player=g.state.player,d=weapon==='sword'?50:weapon==='spear'?120:180;
    const e=g.newEnemy(player.x+d,player.y,type);g.state.enemies=[e];const before=e.hp;
    g.attack();if(weapon==='bow'||weapon==='staff')check(e.hp===before,'ranged damage is not instantaneous');
    for(let i=0;i<30;i++)g.updatePlayerAttacks(.02);
    const expected=weapon==='staff'?2:1;check(e.hp===before-expected,'actual '+weapon+' hits '+type);if(weapon!=='sword'){
     const ctx=document.querySelector('#game').getContext('2d'),original=ctx.drawImage;let wrong=false;
     ctx.drawImage=function(...args){if(args[0]===g.images.knightAttack||args[0]===g.images.slash)wrong=true;return original.apply(this,args);};g.draw();ctx.drawImage=original;check(!wrong,'no sword animation masquerading as '+weapon);
    }
    result.push({weapon,type,damage:expected});
   }
   // Full forest quest using real attack/collision updates, then equip only from its reward.
   setup(weapon);
   for(let kill=0;kill<3;kill++){
    const e=g.newEnemy(530,342);g.state.enemies=[e];
    for(let frame=0;frame<400&&e.hp>0;frame++){
     g.state.player.invuln=1000;
     if(g.state.player.cool<=0){e.x=g.state.player.x+(weapon==='sword'?50:weapon==='spear'?100:150);e.y=g.state.player.y;g.attack();}
     g.update(.04);
    }
    check(e.hp<=0,'forest kill '+weapon);
   }
   check(g.state.questDone&&g.state.kills===3&&g.state.inventory.equipment.trainingSword===1&&g.state.inventory.currencies.alchemyCoin===35&&g.state.inventory.items.slimeMucus===5,'unchanged quest rewards');
   g.equipItem('trainingSword');check(g.calculateAttackDamage()===(weapon==='sword'?2:weapon==='staff'?2:1),'only sword receives equipment bonus');
   for(let i=0;i<5;i++)g.equipItem('trainingSword');check(g.calculateAttackDamage()===(weapon==='sword'?2:weapon==='staff'?2:1),'no duplicate bonus');
   // Full evaluation: phase guard must still require all four enemy attacks.
   g.selectRegion('training');const e=g.state.enemies[0];
   for(let frame=0;frame<1600&&g.state.evaluation.status==='active';frame++){
    g.state.player.invuln=1000;
    if(g.state.player.cool<=0&&e.ai.used[e.ai.index]>0){e.x=g.state.player.x+(weapon==='sword'?50:weapon==='spear'?100:150);e.y=g.state.player.y;g.attack();}
    g.update(.04);
   }
   check(g.state.evaluation.status==='objectiveMet'&&e.ai.used.every(n=>n>=1),'full evaluation '+weapon+' '+JSON.stringify({hp:e.hp,ai:e.ai,status:g.state.evaluation.status,shots:g.state.playerShots,aim:g.state.player.aim}));check(g.state.kills===3&&g.state.inventory.equipment.trainingSword===1,'evaluation reward isolation');check(g.prepareEvaluationReport()&&g.state.evaluation.status==='awaitingReport'&&g.state.area==='lobby','report pending '+weapon);
  }
  setup('sword');let e=g.newEnemy(g.state.player.x+110,g.state.player.y);g.state.enemies=[e];g.attack();check(e.hp===3,'sword misses at 110');
  setup('spear');e=g.newEnemy(g.state.player.x+110,g.state.player.y);g.state.enemies=[e];g.attack();check(e.hp===2,'spear longer');
  setup('spear');e=g.newEnemy(g.state.player.x+110,g.state.player.y+45);g.state.enemies=[e];g.attack();check(e.hp===3,'spear narrow');
  setup('bow');const near=g.newEnemy(g.state.player.x+70,g.state.player.y),far=g.newEnemy(g.state.player.x+140,g.state.player.y);g.state.enemies=[far,near];g.attack();g.updatePlayerAttacks(.4);check(near.hp===2&&far.hp===3,'swept earliest arrow collision');g.updatePlayerAttacks(1);check(near.hp===2,'arrow hits once');
  setup('bow');e=g.newEnemy(g.state.player.x-150,g.state.player.y);g.state.enemies=[e];g.attack();g.updatePlayerAttacks(2);check(e.hp===3&&g.state.playerShots.length===0,'no rear aim, finite range');
  setup('bow');e=g.newEnemy(g.state.player.x+150,g.state.player.y+40);g.state.enemies=[e];g.attack();check(g.state.player.strike.direction.y>0&&g.state.player.aim.y===0,'limited assist preserves manual aim');g.state.player.cool=0;e.y=g.state.player.y+100;g.attack();check(g.state.player.strike.direction.y===0,'assist cannot drift beyond manual cone');
  setup('staff');e=g.newEnemy(g.state.player.x+150,g.state.player.y);g.state.enemies=[e];g.attack();g.updatePlayerAttacks(.1);check(e.hp===3,'spell delay');g.updatePlayerAttacks(.3);check(e.hp===1,'spell burst');g.updatePlayerAttacks(.2);check(e.hp===1,'spell no repeated damage');
  setup('staff');const a=g.newEnemy(g.state.player.x+150,g.state.player.y),b=g.newEnemy(g.state.player.x+160,g.state.player.y+20);g.state.enemies=[a,b];g.attack();g.updatePlayerAttacks(.36);check(a.hp===1&&b.hp===1,'magic area damages multiple targets once');
  setup('staff');e=g.newEnemy(g.state.player.x+150,g.state.player.y);g.state.enemies=[e];g.attack();e.y+=150;g.updatePlayerAttacks(.36);check(e.hp===3,'spell target locked, dodgeable');
  setup('bow');e=g.newEnemy(g.state.player.x+150,g.state.player.y+40);g.state.enemies=[e];g.attack();check(g.state.player.strike.direction.y>0&&g.state.player.aim.y===0,'limited assist does not overwrite manual intent');
  g.selectRegion('lobby');g.state.inventory.equipment.trainingSword=1;g.equipItem('trainingSword');g.selectTrialWeapon('bow');g.selectTrialWeapon('staff');g.selectTrialWeapon('sword');check(g.calculateAttackDamage()===2&&g.state.inventory.equipment.trainingSword===1,'trial return preserves real sword');
  g.selectRegion('forest');check(!g.selectTrialWeapon('bow'),'lobby-only switch');g.selectRegion('lobby');g.selectTrialWeapon('bow');g.state.player.cool=0;g.attack();check(g.state.playerShots.length===1,'arrow spawned');g.selectTrialWeapon('staff');g.attack();check(g.state.playerShots.length===0&&g.state.playerMagic.length===0&&g.state.player.cool>=.9,'switch cancels pending attacks and preserves cooldown');
  g.reset();check(g.state.activeWeapon==='sword'&&g.calculateAttackDamage()===1&&Object.keys(g.state.inventory.equipment).length===0,'reset');return result;
 });console.log('PASS four weapons vs both enemy types, full forest and evaluation quests, ranges, swept arrow, magic, ownership and switching:',results);
 // Native PC/touch events share attack direction and limited assist; mobile modal and multitouch.
 for(const viewport of [{width:360,height:640},{width:844,height:390},{width:820,height:1180}]){
  const ctx=await b.newContext({viewport,isMobile:true,hasTouch:true});const q=await ctx.newPage();q.on('pageerror',e=>errors.push(e.message));await q.addInitScript(()=>window.requestAnimationFrame=()=>0);await q.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await q.goto('http://alchemy.test/');await q.waitForSelector('#region-dialog[open]');
  for(const weapon of ['sword','spear','bow','staff']){
   await q.evaluate(()=>weaponTest.selectRegion('lobby'));await q.locator('#region-btn').tap();await q.waitForSelector('#region-dialog[open]');await q.locator('#weapon-'+weapon).tap();await q.locator('#forest-btn').tap();await q.waitForSelector('#region-dialog[open]',{state:'hidden'});
   if(!(await q.locator('.play-screen').count())){await q.locator('#play-mode-btn').tap();await q.waitForSelector('.play-screen');}
   const setup=()=>q.evaluate(weapon=>{const g=weaponTest,p=g.state.player;p.cool=0;p.attack=0;p.aim={x:1,y:0};g.state.playerShots=[];g.state.playerMagic=[];g.state.enemies=[g.newEnemy(p.x+(weapon==='sword'?50:weapon==='spear'?100:150),p.y+(weapon==='bow'||weapon==='staff'?35:0))];},weapon);
   await setup();await q.keyboard.down('ArrowRight');if(weapon==='staff'){await q.keyboard.down('Space');await q.evaluate(()=>weaponTest.updateStaffAim(.4));await q.keyboard.up('Space');}else await q.keyboard.press('Space');await q.keyboard.up('ArrowRight');const pc=await q.evaluate(()=>weaponTest.state.player.strike.direction);
   await setup();const stick=await q.locator('#joystick').boundingBox(),atk=await q.locator('#attack-btn').boundingBox(),cd=await ctx.newCDPSession(q);
   await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:stick.x+stick.width/2+30,y:stick.y+stick.height/2},{id:2,x:atk.x+atk.width/2,y:atk.y+atk.height/2}]});await q.waitForTimeout(45);
   if(weapon==='staff'){await q.evaluate(()=>weaponTest.updateStaffAim(.4));await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{id:2,x:atk.x+atk.width/2,y:atk.y+atk.height/2}]});}const touch=await q.evaluate(()=>weaponTest.state.player.strike.direction);assert.ok(Math.abs(pc.x-touch.x)<1e-10&&Math.abs(pc.y-touch.y)<1e-10,'PC/touch aim parity');
   await q.evaluate(()=>{weaponTest.updatePlayerAttacks(.5);weaponTest.draw();});assert.equal(await q.evaluate(()=>weaponTest.state.enemies[0].hp),weapon==='staff'?1:2);await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   if(viewport.width===844)await q.screenshot({path:'/tmp/player-weapon-'+weapon+'.png'});
  }
  await q.reload();await q.waitForSelector('#region-dialog[open]');assert.equal(await q.evaluate(()=>weaponTest.state.activeWeapon),'sword');console.log('PASS mobile native multitouch + PC aim parity + reload',viewport);await ctx.close();
 }
 // Native keyboard input, real animation loop, and natural collision against moving slimes.
 for(const weapon of ['sword','spear','bow','staff']){
  const live=await b.newPage({viewport:{width:844,height:390}});live.on('pageerror',e=>errors.push(e.message));await live.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await live.goto('http://alchemy.test/');await live.waitForSelector('#region-dialog[open]');await live.locator('#weapon-'+weapon).click();await live.locator('#forest-btn').click();await live.locator('#play-mode-btn').click();
  await live.evaluate(weapon=>{const g=weaponTest;g.state.enemies=[g.newEnemy(g.state.player.x+(weapon==='sword'?60:weapon==='spear'?120:180),g.state.player.y)];window.liveTarget=g.state.enemies[0];},weapon);
  if(weapon==='staff'){await live.keyboard.down('Space');await live.waitForTimeout(430);await live.keyboard.up('Space');}else await live.keyboard.press('Space');await live.waitForTimeout(60);await live.screenshot({path:'/tmp/player-live-'+weapon+'.png'});await live.waitForTimeout(550);assert.equal(await live.evaluate(()=>liveTarget.hp),weapon==='staff'?1:2);console.log('PASS live native input hit',weapon);await live.close();
 }
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
