// Chromium CDP multi-touch events, not synthetic PointerEvent dispatch.
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../v0.2.html'),'utf8');
  for(const viewport of [{width:360,height:640},{width:390,height:844},{width:844,height:390},{width:820,height:1180},{width:1180,height:820}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`
    window.mobileTest={update,reset,inputDirection,newEnemy,get state(){return state;},get touch(){return {...touch};}};
    preload().catch(error=>{`)}));
   await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.pointerLog=[];for(const t of ['pointerdown','pointerup','pointercancel'])window.addEventListener(t,e=>pointerLog.push({type:e.type,id:e.pointerId,target:e.target.id,pointerType:e.pointerType}));});
   await page.goto('http://alchemy.test/v0.2.html');await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
   const bounds=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return {stick:rect('joystick'),attack:rect('attack-btn'),stage:rect('stage-wrap'),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(bounds.overflow,false,'horizontal overflow '+JSON.stringify(viewport));
   const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
   assert.ok(!overlap(bounds.stick,bounds.stage)&&!overlap(bounds.attack,bounds.stage),'controls cover game');
   for(const b of [bounds.stick,bounds.attack]){assert.ok(b.x>=0&&b.right<=viewport.width,'controls outside width');assert.ok(b.y>=0&&b.bottom<=viewport.height,'controls outside first screen');}
   const client=await context.newCDPSession(page);
   const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
   const c=center(bounds.stick),a=center(bounds.attack);
   const point=(id,p)=>({id,x:p.x,y:p.y,radiusX:5,radiusY:5,force:1});
   const send=async(type,points)=>{await client.send('Input.dispatchTouchEvent',{type,touchPoints:points});await page.waitForTimeout(35);};
   const step=dt=>page.evaluate(dt=>mobileTest.update(dt),dt);
   const state=()=>page.evaluate(()=>({p:{...mobileTest.state.player},touch:mobileTest.touch,dir:mobileTest.inputDirection()}));
   await send('touchStart',[point(1,c)]);await send('touchMove',[point(1,{x:c.x+3,y:c.y+2})]);
   assert.equal((await state()).dir,null,'deadzone');
   const d={x:c.x+32,y:c.y-24};await send('touchMove',[point(1,d)]);
   let s=await state();assert.ok(Math.abs(s.dir.x-.8)<.002&&Math.abs(s.dir.y+.6)<.002,'360 degree direction');
   const before=s.p;await step(.1);s=await state();assert.ok(Math.abs(Math.hypot(s.p.x-before.x,s.p.y-before.y)-17.8)<.01,'normalized movement');
   await page.evaluate(()=>{const g=mobileTest,p=g.state.player,v=g.inputDirection();g.state.enemies=[g.newEnemy(p.x+v.x*70,p.y+v.y*70)];});
   await send('touchStart',[point(1,d),point(2,a)]);
   s=await state();assert.equal(await page.evaluate(()=>scrollY),0,'joystick touch must not scroll');assert.ok(s.touch.pointerId!==null&&s.touch.attackId!==null&&s.touch.pointerId!==s.touch.attackId,'independent pointer IDs');
   assert.ok(Math.abs(s.p.strike.direction.x-.8)<.002&&Math.abs(s.p.strike.direction.y+.6)<.002,'diagonal touch attack');
   assert.equal(await page.evaluate(()=>mobileTest.state.enemies[0].hp),2,'touch damage');
   // Change joystick while the attack finger remains held. Pointer hold stays one-shot.
   const d2={x:c.x-24,y:c.y+32};await send('touchMove',[point(1,d2),point(2,a)]);await step(.4);
   assert.ok((await state()).dir.x<0&&(await state()).dir.y>0);
   assert.equal(await page.evaluate(()=>mobileTest.state.enemies[0].hp),2,'no new touch auto-attack');
   await send('touchEnd',[point(2,a)]);await send('touchStart',[point(1,d2),point(3,a)]);
   s=await state();assert.ok(s.p.strike.direction.x<0&&s.p.strike.direction.y>0,'new direction on next attack');
   // Joystick release must not release the attack pointer or leave drift.
   await send('touchEnd',[point(1,d2)]);s=await state();assert.equal(s.touch.pointerId,null);assert.notEqual(s.touch.attackId,null);const stopped={...s.p};await step(.1);s=await state();assert.equal(s.p.x,stopped.x);assert.equal(s.p.y,stopped.y);
   await send('touchCancel',[]);assert.equal((await state()).touch.attackId,null);
   // Keyboard state and joystick ownership are separate.
   await page.keyboard.down('ArrowLeft');await send('touchStart',[point(4,d)]);assert.ok((await state()).dir.x>0);await send('touchEnd',[]);assert.equal((await state()).dir.x,-1);await page.keyboard.up('ArrowLeft');
   await send('touchStart',[point(5,d)]);await send('touchCancel',[]);assert.equal((await state()).dir,null);
   await send('touchStart',[point(6,d)]);await page.setViewportSize({width:viewport.width-1,height:viewport.height});await page.waitForTimeout(100);assert.equal((await state()).touch.pointerId,null);await send('touchEnd',[]);
   // New touch works after screen resize; reset clears both fingers.
   await page.setViewportSize(viewport);await page.waitForTimeout(100);
   await send('touchStart',[point(7,d),point(8,a)]);await page.evaluate(()=>mobileTest.reset());assert.equal((await state()).touch.pointerId,null);assert.equal((await state()).touch.attackId,null);await send('touchEnd',[]);
   await send('touchStart',[point(9,d)]);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).dir,null);await send('touchEnd',[]);
   const log=await page.evaluate(()=>pointerLog);assert.ok(log.some(e=>e.pointerType==='touch'&&e.type==='pointercancel'));assert.deepEqual(errors,[]);
   console.log('PASS',viewport,'native multi-touch, 360 heading, deadzone, speed, damage, release/cancel/resize/blur/reset, keyboard isolation, layout');
   await context.close();
  }
  // Repeat on the real animation loop, without controlling the game clock.
  for(const viewport of [{width:844,height:390},{width:820,height:1180}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const page=await context.newPage();
   await page.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`window.liveTouch=()=>({x:state.player.x,y:state.player.y,attacks:diagnostic.attacks});
  preload().catch(error=>{`)}));
   await page.goto('http://alchemy.test/v0.2.html');await page.waitForFunction(()=>document.querySelector('#stage-loading').classList.contains('hidden'));
   const stick=await page.locator('#joystick').boundingBox(),attack=await page.locator('#attack-btn').boundingBox();
   const client=await context.newCDPSession(page),point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
   const left=point(1,stick.x+stick.width/2+30,stick.y+stick.height/2-30),right=point(2,attack.x+attack.width/2,attack.y+attack.height/2);
   const before=await page.evaluate(()=>liveTouch());await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,right]});await page.waitForTimeout(350);
   const moving=await page.evaluate(()=>liveTouch());assert.ok(Math.hypot(moving.x-before.x,moving.y-before.y)>30);assert.equal(moving.attacks,1);
   await page.screenshot({path:'/tmp/alchemy-mobile-'+viewport.width+'.png',fullPage:false});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(40);const stopped=await page.evaluate(()=>liveTouch());await page.waitForTimeout(450);assert.deepEqual(await page.evaluate(()=>liveTouch()),stopped);
   console.log('PASS live animation + simultaneous two-finger touch + release',viewport);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
