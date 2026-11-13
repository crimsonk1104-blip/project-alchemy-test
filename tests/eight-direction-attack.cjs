// Run: node tests/eight-direction-attack.cjs (requires Playwright and Chromium).
// Instrument only the browser response; production keeps its state private.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const html = fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8');
    await page.route('http://alchemy.test/', route => route.fulfill({contentType:'text/html',body:html.replace('  preload().catch(error=>{',
      `  window.testGame={reset,attack,movement,update,drawPlayer,newEnemy,inStrike,keys,get state(){return state;},MELEE};
  preload().catch(error=>{`)}));
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('http://alchemy.test/');
    await page.waitForFunction(() => document.querySelector('#stage-loading').classList.contains('hidden'));
    const results = await page.evaluate(() => {
      const g=window.testGame,check=(ok,label)=>{if(!ok)throw Error(label);};
      const combinations=[['right'],['right','down'],['down'],['left','down'],['left'],['left','up'],['up'],['right','up']];
      for(const keys of combinations){
        g.reset();keys.forEach(k=>g.keys.add(k));
        const x=Number(keys.includes('right'))-Number(keys.includes('left'));
        const y=Number(keys.includes('down'))-Number(keys.includes('up'));
        const length=Math.hypot(x,y),dx=x/length,dy=y/length,p=g.state.player;
        const start={x:p.x,y:p.y};g.movement(.1);
        check(Math.abs(Math.hypot(p.x-start.x,p.y-start.y)-17.8)<1e-8,'normalized speed');
        const front=g.newEnemy(p.x+dx*80,p.y+dy*80),back=g.newEnemy(p.x-dx*80,p.y-dy*80);
        const far=g.newEnemy(p.x+dx*105,p.y+dy*105);
        g.state.enemies=[front,back,far];g.attack();
        check(front.hp===2&&back.hp===3&&far.hp===3,'direction/range '+keys);
        check(Math.abs(front.x-(p.x+dx*96))<1e-8,'knockback');
        const strike=p.strike;
        g.attack();check(front.hp===2,'cooldown');
        g.keys.clear();g.keys.add('left');g.movement(.02);
        check(p.strike===strike&&strike.direction.x===dx&&strike.direction.y===dy,'locked strike');
        // The hit sector stays at impact; the sword follows the moving body.
        const ctx=document.querySelector('#game').getContext('2d'),calls=[];
        const originals={};for(const name of ['translate','rotate','arc']){originals[name]=ctx[name];ctx[name]=function(...args){calls.push([name,...args]);return originals[name].apply(this,args);};}
        g.drawPlayer();for(const name in originals)ctx[name]=originals[name];
        check(calls.some(c=>c[0]==='translate'&&c[1]===p.x&&c[2]===p.y-21),'sword follows body');
        check(calls.some(c=>c[0]==='translate'&&c[1]===strike.x&&c[2]===strike.y),'effect origin');
        check(calls.some(c=>c[0]==='rotate'&&c[1]===Math.atan2(dy,dx)),'effect angle');
        check(calls.some(c=>c[0]==='arc'&&c[3]===g.MELEE.range&&c[4]===-Math.acos(g.MELEE.minDot)),'effect range');
      }
      g.reset();g.keys.add('up');g.keys.add('right');g.attack();
      check(Math.abs(g.state.player.strike.direction.y+Math.SQRT1_2)<1e-12,'input before movement');
      g.update(.4);g.keys.clear();g.attack();check(Math.abs(g.state.player.strike.direction.y+Math.SQRT1_2)<1e-12,'idle aim');
      g.reset();
      for(let i=0;i<3;i++){
        const p=g.state.player,e=g.newEnemy(p.x+65,p.y);g.state.enemies=[e];
        for(let hit=0;hit<3;hit++){
          e.x=p.x+65;e.y=p.y;p.cool=0;g.attack();g.update(.01);
          check(e.hp===2-hit,'three-hit slime combat');
        }
      }
      check(g.state.kills===3&&g.state.questDone&&g.state.level===2&&g.state.xp===15,'kills/xp/level/quest');
      g.reset();const p=g.state.player;g.state.enemies=[g.newEnemy(p.x+30,p.y)];g.update(.01);check(p.hp===91,'slime damage');
      g.update(.1);check(p.hp===91,'damage invulnerability');
      g.reset();check(g.state.player.hp===100&&g.state.kills===0&&g.state.xp===0&&g.state.level===1&&!g.state.questDone,'restart');
      return {directions:8,checks:'speed, hits, misses, range, knockback, cooldown, locked effect geometry, immediate input, idle aim, progression, slime damage'};
    });
    assert.deepEqual(errors,[]);
    console.log('PASS',results);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
