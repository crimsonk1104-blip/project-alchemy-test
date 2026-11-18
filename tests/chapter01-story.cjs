const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');

const ctx={};require('vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../story-data.js'),'utf8'),ctx);
// Approved dialogue as verified against the private reference; do not change without script approval.
for(const [i,expected] of [[2,"c4143dba01a8c75dad9ed5c33dcdbffee3775f048dfa0654f08e2f3b3a8049c1"],[3,"71adfc857b36b60e01e6ec62557f0797f0c2522c4f8cbbecd184db71acf79bd3"],[5,"580148d2719ec7c5bf1d8d7ebd6a59aa5a621e23cde59e0c1f6b748fc6a3d8e1"],[6,"687f2422652fa59ae6e37b4cb13160a6ccf597b5729018c340f8474739325cad"],[7,"0c2b4ebfcc5639d85d789d5e2b8dff44371ddc37b722da9f104134a2b8250670"],[8,"18619619354e59739c42c2b4e9e19bb37a1e18ce613354e427024c90fb116068"]])assert.equal(crypto.createHash('sha256').update(JSON.stringify(ctx.ALCHEMY_STORY.scenes[i].lines)).digest('hex'),expected);

(async()=>{const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});try{
const html=fs.readFileSync(path.join(__dirname,'../v0.2.html'),'utf8');const body=html.replace('  preload().catch(error=>{',`window.chapter={selectRegion,update,attack,updateGroundAim,beginGroundAim,finishGroundAim,prepareEvaluationReport,draw,get state(){return state;},get data(){return STORY;}};\n  preload().catch(error=>{`);
for(const [index,weapon] of ['sword','spear','bow','staff'].entries()){
 const c=await b.newContext({viewport:[{width:1280,height:800},{width:360,height:640},{width:820,height:1180},{width:844,height:390}][index],hasTouch:true,isMobile:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{requestAnimationFrame=()=>0;performance.now=()=>0;});await p.route('http://alchemy.test/**',r=>r.fulfill({contentType:'text/html',body}));await p.goto('http://alchemy.test');await p.waitForSelector('#story-next');if(index===1||index===2){await p.locator('#region-close').tap();await p.locator('#play-mode-btn').tap();await p.locator('#region-btn').tap();}
 // Skip must stop at required name and weapon, never silently fill either.
 while(!await p.locator('#story-name').count())await p.locator('#story-skip').tap();await p.locator('#story-name-confirm').tap();assert.equal(await p.evaluate(()=>chapter.state.story.name),'');await p.locator('#story-name').fill('연구자'+index);await p.locator('#story-name-confirm').tap();
 while(!await p.locator('#story-weapon-'+weapon).count())await p.locator('#story-skip').tap();await p.locator('#story-weapon-'+weapon).tap();assert.equal(await p.evaluate(()=>chapter.state.inventory.equipment[chapter.state.equipment.weapon]),1);assert.equal(await p.evaluate(()=>chapter.state.activeWeapon),weapon);
 while(!await p.locator('#story-ready-0').count())await p.locator('#story-skip').tap();await p.locator('#story-ready-'+(index%3)).tap();while(await p.locator('#story-next').isVisible())await p.locator('#story-next').tap();
 assert.equal(await p.evaluate(()=>chapter.state.area),'training');
 // A loss and real UI retry must keep identity, ownership, chosen style and level.
 await p.evaluate(()=>{chapter.state.player.hp=0;chapter.update(.01);});await p.locator('#region-btn').tap();await p.locator('#story-fight').tap();assert.equal(await p.evaluate(()=>chapter.state.story.name),'연구자'+index);assert.equal(await p.evaluate(()=>chapter.state.activeWeapon),weapon);assert.equal(await p.evaluate(()=>chapter.state.player.hp),100);
 // Controlled positioning, actual attack requests and AI ticks through every protected phase.
 await p.evaluate(()=>{
  const g=chapter,e=g.state.enemies[0],s=g.state,p=s.player;
  for(let phase=0;phase<4;phase++){
   for(let f=0;f<120&&e.ai.used[phase]===0;f++){p.invuln=10;g.update(.04);}
   if(!e.ai.used[phase])throw Error('unobserved pattern');
   for(let hit=0;hit<4&&e.hp>e.maxHp*(1-(phase+1)/4);hit++){
    e.x=p.x+50;e.y=p.y;p.aim={x:1,y:0};p.cool=0;
    if(s.activeWeapon==='staff'){g.beginGroundAim('test');g.finishGroundAim('test');}else g.attack();
    for(let frame=0;frame<15;frame++){p.invuln=10;g.update(.04);}
   }
  }
 });
 assert.equal(await p.evaluate(()=>chapter.state.evaluation.status),'objectiveMet');assert.equal(await p.evaluate(()=>chapter.state.kills),0);
 await p.locator('#evaluation-return-btn').tap();assert.equal(await p.evaluate(()=>chapter.state.evaluation.status),'awaitingReport');await p.locator('#story-report').tap();let acceptance=false;
 while(await p.evaluate(()=>chapter.state.story.phase)!=='complete'){
  const line=await p.locator('#story-speech').innerText();if(line.includes('합격이지. 뭘 그렇게 긴장해?'))acceptance=true;
  await p.locator('#story-next').tap();
 }
 assert.ok(acceptance);assert.equal(await p.evaluate(()=>chapter.state.evaluation.status),'complete');assert.equal(await p.evaluate(()=>chapter.state.story.cabinet),true);
 const inventory=await p.evaluate(()=>chapter.state.inventory);assert.equal(Object.keys(inventory.equipment).length,4);assert.ok(Object.values(inventory.equipment).every(n=>n===1));
 await p.locator('#story-weapon-bow').tap();await p.locator('#story-weapon-bow').tap();assert.deepEqual(await p.evaluate(()=>chapter.state.inventory),inventory);
 await p.screenshot({path:'/tmp/chapter01-'+weapon+'.png'});await p.locator('#story-cabinet').tap();assert.ok(await p.locator('#inventory-dialog').isVisible());await p.locator('#inventory-close').tap();assert.deepEqual(errors,[]);
 console.log('PASS CH01 name/choice/skip, '+weapon+' real attacks vs four phases, failure/retry, report, exact acceptance, cabinet, no duplicate exchange, mobile UI');await c.close();
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
