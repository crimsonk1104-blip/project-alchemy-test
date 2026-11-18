const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8'),errors=[];
 const instrument=html.replace('  preload().catch(error=>{',`window.regions={reset,update,draw,attack,newEnemy,rewardDefeat,selectRegion,prepareEvaluationReport,completeEvaluationAfterNpcReport,get state(){return state;},get paused(){return paused;},get touch(){return {...touch};}};\n  preload().catch(error=>{`);
 const p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await p.goto('http://alchemy.test/?test=1');await p.waitForSelector('#region-dialog[open]');
 assert.equal(await p.evaluate(()=>regions.state.area),'lobby');assert.match(await p.locator('#evaluation-status').innerText(),/진행 전/);
 await p.locator('#forest-btn').click();
 const before=await p.evaluate(()=>{
  const g=regions,check=(v,m)=>{if(!v)throw Error(m);};check(!g.completeEvaluationAfterNpcReport(),'no premature completion');
  for(let i=0;i<3;i++){const e=g.newEnemy(550,342);g.state.enemies=[e];for(let hit=0;hit<3;hit++){e.x=g.state.player.x+65;e.y=g.state.player.y;g.state.player.cool=0;g.attack();g.update(.01);}}
  check(g.state.kills===3&&g.state.questDone&&g.state.level===2&&g.state.xp===15,'forest quest unchanged');
  check(g.state.inventory.currencies.alchemyCoin===35&&g.state.inventory.items.slimeMucus===5&&g.state.inventory.equipment.trainingSword===1,'forest rewards unchanged');
  check(g.state.evaluation.status==='notStarted','forest cannot advance evaluation');return JSON.stringify(g.state.inventory);
 });
 await p.locator('#region-btn').click();await p.locator('#training-btn').click();
 assert.equal(await p.evaluate(()=>regions.state.area),'training');assert.equal(await p.evaluate(()=>regions.state.evaluation.status),'active');
 await p.evaluate(()=>regions.draw());await p.screenshot({path:'/tmp/alchemy-training-active.png'});
 const goal=await p.evaluate(()=>{
  const g=regions,check=(v,m)=>{if(!v)throw Error(m);};check(g.state.enemies.length===1&&g.state.enemies[0].type==='automaton','one unique monster');
  const outsider=g.newEnemy(550,350);outsider.hp=0;g.state.enemies.push(outsider);check(!g.rewardDefeat(outsider),'slime cannot satisfy evaluation');g.state.enemies.pop();
  const e=g.state.enemies[0];check(e.maxHp===12,'automaton hp');
  for(let phase=0;phase<4;phase++){
    for(let frame=0;frame<80&&e.ai.used[phase]===0;frame++){g.state.player.invuln=1;g.update(.04);}
    check(e.ai.used[phase]>0,'pattern actually executed');
    for(let hit=0;hit<3;hit++){e.x=g.state.player.x+65;e.y=g.state.player.y;g.state.player.cool=0;g.attack();g.update(.01);}
  }
  check(g.state.evaluation.status==='objectiveMet','goal only, not completed');check(!g.rewardDefeat(e),'duplicate evaluation');
  for(let i=0;i<50;i++)g.update(.1);check(g.state.enemies.length===0,'no training respawn');check(g.state.kills===3&&g.state.xp===15,'evaluation not counted as slime');
  check(!g.completeEvaluationAfterNpcReport(),'must prepare report');g.draw();return JSON.stringify(g.state.inventory);
 });assert.equal(goal,before);
 await p.screenshot({path:'/tmp/alchemy-evaluation-goal.png'});
 await p.locator('#evaluation-return-btn').click();await p.waitForSelector('#region-dialog[open]');assert.match(await p.locator('#evaluation-status').innerText(),/보고 대기/);assert.equal(await p.evaluate(()=>regions.state.area),'lobby');
 await p.screenshot({path:'/tmp/alchemy-evaluation-report.png'});
 await p.locator('#training-btn').click();assert.equal(await p.evaluate(()=>regions.state.enemies.length),0,'no farming after victory');assert.equal(await p.evaluate(()=>regions.completeEvaluationAfterNpcReport()),false,'NPC hook requires lobby');
 await p.locator('#region-btn').click();await p.locator('#lobby-btn').click();assert.equal(await p.evaluate(()=>regions.completeEvaluationAfterNpcReport()),true);assert.equal(await p.evaluate(()=>regions.completeEvaluationAfterNpcReport()),false);assert.equal(await p.evaluate(()=>regions.state.evaluation.status),'complete');assert.equal(await p.evaluate(()=>JSON.stringify(regions.state.inventory)),before,'report hook adds no unapproved rewards');
 await p.locator('#reset-btn').click();assert.equal(await p.evaluate(()=>regions.state.evaluation.status),'notStarted');assert.equal(await p.evaluate(()=>regions.state.kills),0);assert.deepEqual(await p.evaluate(()=>regions.state.inventory),{currencies:{},items:{},equipment:{}});
 await p.evaluate(()=>{const g=regions;g.selectRegion('training');g.state.player.hp=0;});await p.locator('#region-btn').click();await p.locator('#lobby-btn').click();await p.locator('#region-btn').click();await p.locator('#training-btn').click();assert.equal(await p.evaluate(()=>regions.state.enemies.length),1);assert.equal(await p.evaluate(()=>regions.state.player.hp),100);assert.equal(await p.evaluate(()=>regions.state.evaluation.status),'active');
 await p.locator('#play-mode-btn').click();await p.locator('#fullscreen-btn').click();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>!!document.fullscreenElement),true);await p.locator('#region-btn').click();await p.waitForSelector('#region-dialog[open]');assert.equal(await p.evaluate(()=>document.fullscreenElement.contains(document.querySelector('#region-dialog'))),true);await p.locator('#forest-btn').click();assert.equal(await p.evaluate(()=>regions.state.area),'forest');await p.locator('#exit-play-btn').click();
 console.log('PASS lobby → forest quest/rewards → training 1v1 → objective met → report pending; gated future completion hook; no auto-completion, no duplicate/reward changes, retry/reset');
 for(const viewport of [{width:360,height:640},{width:844,height:390},{width:820,height:1180},{width:1180,height:820}]){
  const ctx=await b.newContext({viewport,isMobile:true,hasTouch:true});const q=await ctx.newPage();q.on('pageerror',e=>errors.push(e.message));await q.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await q.goto('http://alchemy.test/?test=1');await q.waitForSelector('#region-dialog[open]');
  const menu=await q.locator('#region-dialog').boundingBox();assert.ok(menu.x>=0&&menu.y>=0&&menu.x+menu.width<=viewport.width+1&&menu.y+menu.height<=viewport.height+1);
  await q.locator('#training-btn').tap();await q.waitForSelector('#region-dialog[open]',{state:'hidden'});await q.locator('#play-mode-btn').tap();await q.waitForSelector('.play-screen');
  const cd=await ctx.newCDPSession(q),stick=await q.locator('#joystick').boundingBox(),atk=await q.locator('#attack-btn').boundingBox();const initial=await q.evaluate(()=>({x:regions.state.player.x,y:regions.state.player.y}));
  await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:stick.x+stick.width/2+25,y:stick.y+stick.height/2-25},{id:2,x:atk.x+atk.width/2,y:atk.y+atk.height/2}]});await q.waitForTimeout(200);const moved=await q.evaluate(()=>({x:regions.state.player.x,y:regions.state.player.y}));assert.ok(Math.hypot(moved.x-initial.x,moved.y-initial.y)>15);
  await q.locator('#region-btn').tap();await q.waitForSelector('#region-dialog[open]');assert.equal(await q.evaluate(()=>regions.touch.pointerId),null);assert.equal(await q.evaluate(()=>regions.paused),true);await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await q.locator('#forest-btn').tap();await q.waitForSelector('#region-dialog[open]',{state:'hidden'});assert.equal(await q.evaluate(()=>regions.state.enemies.every(e=>e.type==='slime')),true);assert.equal(await q.evaluate(()=>regions.paused),false);
  await q.locator('#region-btn').tap();await q.waitForSelector('#region-dialog[open]');await q.screenshot({path:'/tmp/alchemy-regions-'+viewport.width+'.png'});await q.locator('#region-close').tap();await q.waitForSelector('#region-dialog[open]',{state:'hidden'});
  console.log('PASS mobile live multi-touch, fullscreen-layout region menu, pause/cleanup/selection recovery',viewport);await ctx.close();
 }
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
