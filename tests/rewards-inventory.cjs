const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8').replace('createGround();bindInput();reset();setupTitle();',"createGround();bindInput();reset();setupTitle();selectRegion('forest');");
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`window.rewardsTest={reset:(area='forest')=>reset(area),update,attack,newEnemy,rewardDefeat,openInventory,closeInventory,get state(){return state;},get paused(){return paused;},get touch(){return {...touch};}};\n  preload().catch(error=>{`)}));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto('http://alchemy.test/?test=1');await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
 const result=await page.evaluate(()=>{
  const g=rewardsTest,check=(v,m)=>{if(!v)throw Error(m);};g.reset();
  const e=g.state.enemies[0];check(!g.rewardDefeat(e),'live enemy cannot reward');
  e.hp=0;check(g.rewardDefeat(e),'first reward');check(!g.rewardDefeat(e),'duplicate before removal');
  check(g.state.kills===1&&g.state.xp===10&&g.state.inventory.currencies.alchemyCoin===5&&g.state.inventory.items.slimeMucus===1,'exact kill reward');
  g.update(.01);check(!g.rewardDefeat(e),'duplicate after removal');check(g.state.kills===1,'update not duplicated');
  for(let i=0;i<2;i++){const e=g.newEnemy(550,350);e.hp=0;g.state.enemies.push(e);g.update(.01);}
  check(g.state.kills===3&&g.state.questDone&&g.state.level===2&&g.state.xp===15,'existing progression');
  check(g.state.inventory.currencies.alchemyCoin===35&&g.state.inventory.items.slimeMucus===5&&g.state.inventory.items.upgradeStone===1&&Object.keys(g.state.inventory.equipment).length===0,'quest stone once');
  const fourth=g.newEnemy(550,350);fourth.hp=0;g.state.enemies.push(fourth);g.update(.01);g.update(.01);
  check(g.state.inventory.currencies.alchemyCoin===40&&g.state.inventory.items.slimeMucus===6&&g.state.xp===25&&g.state.inventory.items.upgradeStone===1,'no repeated quest');
  g.openInventory();const snapshot=JSON.stringify(g.state.player);g.update(1);g.attack();check(JSON.stringify(g.state.player)===snapshot,'modal pauses game and blocks attacks');g.closeInventory();check(!g.paused,'resume previous running state');
  return {coins:g.state.inventory.currencies.alchemyCoin,mucus:g.state.inventory.items.slimeMucus};
 });
 await page.locator('#inventory-btn').click();assert.match(await page.locator('#inventory-content').innerText(),/연금화폐 · 40개/);assert.match(await page.locator('#inventory-content').innerText(),/슬라임 점액 · 6개/);
 assert.match(await page.locator('#inventory-content').innerText(),/초급 강화석 · 1개/);await page.screenshot({path:'/tmp/alchemy-inventory-populated.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#inventory-dialog').isVisible(),false);
 await page.locator('#pause-btn').click();await page.locator('#inventory-btn').click();await page.locator('#inventory-close').click();assert.equal(await page.evaluate(()=>rewardsTest.paused),true);
 await page.evaluate(()=>rewardsTest.reset());assert.deepEqual(await page.evaluate(()=>rewardsTest.state.inventory),{currencies:{},items:{},equipment:{}});
 await page.evaluate(()=>{const e=rewardsTest.state.enemies[0];e.hp=0;rewardsTest.rewardDefeat(e);rewardsTest.reset();if(rewardsTest.rewardDefeat(e))throw Error('stale reset enemy rewarded');});
 await page.reload();await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));assert.deepEqual(await page.evaluate(()=>rewardsTest.state.inventory),{currencies:{},items:{},equipment:{}});assert.deepEqual(errors,[]);
 await page.locator('#play-mode-btn').click();await page.locator('#fullscreen-btn').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
 await page.locator('#inventory-btn').click();assert.equal(await page.locator('#inventory-dialog').isVisible(),true);assert.equal(await page.evaluate(()=>document.fullscreenElement.contains(document.querySelector('#inventory-dialog'))),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#inventory-dialog').isVisible(),false);assert.equal(await page.locator('.play-screen').count(),1);await page.locator('#exit-play-btn').click();await page.waitForTimeout(100);
 console.log('PASS exact rewards, duplicate defeat before/after removal, one quest reward, stacking, inventory UI, pause restoration, reset/reload, stale enemy:',result);
 for(const viewport of [{width:360,height:640},{width:844,height:390},{width:820,height:1180},{width:1180,height:820}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`window.mobileInventory=()=>({x:state.player.x,y:state.player.y,attacks:diagnostic.attacks,paused,touch:{...touch}});\n  preload().catch(error=>{`)}));
  await p.goto('http://alchemy.test/?test=1');await p.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));await p.locator('#play-mode-btn').tap();await p.waitForSelector('.play-screen');
  const cdp=await context.newCDPSession(p),stick=await p.locator('#joystick').boundingBox(),attack=await p.locator('#attack-btn').boundingBox();const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,stick.x+stick.width/2+24,stick.y+stick.height/2-24),point(2,attack.x+attack.width/2,attack.y+attack.height/2)]});await p.waitForTimeout(200);
  await p.locator('#inventory-btn').tap();await p.waitForSelector('#inventory-dialog[open]');const stopped=await p.evaluate(()=>mobileInventory());assert.equal(stopped.paused,true);assert.equal(stopped.touch.pointerId,null);assert.equal(stopped.touch.attackId,null);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(450);assert.deepEqual(await p.evaluate(()=>mobileInventory()),stopped);
  const box=await p.locator('#inventory-dialog').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
  await p.screenshot({path:'/tmp/alchemy-inventory-'+viewport.width+'.png'});await p.locator('#inventory-close').tap();await p.waitForSelector('#inventory-dialog[open]',{state:'hidden'});assert.equal((await p.evaluate(()=>mobileInventory())).paused,false);
  const before=await p.evaluate(()=>mobileInventory());await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(4,stick.x+stick.width/2+24,stick.y+stick.height/2-24),point(5,attack.x+attack.width/2,attack.y+attack.height/2)]});await p.waitForTimeout(200);const after=await p.evaluate(()=>mobileInventory());assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>10);assert.equal(after.attacks,before.attacks+1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  console.log('PASS mobile modal, touch cleanup, paused simulation and restored multi-touch',viewport);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
