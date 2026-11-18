const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8'),errors=[];
 const instrument=html.replace('  preload().catch(error=>{',`window.robot={selectRegion,reset,update,updateAutomaton,draw,drawAutomatonStrike,renderAutomatonStatus,damageAutomaton,MONSTERS,AUTOMATON_PATTERNS,get state(){return state;}};\n  preload().catch(error=>{`);
 const p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>window.requestAnimationFrame=()=>0);await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await p.goto('http://alchemy.test/?test=1');await p.waitForSelector('#region-dialog[open]');await p.locator('#training-btn').click();
 const report=await p.evaluate(()=>{
  const g=robot,check=(v,m)=>{if(!v)throw Error(m);},result=[];
  check(g.MONSTERS.automaton.speed===178*.70,'movement 30% slower');
  for(let i=0;i<4;i++){
   const pattern=g.AUTOMATON_PATTERNS[i];
   for(const dodge of [false,true]){
    g.reset('training');const e=g.state.enemies[0],player=g.state.player;e.ai.index=i;e.ai.timer=0;e.hp=e.maxHp-i*3;
    player.x=e.x-50;player.y=e.y;player.invuln=0;g.updateAutomaton(e,.01);check(e.ai.mode==='windup','telegraph');check(player.hp===100,'no contact damage');
    const fixed=JSON.stringify(e.ai.strike);
    if(dodge){if(i===0)player.x=e.x+140;else if(i===1||i===2)player.y+=120;else{player.x+=150;player.y+=100;}}
    check(JSON.stringify(e.ai.strike)===fixed,'aim locked');
    // Observe actual Canvas operations for distinct warning shapes.
    const ctx=document.querySelector('#game').getContext('2d'),calls=[],originals={};
    for(const method of ['arc','rect','setLineDash']){originals[method]=ctx[method];ctx[method]=function(...args){calls.push([method,...args]);return originals[method].apply(this,args);};}
    g.drawAutomatonStrike(e);for(const method in originals)ctx[method]=originals[method];
    if(i===0)check(calls.some(c=>c[0]==='arc'&&c[3]===70&&c[4]===-Math.PI/4),'sword sector');
    if(i===1)check(calls.some(c=>c[0]==='rect'&&c[3]===210&&c[4]===28),'spear corridor');
    if(i===2)check(calls.some(c=>c[0]==='setLineDash'),'bow aim line');
    if(i===3)check(calls.some(c=>c[0]==='arc'&&c[3]===66&&c[5]===Math.PI*2),'staff circle');
    for(let frame=0;frame<80&&e.ai.used[i]===0;frame++)g.update(.02);
    check(e.ai.used[i]===1,'exactly one execution');
    if(i===2)for(let frame=0;frame<13;frame++)g.update(.02);
    check(player.hp===(dodge?100:100-pattern.damage),pattern.name+' hit/dodge');
    result.push({weapon:pattern.id,dodge,hp:player.hp});
   }
  }
  g.reset('training');const e=g.state.enemies[0];
  for(let i=0;i<4;i++){
   check(e.ai.index===i,'ordered switch');
   g.damageAutomaton(e,999);check(e.hp>0,'cannot skip unseen phase');
   g.state.player.x=e.x-50;g.state.player.y=e.y;g.state.player.invuln=100;
   for(let frame=0;frame<100&&e.ai.used[i]===0;frame++)g.update(.02);
   check(e.ai.used[i]>0,'phase attacks before switching');
  }
  check(e.hp===1,'final unseen-phase guard is released only after staff fires');g.damageAutomaton(e,1);g.update(.02);
  check(g.state.evaluation.status==='objectiveMet'&&g.state.kills===0,'evaluation preserved, forest not changed');
  check(Object.keys(g.state.inventory.items).length===0,'no training rewards');
  g.selectRegion('lobby');g.state.evaluation.status='active';g.selectRegion('training');g.state.player.hp=0;g.update(.1);g.selectRegion('lobby');g.selectRegion('training');check(g.state.player.hp===100&&g.state.enemies[0].ai.index===0,'retry reset');
  return result;
 });console.log('PASS geometry, telegraphs, explicit hits/dodges, low damage, phase gates, speed, retry, quest:',report);
 await p.close();
 // Real keyboard evasion in a controlled starting position; timers and movement run live.
 for(let index=0;index<4;index++){
  const dodgePage=await b.newPage();dodgePage.on('pageerror',e=>errors.push(e.message));
  await dodgePage.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await dodgePage.goto('http://alchemy.test/?test=1');await dodgePage.waitForSelector('#region-dialog[open]');await dodgePage.locator('#training-btn').click();
  await dodgePage.evaluate(index=>{const e=robot.state.enemies[0];e.ai.index=index;e.ai.timer=.2;e.hp=12;robot.state.player.x=e.x-50;robot.state.player.y=e.y;},index);
  await dodgePage.waitForFunction(()=>robot.state.enemies[0].ai.mode==='windup');
  const pattern=await dodgePage.evaluate(index=>robot.AUTOMATON_PATTERNS[index],index),key=index===0?'ArrowLeft':'ArrowUp';
  await dodgePage.screenshot({path:'/tmp/automaton-warning-'+pattern.id+'.png'});await dodgePage.keyboard.down(key);await dodgePage.waitForTimeout((pattern.windup+.25)*1000);await dodgePage.keyboard.up(key);
  const dodged=await dodgePage.evaluate(index=>({hp:robot.state.player.hp,executed:robot.state.enemies[0].ai.used[index]}),index);assert.equal(dodged.hp,100);assert.ok(dodged.executed>=1);console.log('PASS native keyboard evade',pattern.id,dodged);await dodgePage.close();
 }
 // Live gameplay using actual held keyboard events: no forced HP, position or AI timers.
 const q=await b.newPage({viewport:{width:1200,height:800}});q.on('pageerror',e=>errors.push(e.message));await q.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:instrument}));await q.goto('http://alchemy.test/?test=1');await q.waitForSelector('#region-dialog[open]');await q.locator('#training-btn').click();await q.locator('#play-mode-btn').click();
 await q.evaluate(()=>window.observedRobot=robot.state.enemies[0]);await q.keyboard.down('Space');const held=new Set(),seen=new Set();
 for(let frame=0;frame<120;frame++){
  const snapshot=await q.evaluate(()=>({hp:robot.state.player.hp,status:robot.state.evaluation.status,dx:observedRobot.x-robot.state.player.x,dy:observedRobot.y-robot.state.player.y,index:observedRobot.ai.index,used:[...observedRobot.ai.used]}));
  seen.add(snapshot.index);if(snapshot.status==='objectiveMet')break;
  assert.ok(snapshot.hp>0,'novice mistakes survivable');
  const desired=new Set();
  if(Math.hypot(snapshot.dx,snapshot.dy)>35){
    if(Math.abs(snapshot.dx)>10)desired.add(snapshot.dx>0?'ArrowRight':'ArrowLeft');
    if(Math.abs(snapshot.dy)>10)desired.add(snapshot.dy>0?'ArrowDown':'ArrowUp');
  }
  for(const key of [...held])if(!desired.has(key)){await q.keyboard.up(key);held.delete(key);}
  for(const key of desired)if(!held.has(key)){await q.keyboard.down(key);held.add(key);}
  await q.waitForTimeout(120);
 }
 await q.keyboard.up('Space');for(const key of held)await q.keyboard.up(key);
 const actual=await q.evaluate(()=>({used:[...observedRobot.ai.used],hp:robot.state.player.hp,status:robot.state.evaluation.status}));assert.equal(seen.size,4);assert.ok(actual.used.every(n=>n>=1));assert.equal(actual.status,'objectiveMet');
 await q.locator('#evaluation-return-btn').click();await q.waitForSelector('#region-dialog[open]');assert.match(await q.locator('#evaluation-status').innerText(),/보고 대기/);console.log('PASS native live keyboard duel:',actual);
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
