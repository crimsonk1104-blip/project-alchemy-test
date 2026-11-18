const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
(async()=>{
  const root=path.join(__dirname,'..');
  assert.equal(fs.readFileSync(path.join(root,'balance-config.js'),'utf8'),execFileSync('git',['show','98fc38a:balance-config.js'],{cwd:root,encoding:'utf8'}),'preserve every balance value');
  const html=fs.readFileSync(path.join(root,'v0.2.html'),'utf8');
  const instrument=html.replace('  preload().catch(error=>{',`window.reagentTest={groundTarget,groundAttackProfile,updateGroundAim,updateAreaAttacks,update,draw,drawGroundAim,drawReagentAttack,reagentFlightPose,selectRegion,selectTrialWeapon,newEnemy,AREA_RENDERERS,get state(){return state;},get rules(){return B.weapons.staff;},get paused(){return paused;}};\n  preload().catch(error=>{`);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),errors=[];
  const artifacts=path.join(root,'../artifacts/alchemy-reagent');fs.mkdirSync(artifacts,{recursive:true});
  try{
    const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{requestAnimationFrame=()=>0;performance.now=()=>0;});
    await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));
    await page.goto('http://alchemy.test/');await page.waitForSelector('#region-dialog[open]');
    assert.match(await page.locator('#weapon-staff').innerText(),/연금 도구 · 시약 투척\(시험\)/);
    await page.locator('#weapon-staff').tap();await page.locator('#forest-btn').tap();await page.locator('#play-mode-btn').tap();await page.waitForSelector('.play-screen');
    const prep=()=>page.evaluate(()=>{const g=reagentTest;g.selectRegion('forest');g.state.enemies=[];g.state.player.aim={x:1,y:0};});
    const charge=async()=>{await page.keyboard.down('Space');await page.evaluate(()=>reagentTest.updateGroundAim(.7));await page.keyboard.up('Space');};
    await prep();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas[0].distance),45);
    await prep();await charge();assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas[0].distance),240);
    await page.evaluate(()=>{const g=reagentTest,a=g.state.playerAreas[0];g.state.enemies=[g.newEnemy(a.x,a.y),g.newEnemy(a.origin.x+120,a.origin.y),g.newEnemy(a.x+66,a.y),g.newEnemy(a.x+68,a.y)];});
    assert.deepEqual(await page.evaluate(()=>reagentTest.state.enemies.map(e=>e.hp)),[3,3,3,3]);
    assert.deepEqual(await page.evaluate(()=>{const a=reagentTest.state.playerAreas[0];return [a.delay,a.resolved,a.damage,a.visual];}),[.35,false,2,'reagent']);
    await page.evaluate(()=>{reagentTest.updateAreaAttacks(.175);reagentTest.draw();});
    const pose=await page.evaluate(()=>reagentTest.reagentFlightPose(reagentTest.state.playerAreas[0]));assert.equal(pose.t,.5);assert.equal(pose.groundX,598);assert.equal(pose.groundY,342);assert.ok(pose.height>64);assert.equal(pose.y,342-pose.height);
    await page.screenshot({path:path.join(artifacts,'flight.png')});
    await page.evaluate(()=>reagentTest.updateAreaAttacks(.174));assert.deepEqual(await page.evaluate(()=>reagentTest.state.enemies.map(e=>e.hp)),[3,3,3,3],'no flight collision or early damage');
    await page.evaluate(()=>{reagentTest.updateAreaAttacks(.002);reagentTest.draw();});
    assert.deepEqual(await page.evaluate(()=>reagentTest.state.enemies.map(e=>e.hp)),[1,3,1,3],'impact circle/body boundary, no path hits');
    assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas[0].resolved),true);
    assert.ok(await page.evaluate(()=>reagentTest.state.playerAreas[0].life>0),'splash remains briefly');
    await page.screenshot({path:path.join(artifacts,'impact.png')});
    const snapshot=await page.evaluate(()=>JSON.stringify(reagentTest.state));
    await page.evaluate(()=>{for(let i=0;i<20;i++)reagentTest.draw();});assert.equal(await page.evaluate(()=>JSON.stringify(reagentTest.state)),snapshot,'rendering never advances time or applies damage');
    await page.evaluate(()=>{const g=reagentTest,a=g.state.playerAreas[0];g.state.enemies.push(g.newEnemy(a.x,a.y));g.updateAreaAttacks(.1);g.draw();});
    await page.screenshot({path:path.join(artifacts,'splash.png')});
    assert.deepEqual(await page.evaluate(()=>reagentTest.state.enemies.map(e=>e.hp)),[1,3,1,3,3],'no repeated/DOT damage, even to a late entrant');
    await page.evaluate(()=>reagentTest.updateAreaAttacks(.13));assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas.length),0,'effect expires without stale circle');
    // Identical ground damage works with the renderer absent and an unrelated presentation id.
    await prep();await charge();await page.evaluate(()=>{const g=reagentTest,a=g.state.playerAreas[0];a.visual='future-magic';delete g.AREA_RENDERERS.reagent;g.state.enemies=[g.newEnemy(a.x,a.y)];g.draw();g.updateAreaAttacks(.36);});assert.equal(await page.evaluate(()=>reagentTest.state.enemies[0].hp),1);
    await page.evaluate(()=>{reagentTest.AREA_RENDERERS.reagent=reagentTest.drawReagentAttack;});
    await prep();await charge();await page.evaluate(()=>{const g=reagentTest,a=g.state.playerAreas[0];g.state.enemies=[g.newEnemy(a.x,a.y)];g.updateAreaAttacks(5);});assert.equal(await page.evaluate(()=>reagentTest.state.enemies[0].hp),1,'large dt impact once');assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas.length),0,'large dt expires effect');
    // Pausing freezes a released bottle; resuming continues, never duplicates it.
    await prep();await charge();await page.locator('#pause-btn').tap();assert.equal(await page.evaluate(()=>reagentTest.paused),true);
    await page.evaluate(()=>reagentTest.update(.5));assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas[0].delay),.35);
    await page.locator('#pause-btn').tap();await page.evaluate(()=>reagentTest.update(.1));assert.ok(await page.evaluate(()=>reagentTest.state.playerAreas[0].delay<.35));
    for(const kind of ['region','reset','weapon']){
      await prep();await charge();
      if(kind==='region'){await page.locator('#region-btn').tap();await page.locator('#training-btn').tap();}
      if(kind==='reset'){await page.locator('#reset-btn').tap();await page.locator('#weapon-staff').tap();await page.locator('#forest-btn').tap();}
      if(kind==='weapon'){await page.locator('#region-btn').tap();await page.locator('#lobby-btn').tap();await page.locator('#region-btn').tap();await page.locator('#weapon-bow').tap();await page.locator('#forest-btn').tap();}
      assert.equal(await page.evaluate(()=>reagentTest.state.playerAreas.length),0,kind+' clears in-flight throw');
      await page.evaluate(()=>{reagentTest.selectRegion('lobby');reagentTest.selectTrialWeapon('staff');});
    }
    // Rules are explicit input: this pure calculation also supports a future magic profile.
    assert.deepEqual(await page.evaluate(()=>reagentTest.groundTarget({x:10,y:20,direction:{x:0,y:1},elapsed:.5},{minRange:10,range:90,tapGrace:0,maxChargeTime:1})),{x:10,y:70,distance:50});
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS unchanged balance, short/long charge, fixed target, parabolic pose, 0.35s impact, one-shot radius, no path collision/DOT, renderer independence, pause/cleanup, splash expiry');
    // Real RAF and actual keyboard events: do not depend solely on stepping game helpers.
    const live=await browser.newPage({viewport:{width:1000,height:700}});live.on('pageerror',e=>errors.push(e.message));
    await live.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await live.goto('http://alchemy.test/');await live.waitForSelector('#region-dialog[open]');await live.locator('#weapon-staff').click();await live.locator('#forest-btn').click();
    await live.evaluate(()=>{const g=reagentTest;g.state.enemies=[];window.impactFrames=[];function observe(t){const a=g.state.playerAreas[0];impactFrames.push({t,has:!!a,resolved:a?.resolved,delay:a?.delay});if(impactFrames.length<160)requestAnimationFrame(observe);}requestAnimationFrame(observe);});
    await live.keyboard.down('Space');await live.keyboard.down('ArrowRight');await live.waitForTimeout(760);assert.equal(await live.evaluate(()=>reagentTest.state.playerAreas.length),0);
    await live.keyboard.up('Space');await live.keyboard.up('ArrowRight');await live.waitForFunction(()=>reagentTest.state.playerAreas[0]?.resolved);await live.waitForTimeout(300);
    const timeline=await live.evaluate(()=>impactFrames),flying=timeline.filter(f=>f.has&&!f.resolved),impacts=timeline.filter(f=>f.resolved);
    assert.ok(flying.length>1&&impacts.length>0,'live flight and splash frames both visible');
    const elapsed=impacts[0].t-flying[0].t;assert.ok(elapsed>250&&elapsed<550,'live landing timing '+elapsed);assert.equal(await live.evaluate(()=>reagentTest.state.playerAreas.length),0);assert.deepEqual(errors,[]);
    console.log('PASS native keyboard/live RAF flight → impact → expiry', {flightFrames:flying.length,impactFrames:impacts.length,observedMs:Math.round(elapsed)});await live.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
