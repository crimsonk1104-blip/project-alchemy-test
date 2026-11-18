const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});try{
const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8').replace('  preload().catch(error=>{',`window.titleTest={get state(){return state;},get started(){return started;},get paused(){return paused;}};\n  preload().catch(error=>{`);
for(const viewport of [{width:1280,height:800},{width:844,height:390},{width:1180,height:820},{width:820,height:1180},{width:360,height:640}]){
 const c=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<1200}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://alchemy.test/');await p.waitForFunction(()=>!document.querySelector('#title-new').disabled);
 assert.ok(await p.locator('#title-screen').isVisible());assert.equal(await p.locator('.app').isVisible(),false);assert.equal(await p.locator('#region-dialog').isVisible(),false);assert.ok(await p.locator('#title-continue').isDisabled());assert.equal(await p.evaluate(()=>titleTest.started),false);
 await p.keyboard.press('Space');await p.keyboard.press('j');assert.equal(await p.evaluate(()=>titleTest.state.playerAreas.length),0);assert.equal(await p.evaluate(()=>titleTest.state.player.attack),0);
 for(const id of ['title-new','title-options','title-credits']){const box=await p.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1&&box.height>=44&&box.y>=0&&box.y+box.height<=viewport.height);}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.locator('#title-options').tap();await p.locator('#setting-motion').check();await p.locator('#setting-text').check();await p.locator('#setting-fullscreen').check();assert.ok(await p.evaluate(()=>document.body.classList.contains('reduced-motion')&&document.body.classList.contains('large-story')));await p.keyboard.press('Escape');
 await p.locator('#title-credits').tap();assert.equal(await p.locator('#title-test').isVisible(),false);await p.keyboard.press('Escape');
 // Unsupported fullscreen still starts the complete viewport layout.
 await p.evaluate(()=>{document.querySelector('.game-panel').requestFullscreen=undefined;});
 await p.screenshot({path:'/tmp/title-'+viewport.width+'.png'});await p.locator('#title-new').tap();await p.waitForSelector('#region-dialog[open]');assert.ok(await p.locator('.play-screen').isVisible());assert.equal(await p.locator('#title-screen').isVisible(),false);assert.equal(await p.locator('#combat-sandbox').isVisible(),false);assert.match(await p.locator('#story-speech').innerText(),/住所|주소는 맞는데/);assert.equal(await p.evaluate(()=>titleTest.state.story.name),'');
 assert.equal(await p.locator('#story-speech').evaluate(e=>getComputedStyle(e).fontSize),'20px');
 await p.locator('#region-close').tap();await p.locator('#title-return-btn').tap();assert.ok(await p.locator('#title-screen').isVisible());assert.equal(await p.evaluate(()=>titleTest.started),false);assert.equal(await p.evaluate(()=>titleTest.paused),true);
 await p.locator('#title-new').tap();assert.equal(await p.evaluate(()=>titleTest.state.story.scene),0);assert.equal(await p.evaluate(()=>Object.keys(titleTest.state.inventory.equipment).length),0);
 await p.locator('#region-close').tap();await p.locator('#title-return-btn').tap();await p.reload();await p.waitForFunction(()=>!document.querySelector('#title-new').disabled);assert.ok(await p.locator('#title-screen').isVisible());assert.ok(await p.locator('#title-continue').isDisabled());assert.equal(await p.locator('#setting-text').isChecked(),false);
 await p.locator('#title-credits').tap();await p.locator('summary').tap();await p.locator('#title-test').tap();assert.ok(await p.locator('#combat-sandbox').isVisible());assert.equal(await p.locator('.play-screen').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS title/default input isolation, responsive layout, settings, unavailable continue, new CH01, return/reset/reload, hidden debug',viewport);await c.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
