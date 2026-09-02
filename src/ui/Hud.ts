import type{GameController}from'../game/controller';
import{nextExperienceCost}from'../game/ball-progression';
import{createPlayerFighter,type Fighter}from'../game/battle';
import{BOMB_DATA,unitCardCount}from'../game/cards';
import type{BallClass,BallForm,CardInstance,PegQuality,PegType,RunState,ShopSlot}from'../game/model';
import{createLaunchResult,ECHO_EFFECT,GUARD_EFFECT,HASTE_EFFECT,POWER_EFFECT,SPRING_EFFECT}from'../game/peg-grid';
import{populationProgress,QUALITY_XP}from'../game/shop';
import{roundUnitPreviews}from'../game/unit-previews';

const CLASS_NAME:Record<BallClass,string>={warrior:'战士',mage:'术士',archer:'弓手'};
const CLASS_ICON:Record<BallClass,string>={warrior:'⚔',mage:'✦',archer:'➶'};
const CLASS_COLOR_CSS:Record<BallClass,string>={warrior:'#d45846',mage:'#726de8',archer:'#55a863'};
const CLASS_DESC:Record<BallClass,string>={warrior:'近战前排 · 生命 120 · 攻击 12 · 射程 1',mage:'远程爆发 · 生命 70 · 攻击 16 · 射程 3',archer:'高速远程 · 生命 80 · 攻击 11 · 射程 3'};
const PEG_NAME:Record<Exclude<PegType,'normal'>,string>={experience:'经验钉',power:'力量钉',haste:'疾速钉',guard:'守护钉',echo:'回响钉',spring:'弹簧钉',multiplier:'倍率钉',teleport:'传送钉'};
const PEG_ICON:Record<Exclude<PegType,'normal'>,string>={experience:'验',power:'攻',haste:'速',guard:'盾',echo:'响',spring:'弹',multiplier:'倍',teleport:'传'};
const QUALITY_NAME:Record<PegQuality,string>={common:'普通',rare:'稀有',epic:'史诗',legendary:'传说'};
const QUALITY_CSS:Record<PegQuality,string>={common:'#e8e5dc',rare:'#5ba7ff',epic:'#c873ff',legendary:'#ffa63d'};
const PHASE_NAME:Record<RunState['phase'],string>={SHOP:'整备',LAUNCHING:'整备',TRANSFERRING:'整备',BATTLE:'战斗',RUN_END:'结算'};
const FORM_NAME:Record<BallForm,string>={warrior:'战士',knight:'骑士',general:'将军',commander:'统帅',lord:'领主',mage:'术士',wizard:'法师',elementalist:'元素师',magus:'魔导师',archmage:'大魔法师',archer:'弓手',crossbowman:'弩手',ranger:'游侠',sharpshooter:'神射手',hawkeye:'鹰眼射手'};
type GrowthStats=Pick<Fighter,'attack'|'maxHp'|'attackEveryMs'|'range'|'shield'>;

export class Hud{
  private hud=document.querySelector<HTMLElement>('#hud')!;
  private growth=document.querySelector<HTMLElement>('#growth-panel')!;
  private modal=document.querySelector<HTMLElement>('#modal-root')!;
  private reduced=localStorage.getItem('pk-reduced')==='1';
  private lastLevel:number;private lastXp:number;private lastGold:number;
  private growthStats=new Map<string,GrowthStats>();
  private liftedCard?:{view:HTMLElement;placeholder:HTMLElement};
  constructor(private c:GameController){
    const snapshot=c.snapshot();this.lastLevel=snapshot.population.level;this.lastXp=snapshot.population.xp;this.lastGold=snapshot.gold;
    c.subscribe(state=>this.render(state));window.addEventListener('pk-growth-hit',(event:Event)=>{const id=(event as CustomEvent<string>).detail;this.renderGrowth(this.c.snapshot(),id);this.pulseGrowth(id)});
  }
  private action(fn:()=>void){try{fn()}catch(error){this.toast(error instanceof Error?error.message:'操作失败')}}
  private toast(text:string){const view=document.createElement('div');view.className='toast';view.textContent=text;document.body.append(view);setTimeout(()=>view.remove(),1600)}
  private pegDescription(type:Exclude<PegType,'normal'>,quality:PegQuality){
    if(type==='experience')return'无额外效果，只提供碰撞经验';if(type==='power')return`本局攻击 +${Math.round(POWER_EFFECT[quality]*100)}%`;if(type==='haste')return`本局攻速 +${Math.round(HASTE_EFFECT[quality]*100)}%`;if(type==='guard')return`获得最大生命 ${Math.round(GUARD_EFFECT[quality]*100)}% 护盾`;if(type==='spring')return`碰撞冲力 ×${SPRING_EFFECT[quality]}`;if(type==='echo')return`下一次特殊效果总计触发 ${ECHO_EFFECT[quality]} 次`;if(type==='multiplier')return`单位球经验倍率 ×${quality==='legendary'?2:1.5}`;return quality==='legendary'?'传送到上方并附加强力冲力':'传送到训练场上方';
  }
  private itemPresentation(slot:ShopSlot){
    const item=slot.item;
    if(item.kind==='unit')return{icon:CLASS_ICON[item.ballClass],name:`${CLASS_NAME[item.ballClass]}小球卡`,description:`【单位】${CLASS_DESC[item.ballClass]}`,css:'unit-card',quality:undefined};
    if(item.kind==='peg')return{icon:PEG_ICON[item.pegType],name:`${QUALITY_NAME[item.quality]} · ${PEG_NAME[item.pegType]}`,description:`碰撞基础 ${QUALITY_XP[item.quality]} EXP · ${this.pegDescription(item.pegType,item.quality)}`,css:'peg-card',quality:item.quality};
    const data=BOMB_DATA[item.quality],experience=item.kind==='experience-bomb';
    return{icon:experience?'EXP':'×',name:`${QUALITY_NAME[item.quality]} · ${experience?'经验爆弹':'倍率爆弹'}`,description:`扇形发射 ${data.projectiles} 枚 · 命中钉位${experience?` +${data.experienceBonus} EXP`:`经验 ×${data.multiplier}`}`,css:'bomb-card',quality:item.quality};
  }
  private shopCard(slot:ShopSlot,index:number,state:RunState){
    const item=slot.item,p=this.itemPresentation(slot),full=item.kind==='unit'&&unitCardCount(state.cards)>=state.population.level,disabled=slot.sold||state.phase!=='SHOP'||state.gold<item.price||full;
    return`<article class="shop-card ${p.css} ${slot.sold?'sold':''} ${disabled?'disabled':''}" data-slot="${index}" tabindex="0" style="${p.quality?`--quality:${QUALITY_CSS[p.quality]}`:''}">
      <button class="lock ${slot.locked?'active':''}" data-lock="${index}" title="锁定此格">${slot.locked?'🔒':'◇'}</button>
      <div class="item-icon">${p.icon}</div><div class="item-copy"><b>${p.name}</b><small>${slot.sold?'已售出':full?'人口已满':'点击购买卡牌'}</small></div><div class="price">● ${item.price}</div>
      <div class="shop-tooltip" role="tooltip"><b>${p.name}</b><span>${p.description}</span></div>
    </article>`;
  }
  private cardPresentation(card:CardInstance){
    if(card.kind==='unit'){const ballClass=card.ballClass!;return{icon:CLASS_ICON[ballClass],name:`${CLASS_NAME[ballClass]}小球`,keyword:'单位',description:CLASS_DESC[ballClass],quality:undefined,css:'unit-card'}};
    if(card.kind==='peg'){const quality=card.quality!,pegType=card.pegType!;return{icon:PEG_ICON[pegType],name:PEG_NAME[pegType],keyword:QUALITY_NAME[quality],description:this.pegDescription(pegType,quality),quality,css:'peg-card'}};
    const quality=card.quality!,data=BOMB_DATA[quality],experience=card.kind==='experience-bomb';
    return{icon:experience?'EXP':'×',name:experience?'经验爆弹':'倍率爆弹',keyword:QUALITY_NAME[quality],description:`${data.projectiles} 枚扇形弹丸；命中钉位${experience?` +${data.experienceBonus} 经验`:` ×${data.multiplier} 经验`}`,quality,css:'bomb-card'};
  }
  private handCard(card:CardInstance,index:number,total:number,state:RunState){
    const p=this.cardPresentation(card),offset=index-(total-1)/2,usable=state.phase==='SHOP'&&state.cardRound[card.id]==='available';
    return`<article class="hand-card ${p.css}" draggable="${usable}" tabindex="0" data-card-id="${card.id}" style="--offset:${offset};--order:${index};${p.quality?`--quality:${QUALITY_CSS[p.quality]}`:''}">
      <div class="hand-cost">◆</div><div class="hand-icon">${p.icon}</div><b>${p.name}</b><div class="keywords">【${p.keyword}】${card.consumable?'【消耗】':''}</div><p>${p.description}</p>
    </article>`;
  }
  private liftHandCard(view:HTMLElement){
    if(this.liftedCard?.view===view||view.classList.contains('dragging'))return;
    const layer=this.hud.querySelector<HTMLElement>('.hand-hover-layer'),zone=this.hud.querySelector<HTMLElement>('.hand-zone');if(!layer||!zone||!view.parentElement)return;
    this.restoreLiftedCard();const viewRect=view.getBoundingClientRect(),zoneRect=zone.getBoundingClientRect(),style=getComputedStyle(view),placeholder=document.createElement('div'),halfWidth=68;
    placeholder.className='hand-card-placeholder';placeholder.setAttribute('aria-hidden','true');placeholder.style.width=style.width;placeholder.style.height=style.height;placeholder.style.flexBasis=style.flexBasis;placeholder.style.marginLeft=style.marginLeft;view.before(placeholder);
    this.liftedCard={view,placeholder};view.classList.add('hand-card-lifted');view.style.left=`${Math.max(halfWidth,Math.min(zoneRect.width-halfWidth,viewRect.left+viewRect.width/2-zoneRect.left))}px`;layer.append(view);
    placeholder.addEventListener('pointerleave',()=>this.restoreLiftedCardWhenInactive(view));
  }
  private restoreLiftedCardWhenInactive(view:HTMLElement){requestAnimationFrame(()=>{const lifted=this.liftedCard;if(!lifted||lifted.view!==view||view.classList.contains('dragging'))return;if(!view.matches(':hover,:focus-visible')&&!lifted.placeholder.matches(':hover'))this.restoreLiftedCard()})}
  private restoreLiftedCard(){const lifted=this.liftedCard;if(!lifted)return;this.liftedCard=undefined;lifted.view.classList.remove('hand-card-lifted');lifted.view.style.removeProperty('left');if(lifted.placeholder.isConnected)lifted.placeholder.replaceWith(lifted.view);else lifted.view.remove()}
  private usedCardDetails(state:RunState){
    const statusName={used:'已使用',invalidated:'已覆盖',equipped:'已装配'}as const;
    return Object.entries(state.cardRound).flatMap(([id,status])=>{
      if(status!=='used'&&status!=='invalidated'&&status!=='equipped')return[];
      const card=state.roundUsedCards[id]??state.cards.find(value=>value.id===id);if(!card)return[];
      const presentation=this.cardPresentation(card);
      return[{id,name:presentation.name,status:statusName[status],icon:presentation.icon}];
    });
  }

  private render(state:RunState){
    this.restoreLiftedCard();
    const shopPhase=state.phase==='SHOP',progress=populationProgress(state.population),unitCount=unitCardCount(state.cards),reason=this.c.startBlockReason();
    const leveledUp=state.population.level>this.lastLevel,xpGained=state.population.xp>this.lastXp,goldGained=state.gold>this.lastGold;this.lastLevel=state.population.level;this.lastXp=state.population.xp;this.lastGold=state.gold;
    const hand=this.c.hand(),used=this.usedCardDetails(state);
    this.hud.innerHTML=`
      <div class="hud-top"><div class="brand">♛ 弹珠王国</div><div class="hud-chip gold-chip">● <b>${state.gold}</b></div><div class="hud-chip">第 <b>${state.stage}</b>/10 关 · ${this.c.encounter().name}</div><div class="hud-chip phase">${PHASE_NAME[state.phase]}</div><div class="hud-spacer"></div>
        <div class="pop-box"><b>人口 ${unitCount}/${state.population.level}</b><small>${progress.max?'MAX':`经验 ${progress.current}/${progress.required}`}</small></div>
        <button id="population" class="hud-button secondary" ${!shopPhase||state.gold<4||progress.max?'disabled':''}>+4 人口经验 · 4</button><button id="reroll" class="hud-button secondary" ${!shopPhase||state.gold<state.shop.rerollCost?'disabled':''}>刷新 · ${state.shop.rerollCost}</button>
        <button id="start" class="hud-button danger" ${reason?'disabled':''} title="${reason??'进入战斗'}">▶ 开始远征${reason?`<small>${reason}</small>`:''}</button><button id="motion" class="motion">动效 ${this.reduced?'低':'满'}</button></div>
      <div class="shop-row"><div class="shop-label">战备商店<small>购买后进入手牌</small></div>${state.shop.slots.map((slot,index)=>this.shopCard(slot,index,state)).join('')}</div>
      <section class="hand-zone" aria-label="手牌"><div class="used-pile" tabindex="0" aria-label="查看本局已使用卡牌">本局已用<b>${used.length}</b><div class="used-popover" role="tooltip"><strong>本局已使用牌堆</strong>${used.length?used.map(card=>`<span><i>${card.icon}</i><b>${card.name}</b><em>${card.status}</em></span>`).join(''):'<small>当前牌堆为空</small>'}</div></div><div class="hand-scroll"><div class="hand-fan ${hand.length>16?'very-dense':hand.length>10?'dense':''}">${hand.map((card,index)=>this.handCard(card,index,hand.length,state)).join('')||'<div class="hand-empty">本局可用手牌为空</div>'}</div></div><div class="hand-hover-layer"></div></section>`;
    this.hud.querySelector('#population')?.addEventListener('click',()=>this.action(()=>this.c.buyPopulationExperience()));this.hud.querySelector('#reroll')?.addEventListener('click',()=>this.action(()=>this.c.reroll()));this.hud.querySelector('#start')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('pk-start')));
    this.hud.querySelector('#motion')?.addEventListener('click',()=>{this.reduced=!this.reduced;localStorage.setItem('pk-reduced',this.reduced?'1':'0');window.dispatchEvent(new CustomEvent('pk-motion',{detail:this.reduced}));this.render(state)});
    this.hud.querySelectorAll<HTMLElement>('.shop-card:not(.sold)').forEach(card=>card.addEventListener('click',event=>{if((event.target as HTMLElement).closest('.lock'))return;this.action(()=>this.c.buyItem(Number(card.dataset.slot)))}));
    this.hud.querySelectorAll<HTMLElement>('[data-lock]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();this.action(()=>this.c.toggleShopLock(Number(button.dataset.lock)))}));
    this.hud.querySelectorAll<HTMLElement>('.hand-card').forEach(view=>{
      view.addEventListener('pointerenter',()=>this.liftHandCard(view));view.addEventListener('pointerleave',()=>this.restoreLiftedCardWhenInactive(view));view.addEventListener('focus',()=>requestAnimationFrame(()=>{if(view.matches(':focus-visible'))this.liftHandCard(view)}));view.addEventListener('blur',()=>this.restoreLiftedCardWhenInactive(view));
      view.addEventListener('dragstart',event=>{const card=this.c.card(view.dataset.cardId!);if(!card){event.preventDefault();return}(event as DragEvent).dataTransfer?.setData('text/plain',card.id);window.dispatchEvent(new CustomEvent('pk-card-drag-start',{detail:{cardId:card.id,kind:card.kind}}));view.classList.add('dragging')});
      view.addEventListener('dragend',()=>{view.classList.remove('dragging');this.restoreLiftedCard();window.dispatchEvent(new CustomEvent('pk-card-drag-end'))});
    });
    this.hud.querySelector('.hand-scroll')?.addEventListener('scroll',()=>this.restoreLiftedCard(),{passive:true});
    const popBox=this.hud.querySelector<HTMLElement>('.pop-box');if(popBox&&(leveledUp||xpGained)){popBox.classList.add(leveledUp?'pop-level-up':'pop-xp');popBox.addEventListener('animationend',()=>popBox.classList.remove('pop-level-up','pop-xp'),{once:true})}
    const goldChip=this.hud.querySelector<HTMLElement>('.gold-chip');if(goldChip&&goldGained){goldChip.classList.add('gold-up');goldChip.addEventListener('animationend',()=>goldChip.classList.remove('gold-up'),{once:true})}
    if(state.phase==='RUN_END')this.results(state);else this.modal.innerHTML='';this.renderGrowth(state);
  }
  private renderGrowth(state:RunState,hitId?:string){
    const previews=roundUnitPreviews(state),ids=new Set(previews.map(preview=>preview.unit.id));for(const id of this.growthStats.keys())if(!ids.has(id))this.growthStats.delete(id);
    const rows=previews.map(({unit:ball,inFlight})=>{const result=state.launchResults[ball.id]??createLaunchResult(ball.id),cost=nextExperienceCost(ball),ratio=cost?Math.min(1,ball.xp/cost):1,fighter=createPlayerFighter(ball,result),stats:GrowthStats={attack:fighter.attack,maxHp:fighter.maxHp,attackEveryMs:fighter.attackEveryMs,range:fighter.range,shield:fighter.shield},previous=this.growthStats.get(ball.id),hot=(key:keyof GrowthStats)=>hitId===ball.id&&previous!==undefined&&previous[key]!==stats[key]?'stat-hot':'';this.growthStats.set(ball.id,stats);
      return`<article class="growth-unit ${inFlight?'in-flight':''}" data-ball-id="${ball.id}" style="--unit:${CLASS_COLOR_CSS[ball.class]};--progress:${ratio*100}%"><div class="growth-unit-head"><span class="growth-unit-icon">${CLASS_ICON[ball.class]}</span><b>${FORM_NAME[ball.form]}</b><em>${inFlight?'飞行中':'已部署'}</em><span class="growth-stars">${'★'.repeat(ball.star)}</span></div><div class="growth-values"><span>${cost?`${ball.xp} / ${cost} EXP`:'成长完成'}</span>${result.xpMultiplier>1?`<strong>×${result.xpMultiplier.toFixed(2)}</strong>`:''}</div><div class="growth-bar"><i></i></div><div class="growth-stats"><span class="${hot('attack')}"><i>攻</i>${fighter.attack}</span><span class="${hot('maxHp')}"><i>命</i>${fighter.maxHp}</span><span class="${hot('attackEveryMs')}"><i>速</i>${(1000/fighter.attackEveryMs).toFixed(2)}</span><span class="${hot('range')}"><i>距</i>${fighter.range}</span><span class="${hot('shield')}"><i>盾</i>${fighter.shield}</span></div></article>`}).join('');
    this.growth.innerHTML=`<div class="growth-title"><b>本局部署单位</b><small>小球落底后自动入位</small></div><div class="growth-list">${rows||'<div class="growth-empty">从手牌发射【单位】卡</div>'}</div>`;
  }
  private pulseGrowth(id:string){const row=[...this.growth.querySelectorAll<HTMLElement>('.growth-unit')].find(view=>view.dataset.ballId===id);if(!row)return;row.classList.remove('growth-hit');void row.offsetWidth;row.classList.add('growth-hit')}
  private results(state:RunState){const maxStar=state.balls.length?Math.max(...state.balls.map(ball=>ball.star)):0,totalXp=state.balls.reduce((sum,ball)=>sum+ball.xp,0);this.modal.innerHTML=`<section class="modal"><h2>${state.result==='victory'?'王国得救了！':'远征失败'}</h2><p>${state.result==='victory'?'腐化国王已经倒下。':'调整卡牌与钉子的构筑，再来一次。'}</p><div class="modal-grid"><div class="modal-stat">到达关卡<br><b>${state.stage}/10</b></div><div class="modal-stat">持有卡牌<br><b>${state.cards.length}</b></div><div class="modal-stat">最高星级<br><b>${maxStar} 星</b></div><div class="modal-stat">当前经验<br><b>${totalXp}</b></div></div><button id="restart" class="hud-button danger">重新开始</button></section>`;this.modal.querySelector('#restart')?.addEventListener('click',()=>this.c.restart())}
}
