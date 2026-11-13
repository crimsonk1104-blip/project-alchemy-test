// Run: node tests/attack-input.cjs. Chromium/Playwright required.
// Native browser keyboard events; deterministic frames isolate cooldown timing.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(require('node:path').join(__dirname,'../v0.2.html'),'utf8');
 await page.route('http://alchemy.test/',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`
  let attackCount=0;const executeAttack=attack;
  attack=(...args)=>{const before=state.player.strike;executeAttack(...args);if(state.player.strike!==before)attackCount++;};
  window.inputTest={reset:()=>{reset();attackCount=0;},update,draw,get count(){return attackCount;},get state(){return state;},get queued(){return queuedAttack;}};
  preload().catch(error=>{`)}));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.received=[];window.addEventListener('keydown',e=>window.received.push({code:e.code,repeat:e.repeat}));});
 await page.goto('http://alchemy.test/');
 await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
 const reset=()=>page.evaluate(()=>{inputTest.reset();received.length=0;});
 const step=dt=>page.evaluate(dt=>inputTest.update(dt),dt);
 const count=()=>page.evaluate(()=>inputTest.count);
 const snapshot=()=>page.evaluate(()=>({queued:!!inputTest.queued,dir:inputTest.state.player.strike?.direction,received:received.filter(e=>e.code==='Space'||e.code==='KeyJ').length}));
 for(const dirs of [['ArrowUp','ArrowRight'],['ArrowDown','ArrowRight'],['ArrowDown','ArrowLeft'],['ArrowUp','ArrowLeft']]){
  for(const key of ['Space','j']){
   await reset();for(const dir of dirs)await page.keyboard.down(dir);
   await page.keyboard.press(key);assert.equal(await count(),1);
   const s=await snapshot();assert.equal(s.received,1);assert.ok(Math.abs(Math.abs(s.dir.x)-Math.SQRT1_2)<1e-12);assert.ok(Math.abs(Math.abs(s.dir.y)-Math.SQRT1_2)<1e-12);
   await step(.30);await page.keyboard.press(key);assert.equal(await count(),1);assert.equal((await snapshot()).queued,true);
   await step(.10);assert.equal(await count(),2);assert.equal((await snapshot()).queued,false);
   await step(.5);assert.equal(await count(),2); // A tap cannot auto-repeat.
   for(const dir of dirs)await page.keyboard.up(dir);
  }
 }
 await reset();await page.keyboard.press('Space');await step(.20);await page.keyboard.press('j');await step(.14);assert.equal((await snapshot()).queued,false);await step(.1);assert.equal(await count(),1); // Received, but too early for the buffer.
 await reset();await page.keyboard.down('Space');await step(.30);await page.keyboard.down('Space');await step(.5);assert.equal(await count(),1);assert.ok(await page.evaluate(()=>received.some(e=>e.repeat)));await page.keyboard.up('Space');
 await page.keyboard.press('j');assert.equal(await count(),2); // J provides an alternative chord.
 await reset();await page.keyboard.press('Space');await step(.30);await page.keyboard.press('j');await page.keyboard.press('Space');await step(.1);assert.equal(await count(),2); // One pending slot, not two attacks.
 await reset();await page.keyboard.press('Space');await step(.30);await page.keyboard.press('j');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await step(.2);assert.equal(await count(),1); // Pause cancels pending input.
 await reset();await page.keyboard.press('Space');await step(.30);await page.keyboard.press('j');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await step(.2);assert.equal(await count(),1);
 await reset();await page.keyboard.press('Space');await step(.30);await page.keyboard.press('j');await page.locator('#reset-btn').click();await step(.2);assert.equal(await count(),1);assert.equal((await snapshot()).queued,false); // reset() clears the buffer (counter is cumulative here).
 await reset();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowRight');await page.locator('#attack-btn').click();assert.equal(await count(),1);await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowRight');
 await reset();await step(.5);assert.equal((await snapshot()).received,0);assert.equal(await count(),0); // No delivered key event is distinct from cooldown rejection.
 await page.keyboard.press('Space');assert.equal(await count(),1);assert.match(await page.locator('#log-items').innerText(),/빗나갔/); // Executed attack, no target hit.
 assert.deepEqual(errors,[]);
 console.log('PASS: 4 diagonal chords x Space/J, 130ms buffer, expiry, repeat/hold deduplication, one queue slot, pause/blur/reset cancellation, pointer, missing input vs expired buffer vs miss');
 // Also run the unmodified game loop and native input at human-like tap intervals.
 await page.unroute('http://alchemy.test/');await page.route('http://alchemy.test/',r=>r.fulfill({contentType:'text/html',body:html}));
 const live=await browser.newPage(); // No requestAnimationFrame override.
 await live.route('http://alchemy.test/',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`
 let liveCount=0;const originalAttack=attack;
 attack=(...args)=>{const before=state.player.strike;originalAttack(...args);if(before!==state.player.strike)liveCount++;};
 window.liveInput={get count(){return liveCount;}};
 preload().catch(error=>{`)}));
 live.on('pageerror',e=>errors.push(e.message));
 await live.goto('http://alchemy.test/');await live.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
 for(const dirs of [['ArrowUp','ArrowRight'],['ArrowDown','ArrowRight'],['ArrowDown','ArrowLeft'],['ArrowUp','ArrowLeft']]){
  for(const key of ['Space','j']){
   await live.locator('#reset-btn').click();
   const before=await live.evaluate(()=>liveInput.count);
   for(const dir of dirs)await live.keyboard.down(dir);
   await live.keyboard.press(key);await live.waitForTimeout(300);
   await live.keyboard.press(key);await live.waitForTimeout(160);
   assert.equal(await live.evaluate(()=>liveInput.count),before+2);
   for(const dir of dirs)await live.keyboard.up(dir);
  }
 }
 await live.keyboard.down('ArrowUp');await live.keyboard.down('ArrowRight');await live.waitForTimeout(410);await live.keyboard.press('j');await live.waitForTimeout(40);
 await live.screenshot({path:'/tmp/alchemy-input-live.png',fullPage:true});
 await live.keyboard.up('ArrowUp');await live.keyboard.up('ArrowRight');
 assert.deepEqual(errors,[]);
 console.log('PASS: live animation loop, 4 diagonal chords x Space/J; each 300ms second tap produces exactly one buffered attack; screenshot /tmp/alchemy-input-live.png');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
