const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8').replace('createGround();bindInput();reset();setupTitle();',"createGround();bindInput();reset();setupTitle();selectRegion('forest');"),errors=[];
 const instrument=html.replace('  preload().catch(error=>{',`window.eq={reset:(area='forest')=>reset(area),update,draw,attack,newEnemy,rewardDefeat,equipItem,unequipItem,calculateAttackDamage,calculateStats,selectRegion,chooseStarter,EQUIPMENT,get state(){return state;},get paused(){return paused;},get touch(){return {...touch};}};\n  preload().catch(error=>{`);
 for(const viewport of [{width:1280,height:800},{width:360,height:640},{width:844,height:390},{width:820,height:1180},{width:1180,height:820}]){
  const ctx=await b.newContext({viewport,hasTouch:true,isMobile:viewport.width!==1280});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>window.requestAnimationFrame=()=>0);await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await p.goto('http://alchemy.test/?test=1');await p.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
  const result=await p.evaluate(()=>{
   const g=eq,check=(ok,m)=>{if(!ok)throw Error(m);};g.reset();check(g.calculateAttackDamage()===1&&!g.EQUIPMENT.trainingSword&&!g.equipItem('trainingSword')&&!g.equipItem('starterSword')&&!g.equipItem('unknown'),'ownership checks');
   for(let i=0;i<3;i++){
    const e=g.newEnemy(550,342);g.state.enemies=[e];
    for(let hit=0;hit<3;hit++){const player=g.state.player;e.x=player.x+65;e.y=player.y;player.cool=0;g.attack();check(e.hp===2-hit,'unarmed damage 1');g.update(.01);}
    check(!g.rewardDefeat(e),'duplicate removed enemy');
   }
   check(g.state.inventory.items.upgradeStone===1&&Object.keys(g.state.inventory.equipment).length===0,'one quest stone, no quest gear');check(g.state.inventory.currencies.alchemyCoin===35&&g.state.inventory.items.slimeMucus===5&&g.state.xp===15&&g.state.level===2,'v04 quest rewards preserved');
   g.selectRegion('lobby');g.state.story.name='장비검증';for(const style of ['sword','spear','bow','staff','sword']){check(g.chooseStarter(style),'starter exchange');check(g.state.activeWeapon===style&&Object.keys(g.state.inventory.equipment).length===1,'exchange returns previous gear');const expected=style==='staff'?2:1;for(let n=0;n<3;n++)g.equipItem(g.state.equipment.weapon);check(g.calculateAttackDamage()===expected,'repeat equip preserves weapon damage');const id=g.state.equipment.weapon;g.unequipItem('weapon');check(!g.state.equipment.weapon&&g.calculateAttackDamage()===1,'unequip falls back to base');check(g.equipItem(id)&&g.calculateAttackDamage()===expected,'re-equip owned style');}
   for(let i=0;i<10;i++)g.equipItem('starterSword');check(g.calculateAttackDamage()===1&&g.state.baseStats.attack===1,'repeat equip no bonus');g.selectRegion('forest');
   const e=g.newEnemy(550,342);g.state.enemies=[e];for(let hit=0;hit<3;hit++){const player=g.state.player;e.x=player.x+65;e.y=player.y;player.cool=0;g.attack();check(e.hp===2-hit,'starter damage remains 1');if(hit===2){check(g.rewardDefeat(e),'fourth kill');check(!g.rewardDefeat(e),'duplicate before removal');}g.update(.01);}
   check(g.state.inventory.items.upgradeStone===1&&g.state.inventory.currencies.alchemyCoin===40&&g.state.inventory.items.slimeMucus===6,'quest stone remains one');g.selectRegion('lobby');g.unequipItem('weapon');check(g.calculateAttackDamage()===1&&!g.state.equipment.weapon,'unequip preserves base stats');
   return {kills:g.state.kills,stones:g.state.inventory.items.upgradeStone,damage:g.calculateAttackDamage()};
  });
  await p.locator('#play-mode-btn').tap();await p.waitForSelector('.play-screen');
  if(viewport.width===1280){await p.locator('#fullscreen-btn').click();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>!!document.fullscreenElement),true);}
  await p.locator('#inventory-btn').tap();await p.waitForSelector('#inventory-dialog[open]');assert.equal(await p.evaluate(()=>eq.paused),true);assert.match(await p.locator('#slot-weapon').innerText(),/미착용/);
  await p.locator('#equip-starterSword').tap();assert.equal(await p.evaluate(()=>eq.calculateAttackDamage()),1);assert.match(await p.locator('#slot-weapon').innerText(),/초기 지급 검/);assert.match(await p.locator('#equipment-content').innerText(),/공격력 1/);
  await p.evaluate(()=>document.querySelector('#inventory-dialog').focus());const snapshot=await p.evaluate(()=>JSON.stringify(eq.state.player));await p.keyboard.down('ArrowRight');await p.keyboard.press('Space');await p.evaluate(()=>{eq.update(.5);eq.attack();});assert.equal(await p.evaluate(()=>JSON.stringify(eq.state.player)),snapshot);await p.keyboard.up('ArrowRight');
  const closeBox=await p.locator('#inventory-close').boundingBox();assert.ok(closeBox.y>=0&&closeBox.y+closeBox.height<=viewport.height,'close stays visible while equipment is scrolled');await p.evaluate(()=>eq.draw());await p.screenshot({path:'/tmp/alchemy-equipment-'+viewport.width+'.png'});
  await p.locator('#equip-starterSword').tap();assert.equal(await p.evaluate(()=>eq.calculateAttackDamage()),1);await p.locator('#equip-starterSword').tap();assert.equal(await p.evaluate(()=>eq.calculateAttackDamage()),1);
  await p.locator('#inventory-close').tap();await p.waitForSelector('#inventory-dialog[open]',{state:'hidden'});assert.equal(await p.evaluate(()=>eq.paused),false);
  const session=await ctx.newCDPSession(p),stick=await p.locator('#joystick').boundingBox(),atk=await p.locator('#attack-btn').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:stick.x+stick.width/2+25,y:stick.y+stick.height/2-25},{id:2,x:atk.x+atk.width/2,y:atk.y+atk.height/2}]});await p.waitForTimeout(50);
  assert.equal(await p.evaluate(()=>eq.touch.pointerId!==null&&eq.touch.attackId!==null),true);await p.evaluate(()=>eq.update(.1));await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.locator('#reset-btn').tap();await p.locator('#forest-btn').tap();assert.deepEqual(await p.evaluate(()=>({gear:eq.state.inventory.equipment,slots:eq.state.equipment,damage:eq.calculateAttackDamage()})),{gear:{},slots:{weapon:null},damage:1});
  // Reload must reset an actually equipped character, rather than an already empty state.
  await p.evaluate(()=>{eq.selectRegion('lobby');eq.state.story.name='재시작검증';eq.chooseStarter('sword');});assert.equal(await p.evaluate(()=>eq.calculateAttackDamage()),1);
  await p.reload();await p.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));assert.deepEqual(await p.evaluate(()=>({gear:eq.state.inventory.equipment,slots:eq.state.equipment,damage:eq.calculateAttackDamage()})),{gear:{},slots:{weapon:null},damage:1});
  console.log('PASS',viewport,result,'quest stone once, 3-hit starter kill, owned starter exchange and idempotent equip, UI, fullscreen, input recovery, reset/reload');await ctx.close();
 }
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
