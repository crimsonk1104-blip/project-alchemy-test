// Run: node tests/play-mode.cjs. Native Chromium mobile touch + real fullscreen.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../v0.2.html'),'utf8');
async function run(browser,engine,cdp=true){
 for(const viewport of [{width:360,height:640},{width:390,height:844},{width:844,height:390},{width:820,height:1180},{width:1180,height:820}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`window.playTest=()=>({x:state.player.x,y:state.player.y,attacks:diagnostic.attacks,touch:{...touch},paused});\n  preload().catch(error=>{`)}));
  await page.goto('http://alchemy.test/v0.2.html');await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.addEventListener('click',e=>{if(e.target.id==='play-mode-btn')window.entryScroll=scrollY;},true);});
  await page.locator('#play-mode-btn').scrollIntoViewIfNeeded();await page.evaluate(()=>{const top=document.getElementById('play-mode-btn').getBoundingClientRect().top;scrollBy(0,Math.min(120,Math.max(0,top-30)));});await page.locator('#play-mode-btn').tap();
  await page.waitForFunction(()=>document.querySelector('.play-screen'));
  const checkLayout=async()=>{
   const layout=await page.evaluate(()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};return {width:innerWidth,height:innerHeight,stick:r('joystick'),attack:r('attack-btn'),stage:r('stage-wrap'),exit:r('exit-play-btn'),panel:document.querySelector('.play-screen').getBoundingClientRect().toJSON(),scroll:scrollY};});
   for(const name of ['stick','attack','exit']){const b=layout[name];assert.ok(b.x>=0&&b.y>=0&&b.right<=layout.width+1&&b.bottom<=layout.height+1,JSON.stringify({name,layout}));}
   assert.ok(layout.stick.bottom>layout.height*.7&&layout.attack.bottom>layout.height*.7,'bottom controls');
   const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;assert.ok(!overlaps(layout.stage,layout.stick)&&!overlaps(layout.stage,layout.attack),'no overlapping game and controls');
   return layout;
  };
  let layout=await checkLayout();
  if(cdp){
   const session=await context.newCDPSession(page);
   const c={x:layout.stick.x+layout.stick.w/2+25,y:layout.stick.y+layout.stick.h/2-25},a={x:layout.attack.x+layout.attack.w/2,y:layout.attack.y+layout.attack.h/2};
   const point=(id,p)=>({id,x:p.x,y:p.y,radiusX:5,radiusY:5,force:1});
   const before=await page.evaluate(()=>playTest());await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,c),point(2,a)]});await page.waitForTimeout(300);
   const during=await page.evaluate(()=>playTest());assert.ok(Math.hypot(during.x-before.x,during.y-before.y)>20);assert.equal(during.attacks,before.attacks+1);assert.notEqual(during.touch.pointerId,during.touch.attackId);
   assert.equal(await page.evaluate(()=>visualViewport.scale),1,'no accidental zoom with controls');
   // Drag on the stage outside the controls: must not pan the underlying document.
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const start={x:layout.stage.x+layout.stage.w/2,y:layout.stage.y+layout.stage.h/2};await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(3,start)]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(3,{x:start.x,y:start.y-50})]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.mouse.wheel(0,400);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),layout.scroll);
   await page.setViewportSize({width:viewport.height,height:viewport.width});await page.waitForTimeout(100);await checkLayout();assert.equal((await page.evaluate(()=>playTest())).touch.pointerId,null);
   await page.setViewportSize(viewport);await page.waitForTimeout(100);
  }
  assert.ok(!(await page.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable=no'));
  await page.screenshot({path:'/tmp/alchemy-play-'+engine+'-'+viewport.width+'.png'});
  await page.locator('#exit-play-btn').tap();await page.waitForFunction(()=>!document.documentElement.classList.contains('play-active'));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('play-active')),false);
  assert.equal(await page.evaluate(()=>scrollY),await page.evaluate(()=>entryScroll),'restore exact entry scroll');
  assert.equal(await page.evaluate(()=>document.body.style.position),'');assert.ok((await page.evaluate(()=>playTest())).paused);
  const restored=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,restored>100?-200:200);await page.waitForTimeout(100);assert.notEqual(await page.evaluate(()=>scrollY),restored,'page scroll restored');
  await page.locator('#play-mode-btn').tap();await page.waitForFunction(()=>document.querySelector('.play-screen'));await page.keyboard.press('Escape');assert.equal(await page.locator('.play-screen').count(),0,'Escape exits');
  assert.deepEqual(errors,[]);console.log('PASS',engine,viewport,'layout, touch, scroll lock, rotation, exit restoration');await context.close();
 }
 // Rejected and missing fullscreen must retain playable viewport fallback.
 for(const mode of ['unsupported','denied','native']){
  const page=await browser.newPage({viewport:{width:844,height:390}});
  if(mode==='unsupported')await page.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{value:false}));
  if(mode==='denied')await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});
  await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://alchemy.test/');await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));await page.locator('#play-mode-btn').scrollIntoViewIfNeeded();await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollBy(0,80);window.fullscreenEntry=scrollY;});await page.locator('#play-mode-btn').click();
  if(mode==='unsupported')assert.equal(await page.locator('#fullscreen-btn').isVisible(),false);
  else if(await page.locator('#fullscreen-btn').isVisible()){await page.locator('#fullscreen-btn').click();await page.waitForTimeout(150);if(mode==='native')console.log('Native fullscreen observed:',await page.evaluate(()=>!!document.fullscreenElement));}
  assert.equal(await page.locator('.play-screen').count(),1);await page.locator('#exit-play-btn').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);assert.equal(await page.evaluate(()=>scrollY),await page.evaluate(()=>fullscreenEntry));await page.close();console.log('PASS fullscreen',engine,mode);
 }
}
(async()=>{
 const chromiumBrowser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{await run(chromiumBrowser,'chromium');}finally{await chromiumBrowser.close();}
 let webkitBrowser;try{webkitBrowser=await webkit.launch({headless:true});}catch(e){console.log('UNRUN WebKit:',e.message.split('\n')[0]);}
 if(webkitBrowser)try{await run(webkitBrowser,'webkit',false);}finally{await webkitBrowser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
