  // Scene progression is separate from dialogue data and combat simulation.
  const STORY=globalThis.ALCHEMY_STORY;
  const STARTERS={sword:{id:'starterSword',name:'초기 지급 검'},spear:{id:'starterSpear',name:'초기 지급 창'},bow:{id:'starterBow',name:'초기 지급 활'},staff:{id:'starterStaff',name:'초기 지급 지팡이 · 시약 투척 시험'}};
  function starterStyle(id){return Object.keys(STARTERS).find(k=>STARTERS[k].id===id);}
  function grantStarter(style){const item=STARTERS[style];if(!item)return;state.inventory.equipment[item.id]=1;}
  function chooseStarter(style){
    if(state.area!=='lobby'||!state.story?.name||!STARTERS[style])return false;
    // One initial grant, or an exchange: previous starter is returned, never duplicated.
    if(!state.story.cabinet){for(const item of Object.values(STARTERS))delete state.inventory.equipment[item.id];}
    grantStarter(style);state.story.weapon=style;state.equipment.weapon=STARTERS[style].id;
    selectTrialWeapon(style);updateUi();return true;
  }
  function renderStory(){
    const host=$('story-ui');if(!host||!state)return;host.replaceChildren();
    const q=state.story,scene=STORY.scenes[q.scene];
    $('combat-sandbox').hidden=q.started;
    $('research-room').setAttribute('aria-label','연구소 내부 · 소장과 제자 임시 표현 · 보관함 '+(q.cabinet?'개방':'잠김'));
    if(state.area!=='lobby')storyButton(host,'story-to-lobby','연구소로 돌아가기',()=>{selectRegion('lobby');openRegionMenu();});
    const title=document.createElement('h3');title.textContent='CHAPTER 01 · 수상한 면접';host.append(title);
    $('story-locker').textContent=q.cabinet?'▣ 장비 보관함 · 개방':'▣ 장비 보관함 · 잠김';$('story-locker').classList.toggle('unlocked',q.cabinet);
    const status=document.createElement('p');status.textContent=q.phase==='complete'?'프롤로그 완료 · 다음 임무: 이상한 측정값':`${scene.title} · ${scene.approval}`;if(q.name)status.textContent+=' · 모험가 '+q.name;host.append(status);
    const text=(value)=>{const p=document.createElement('p');p.textContent=value;host.append(p);};
    if(q.phase==='evaluation'){
      if(state.evaluation.status==='objectiveMet'){storyButton(host,'story-return','연구소로 복귀',prepareEvaluationReport);return;}
      text(state.player.hp<=0?STORY.retry:'뒤뜰에서 자동인형의 네 공격 패턴을 관찰하고 실전 평가를 마치세요.');
      storyButton(host,'story-fight',state.player.hp<=0?'현재 무기로 재도전':'뒤뜰 훈련장 입장',()=>selectRegion('training'));if(state.area==='lobby')renderStarterChoices(host,true);return;
    }
    if(q.phase==='report'){
      text('평가 목표 달성 · 소장에게 결과를 보고하세요.');
      storyButton(host,'story-report','소장에게 보고',()=>{q.scene=5;q.line=0;q.phase='dialogue';renderStory();});return;
    }
    if(q.phase==='complete'){
      text('장비 보관함 개방 · 초기 지급 장비 무료 교환 가능. 강화 기능은 아직 없습니다.');
      renderStarterChoices(host,true);storyButton(host,'story-cabinet','장비 보관함 열기',()=>{closeRegionMenu();openInventory();});storyButton(host,'story-forest','연금의 숲 · 별도 슬라임 퀘스트',()=>selectRegion('forest'));return;
    }
    if(q.reselectWeapon){text('전투 전 무기 변경 · 선택 후 준비 화면으로 돌아갑니다.');renderStarterChoices(host,true);return;}
    const line=q.reply?{speaker:'소장',text:q.reply}:scene.lines[q.line];
    $('story-director').classList.toggle('talking',line.speaker==='소장');$('story-disciple').classList.toggle('talking',line.speaker==='제자');
    if(line.kind==='name'){
      const label=document.createElement('label');label.textContent='지원서 · 모험가 이름 (실명 대신 별명, 1~16자)';label.htmlFor='story-name';host.append(label);
      const input=document.createElement('input');input.id='story-name';input.maxLength=16;input.value=q.name;input.autocomplete='off';host.append(input);
      storyButton(host,'story-name-confirm','이름 제출',()=>{const name=input.value.trim();if(!name){input.setCustomValidity('모험가 이름을 입력하세요.');input.reportValidity();return;}q.name=name;q.line++;renderStory();});return;
    }
    if(line.kind==='weapon'){
      text('초기 지급 장비 선택 · 직업을 고정하지 않습니다. 강화 전 무료 교환 구조이며 강화는 미구현입니다.');
      text('대본의 네 번째 선택지는 지팡이입니다. 현재 전투는 시약병 투척 시험으로 연결됩니다. 대본 수정은 검토 대기입니다.');renderStarterChoices(host,false);return;
    }
    if(line.kind==='ready'){
      ['네! 바로 해보겠습니다.','그... 조금 긴장되는데요.','다른 무기도 써봐도 되죠?'].forEach((value,i)=>storyButton(host,'story-ready-'+i,value,()=>{q.pendingWeaponChange=i===2;q.reply=STORY.readyReplies[i];renderStory();}));return;
    }
    const speech=document.createElement('p');speech.id='story-speech';speech.textContent=`${line.speaker}: ${line.text}`;speech.setAttribute('aria-live','polite');host.append(speech);
    storyButton(host,'story-prev','이전 대사',()=>{if(!q.reply&&q.line>0&&!scene.lines[q.line-1].kind)q.line--;renderStory();});
    const readyToFight=q.scene===4&&!q.reply&&q.line===scene.lines.length-1;
    storyButton(host,'story-next',readyToFight?'실전 평가 시작':'다음',()=>advanceStory(false));storyButton(host,'story-skip','장면 건너뛰기',()=>advanceStory(true)).disabled=readyToFight;
  }
  function storyButton(host,id,label,action){const b=document.createElement('button');b.type='button';b.className='tool-btn';b.id=id;b.textContent=label;b.addEventListener('click',action);host.append(b);return b;}
  function renderStarterChoices(host,exchange){
    for(const [style,item] of Object.entries(STARTERS)){const button=storyButton(host,'story-weapon-'+style,`${item.name} · ${style==='sword'?'근접 베기':style==='spear'?'긴 직선 찌르기':style==='bow'?'화살 투사체':'누르기·조준·놓기 범위 공격'}`,()=>{
      if(!chooseStarter(style))return;
      if(state.story.reselectWeapon){state.story.reselectWeapon=false;}else if(!exchange){state.story.reply=STORY.weaponReplies[style];}renderStory();
    });button.disabled=state.area!=='lobby';}
  }
  function advanceStory(skip){
    const q=state.story;if(q.phase!=='dialogue'||q.reselectWeapon)return;
    if(q.pendingWeaponChange){q.pendingWeaponChange=false;q.reply=null;q.reselectWeapon=true;renderStory();return;}
    const scene=STORY.scenes[q.scene];q.started=true;
    if(q.reply){q.reply=null;q.line++;}else q.line++;
    if(skip){while(q.line<scene.lines.length&&!scene.lines[q.line].kind)q.line++;
      if(q.scene===4&&q.line>=scene.lines.length){q.line=scene.lines.length-1;renderStory();return;}
    }
    if(q.line>=scene.lines.length){
      if(q.scene===4){q.phase='evaluation';selectRegion('training');return;}
      if(q.scene===5)completeEvaluationAfterNpcReport();
      if(q.scene===6){q.cabinet=true;for(const style of Object.keys(STARTERS))grantStarter(style);}
      if(q.scene===8){q.phase='complete';renderStory();return;}
      q.scene++;q.line=0;
    }
    renderStory();
  }
