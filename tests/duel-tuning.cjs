const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});try{
 const current=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8');
 const baseline=cp.execFileSync('git',['show','bd6de267666873b3b829dfc9b68e3f098aa094fb:v0.2.html'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
 const results={};
 for(const [version,html] of [['before',baseline],['after',current]]){
  const p=await browser.newPage();await p.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',`window.tune={selectRegion,update,hitByAutomaton,updateAutomaton,inStrike,automatonStrikeHits,drawPlayer,AUTOMATON_PATTERNS,MELEE,MONSTERS,get state(){return state;}};\n  preload().catch(error=>{`)}));await p.goto('http://alchemy.test/?test=1');await p.waitForSelector('#region-dialog[open]');await p.locator('#training-btn').click();
  results[version]=await p.evaluate(()=>{
   const g=tune,counts=[],durations=[];
   for(let i=0;i<4;i++){
    g.selectRegion('training');const e=g.state.enemies[0];e.x=500;e.y=300;e.ai.index=i;e.ai.timer=0;e.hp=12;
    const d=[50,100,200,180][i];g.state.player.x=e.x-d;g.state.player.y=e.y;g.state.player.invuln=1000;
    for(let frame=0;frame<1000;frame++)g.update(.01);
    counts.push(e.ai.used[i]);durations.push(g.AUTOMATON_PATTERNS[i].windup+g.AUTOMATON_PATTERNS[i].recovery);
   }
   return {counts,cycles:durations,playerRange:g.MELEE.range,playerArc:2*Math.acos(g.MELEE.minDot)*180/Math.PI,enemyRange:g.AUTOMATON_PATTERNS[0].range,speed:g.MONSTERS.automaton.speed};
  });
  if(version==='after')await p.evaluate(()=>{
   const g=tune,check=(ok,m)=>{if(!ok)throw Error(m);},strike={x:400,y:300,direction:{x:1,y:0}};
   check(g.inStrike(strike,{x:469,y:300})&&!g.inStrike(strike,{x:471,y:300}),'player 70 range boundary');
   const polar=degrees=>({x:400+60*Math.cos(degrees*Math.PI/180),y:300+60*Math.sin(degrees*Math.PI/180)});
   check(g.inStrike(strike,polar(44))&&!g.inStrike(strike,polar(46)),'player 90-degree arc');
   const enemy={index:0,x:400,y:300,vx:1,vy:0};check(g.automatonStrikeHits(enemy,{x:469,y:300})&&!g.automatonStrikeHits(enemy,{x:471,y:300}),'enemy same sword range');check(!g.automatonStrikeHits(enemy,polar(46)),'enemy arc');
   check(g.automatonStrikeHits({...enemy,index:1},{x:600,y:300})&&!g.automatonStrikeHits({...enemy,index:1},{x:600,y:350}),'spear long narrow unchanged');
   for(const i of [2,3]){
    g.selectRegion('training');const e=g.state.enemies[0];e.ai.index=i;e.ai.mode='recovery';e.ai.timer=.25;e.x=400;e.y=300;g.state.player.x=350;g.state.player.y=300;
    g.updateAutomaton(e,.1);check(e.x>400,'ranged retreat when close');
    e.x=600;e.y=300;g.state.player.x=100;g.updateAutomaton(e,.1);check(e.x<600,'ranged approach when distant');
    e.x=23;e.y=300;g.state.player.x=80;g.updateAutomaton(e,.1);check(e.y!==300,'wall sidestep');
    e.ai.mode='recovery';e.ai.timer=.3;e.x=400;e.y=300;g.state.player.x=400;g.state.player.y=300;g.updateAutomaton(e,.1);check(e.x!==400||e.y!==300,'separate when overlapping');
    e.ai.mode='windup';e.ai.timer=.3;const fixed={x:e.x,y:e.y};g.updateAutomaton(e,.05);check(e.x===fixed.x&&e.y===fixed.y,'no moving telegraph');
   }
   g.selectRegion('training');g.state.enemies[0].ai.timer=10;g.hitByAutomaton(4);g.hitByAutomaton(6);check(g.state.player.hp===96,'no stacked damage in invulnerability window');g.update(.35);g.hitByAutomaton(6);check(g.state.player.hp===96,'reaction window preserved');g.update(.36);g.hitByAutomaton(6);check(g.state.player.hp===90,'damage resumes after reaction window');
   g.selectRegion('forest');g.state.player.attack=.2;g.state.player.strike={x:478,y:342,direction:{x:1,y:0}};
   const ctx=document.querySelector('#game').getContext('2d'),draw=ctx.drawImage,clip=ctx.clip;let imageSize=null,clipped=false;
   ctx.drawImage=function(...args){if(args[0].width===128&&args[0].height===32)imageSize=args.slice(-2);return draw.apply(this,args);};ctx.clip=function(...args){clipped=true;return clip.apply(this,args);};
   g.drawPlayer();ctx.drawImage=draw;ctx.clip=clip;check(clipped&&imageSize[0]===70&&imageSize[1]===70,'slash scaled and clipped to hit geometry');
  });
  await p.close();
 }
 for(let i=0;i<4;i++)assert.ok(results.after.counts[i]>results.before.counts[i],'attack frequency must increase '+i);
 console.log('PASS 10 simulated seconds per weapon (stationary invulnerable target):',JSON.stringify(results,null,2));console.log('PASS range/angle boundaries, spear distinction, slash footprint, ranged spacing/edge handling, fixed windup');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
