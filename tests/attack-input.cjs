// Run: node tests/attack-input.cjs. Uses native Chromium input and the live game loop.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(require('node:path').join(__dirname,'../v0.2.html'),'utf8');
  // Observation only: no fake frames, keys, timers, or modified attack decisions.
  const observed=html.replace('  preload().catch(error=>{',`
    window.attackObservations=[];const executeAttack=attack;
    attack=(...args)=>{const before=state.player.strike;executeAttack(...args);
      if(state.player.strike!==before)window.attackObservations.push({time:performance.now(),direction:{...state.player.strike.direction},x:state.player.x,y:state.player.y});};
    preload().catch(error=>{`);
  await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:observed}));
  await page.goto('http://alchemy.test/v0.2.html?inputDebug=1');
  await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
  const observations=()=>page.evaluate(()=>attackObservations);
  const diagnostic=()=>page.locator('#input-diagnostics').innerText();
  const restart=async()=>{await page.locator('#reset-btn').click();await page.evaluate(()=>attackObservations.length=0);};
  const report=[];
  for(const dirs of [['ArrowUp','ArrowRight'],['ArrowDown','ArrowRight'],['ArrowDown','ArrowLeft'],['ArrowUp','ArrowLeft']]){
   for(const key of ['Space','j']){
    await restart();for(const dir of dirs)await page.keyboard.down(dir);
    await page.keyboard.down(key);await page.waitForTimeout(120);
    await page.keyboard.down(key); // Native repeat event must not create an immediate extra hit.
    assert.equal((await observations()).length,1);
    await page.waitForTimeout(1170);
    const held=await observations();assert.ok(held.length>=3&&held.length<=4,JSON.stringify(held));
    for(const hit of held){
     assert.ok(Math.abs(Math.abs(hit.direction.x)-Math.SQRT1_2)<1e-12);
     assert.ok(Math.abs(Math.abs(hit.direction.y)-Math.SQRT1_2)<1e-12);
     assert.equal(Math.sign(hit.direction.x),dirs.includes('ArrowRight')?1:-1);
     assert.equal(Math.sign(hit.direction.y),dirs.includes('ArrowDown')?1:-1);
    }
    const intervals=held.slice(1).map((hit,i)=>hit.time-held[i].time);
    for(const interval of intervals)assert.ok(interval>=330&&interval<550,`interval ${interval}`);
    assert.ok(Math.hypot(held.at(-1).x-held[0].x,held.at(-1).y-held[0].y)>20,'movement independent');
    const debug=await diagnostic();assert.match(debug,/공격키 유지: (Space|KeyJ)/);assert.match(debug,new RegExp('실제 공격: '+held.length+'회'));assert.match(debug,/repeat [1-9]/);
    await page.keyboard.up(key);const stopped=(await observations()).length;
    await page.waitForTimeout(480);assert.equal((await observations()).length,stopped,'release must cancel repetition');assert.match(await diagnostic(),/공격키 유지: 없음/);
    for(const dir of dirs)await page.keyboard.up(dir);
    report.push({dirs,key,attacks:held.length,intervalsMs:intervals.map(Math.round),stopped});
   }
  }
  // A held attack samples the current diagonal on every swing, not keydown's aim.
  await restart();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowRight');await page.keyboard.down('j');
  await page.waitForTimeout(100);await page.keyboard.up('ArrowUp');await page.keyboard.down('ArrowDown');await page.waitForTimeout(350);
  const changed=await observations();assert.equal(changed.length,2);assert.ok(changed[0].direction.y<0&&changed[1].direction.y>0);
  await page.keyboard.up('j');await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowDown');
  // Short taps during cooldown must not survive release as queued keyboard attacks.
  await restart();await page.keyboard.press('Space');await page.waitForTimeout(280);await page.keyboard.press('j');await page.waitForTimeout(300);assert.equal((await observations()).length,1);
  // One click remains one attack, even when the mouse stays down.
  await restart();await page.locator('#attack-btn').hover();await page.mouse.down();await page.waitForTimeout(850);assert.equal((await observations()).length,1);await page.mouse.up();
  await page.locator('#attack-btn').click();await page.waitForTimeout(300);await page.locator('#attack-btn').click();await page.waitForTimeout(160);assert.equal((await observations()).length,3,'pointer tap buffer');
  // Releasing one of two attack keys keeps the other active; releasing both stops.
  await restart();await page.keyboard.down('Space');await page.keyboard.down('j');await page.keyboard.up('Space');await page.waitForTimeout(450);assert.equal((await observations()).length,2);await page.keyboard.up('j');await page.waitForTimeout(450);assert.equal((await observations()).length,2);
  // Blur, pause, and restart clear held state; OS repeats cannot re-arm it.
  for(const action of ['blur','pause','restart']){
   await restart();await page.keyboard.down('Space');
   if(action==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
   if(action==='pause'){await page.keyboard.press('Escape');await page.keyboard.press('Escape');}
   if(action==='restart')await page.locator('#reset-btn').click();
   const before=(await observations()).length;await page.keyboard.down('Space');await page.waitForTimeout(450);assert.equal((await observations()).length,before,action);await page.keyboard.up('Space');
  }
  // No received event vs a received attack which misses are visible separately.
  await page.reload();await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
  assert.match(await diagnostic(),/keydown 0/);assert.match(await diagnostic(),/실제 공격: 0회/);
  await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowRight');await page.keyboard.down('j');await page.waitForTimeout(80);
  assert.match(await diagnostic(),/keydown 3/);assert.match(await diagnostic(),/J 수신: ↓1 ↑0/);assert.match(await diagnostic(),/공격키 유지: KeyJ/);assert.match(await diagnostic(),/실제 공격: 1회/);assert.match(await diagnostic(),/결과: 빗나감/);
  await page.screenshot({path:'/tmp/alchemy-held-input.png',fullPage:true});await page.keyboard.up('j');await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowRight');
  assert.deepEqual(errors,[]);console.log('PASS native events / live frames:',JSON.stringify(report,null,2));
  console.log('PASS release, early-tap cancellation, pointer buffer, dual attack keys, pause/blur/restart, repeat deduplication, diagnosis');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
