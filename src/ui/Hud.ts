import type{GameController}from'../game/controller';
import{addBallExperience,nextExperienceCost}from'../game/ball-progression';
import{createPlayerFighter,type Fighter}from'../game/battle';
import type{BallClass,BallForm,PegQuality,PegType,RunState,ShopSlot}from'../game/model';
import{createLaunchResult,ECHO_EFFECT,GUARD_EFFECT,HASTE_EFFECT,POWER_EFFECT,SPRING_EFFECT}from'../game/peg-grid';
import{populationProgress,QUALITY_XP}from'../game/shop';

const CLASS_NAME:Record<BallClass,string>={warrior:'战士球',mage:'术士球',archer:'弓手球'};
const CLASS_ICON:Record<BallClass,string>={warrior:'⚔',mage:'✦',archer:'➶'};
const CLASS_COLOR_CSS:Record<BallClass,string>={warrior:'#d45846',mage:'#726de8',archer:'#55a863'};
const CLASS_DESC:Record<BallClass,string>={warrior:'近战前排 · 生命 120 · 攻击 12 · 射程 1',mage:'远程爆发 · 生命 70 · 攻击 16 · 射程 3',archer:'高速远程 · 生命 80 · 攻击 11 · 射程 3'};
const PEG_NAME:Record<Exclude<PegType,'normal'>,string>={experience:'经验钉',power:'力量钉',haste:'疾速钉',guard:'守护钉',echo:'回响钉',spring:'弹簧钉',multiplier:'倍率钉',teleport:'传送钉'};
const PEG_ICON:Record<Exclude<PegType,'normal'>,string>={experience:'验',power:'攻',haste:'速',guard:'盾',echo:'响',spring:'弹',multiplier:'倍',teleport:'传'};
const QUALITY_NAME:Record<PegQuality,string>={common:'普通',rare:'稀有',epic:'史诗',legendary:'传说'};
const QUALITY_CSS:Record<PegQuality,string>={common:'#e8e5dc',rare:'#5ba7ff',epic:'#c873ff',legendary:'#ffa63d'};
const PHASE_NAME:Record<RunState['phase'],string>={SHOP:'整备',LAUNCHING:'发射',TRANSFERRING:'转移',BATTLE:'战斗',RUN_END:'结算'};
const FORM_NAME:Record<BallForm,string>={warrior:'战士',knight:'骑士',general:'将军',commander:'统帅',lord:'领主',mage:'术士',wizard:'法师',elementalist:'元素师',magus:'魔导师',archmage:'大魔法师',archer:'弓手',crossbowman:'弩手',ranger:'游侠',sharpshooter:'神射手',hawkeye:'鹰眼射手'};
type GrowthStats=Pick<Fighter,'attack'|'maxHp'|'attackEveryMs'|'range'|'shield'>;

export class Hud{
  private hud=document.querySelector<HTMLElement>('#hud')!;
  private growth=document.querySelector<HTMLElement>('#growth-panel')!;
  private modal=document.querySelector<HTMLElement>('#modal-root')!;
  private reduced=localStorage.getItem('pk-reduced')==='1';
  private lastLevel:number;
  private lastXp:number;
  private lastGold:number;
  private growthStats=new Map<string,GrowthStats>();
  constructor(private c:GameController){
    const snapshot=c.snapshot();
    this.lastLevel=snapshot.population.level;this.lastXp=snapshot.population.xp;this.lastGold=snapshot.gold;
    c.subscribe(state=>this.render(state));
    window.addEventListener('pk-growth-hit',(event:Event)=>{
      const id=(event as CustomEvent<string>).detail;
      this.renderGrowth(this.c.snapshot(),id);
      this.pulseGrowth(id);
    });
  }
  private action(fn:()=>void){try{fn()}catch(error){this.toast(error instanceof Error?error.message:'操作失败')}}
  private toast(text:string){const view=document.createElement('div');view.className='toast';view.textContent=text;document.body.append(view);setTimeout(()=>view.remove(),1600)}

  private pegDescription(type:Exclude<PegType,'normal'>,quality:PegQuality){
    if(type==='experience')return'无额外效果，只提供碰撞经验';
    if(type==='power')return`本轮攻击 +${Math.round(POWER_EFFECT[quality]*100)}%`;
    if(type==='haste')return`本轮攻速 +${Math.round(HASTE_EFFECT[quality]*100)}%`;
    if(type==='guard')return`获得最大生命 ${Math.round(GUARD_EFFECT[quality]*100)}% 护盾`;
    if(type==='spring')return`碰撞冲力 ×${SPRING_EFFECT[quality]}`;
    if(type==='echo')return`下一次特殊效果总计触发 ${ECHO_EFFECT[quality]} 次`;
    if(type==='multiplier')return`经验倍率 ×${quality==='legendary'?2:1.5}，冷却 ${quality==='legendary'?'0.8':'1'} 秒`;
    return quality==='legendary'?'传送到上方，并附加强力随机冲力':'传送到训练场上方安全区域';
  }

  private card(slot:ShopSlot,index:number,state:RunState){
    const item=slot.item,isBall=item.kind==='ball',full=isBall&&state.balls.length>=state.population.level;
    const icon=isBall?CLASS_ICON[item.ballClass]:PEG_ICON[item.pegType],name=isBall?CLASS_NAME[item.ballClass]:`${QUALITY_NAME[item.quality]} · ${PEG_NAME[item.pegType]}`;
    const hint=isBall?(full?'人口已满':'点击购买'):'拖到左侧钉位';
    const description=isBall?CLASS_DESC[item.ballClass]:`碰撞 +${QUALITY_XP[item.quality]} EXP · ${this.pegDescription(item.pegType,item.quality)}`;
    const disabled=slot.sold||state.phase!=='SHOP'||state.gold<item.price||full;
    return`<article class="shop-card ${isBall?'ball-card':'peg-card'} ${slot.sold?'sold':''}" data-slot="${index}" tabindex="0" style="${isBall?'':`--quality:${QUALITY_CSS[item.quality]}`}" ${!isBall&&!disabled?'draggable="true"':''}>
      <button class="lock ${slot.locked?'active':''}" data-lock="${index}" title="锁定此格">${slot.locked?'🔒':'◇'}</button>
      <div class="item-icon">${icon}</div><div class="item-copy"><b>${name}</b><small>${slot.sold?'已售出':hint}</small></div>
      <div class="price">● ${item.price}</div>
      <div class="shop-tooltip" role="tooltip"><b>${name}</b><span>${description}</span></div>
    </article>`;
  }

  private render(state:RunState){
    const shopPhase=state.phase==='SHOP',progress=populationProgress(state.population);
    const leveledUp=state.population.level>this.lastLevel,xpGained=state.population.xp>this.lastXp,goldGained=state.gold>this.lastGold;
    this.lastLevel=state.population.level;this.lastXp=state.population.xp;this.lastGold=state.gold;
    this.hud.innerHTML=`
      <div class="hud-top">
        <div class="brand">♛ 弹珠王国</div>
        <div class="hud-chip gold-chip">● <b>${state.gold}</b></div>
        <div class="hud-chip">第 <b>${state.stage}</b>/10 关 · ${this.c.encounter().name}</div>
        <div class="hud-chip phase">${PHASE_NAME[state.phase]}</div>
        <div class="hud-spacer"></div>
        <div class="pop-box"><b>人口 ${state.balls.length}/${state.population.level}</b><small>${progress.max?'MAX':`经验 ${progress.current}/${progress.required}`}</small></div>
        <button id="population" class="hud-button secondary" ${!shopPhase||state.gold<4||progress.max?'disabled':''}>+4 人口经验 · 4</button>
        <button id="reroll" class="hud-button secondary" ${!shopPhase||state.gold<state.shop.rerollCost?'disabled':''}>刷新 · ${state.shop.rerollCost}</button>
        <button id="start" class="hud-button danger" ${!shopPhase?'disabled':''}>▶ 开始远征</button>
        <button id="motion" class="motion">动效 ${this.reduced?'低':'满'}</button>
      </div>
      <div class="shop-row"><div class="shop-label">战备商店<small>球点击购买 · 钉子拖入场地</small></div>${state.shop.slots.map((slot,index)=>this.card(slot,index,state)).join('')}</div>`;
    this.hud.querySelector('#population')?.addEventListener('click',()=>this.action(()=>this.c.buyPopulationExperience()));
    this.hud.querySelector('#reroll')?.addEventListener('click',()=>this.action(()=>this.c.reroll()));
    this.hud.querySelector('#start')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('pk-start')));
    this.hud.querySelector('#motion')?.addEventListener('click',()=>{this.reduced=!this.reduced;localStorage.setItem('pk-reduced',this.reduced?'1':'0');window.dispatchEvent(new CustomEvent('pk-motion',{detail:this.reduced}));this.render(state)});
    this.hud.querySelectorAll<HTMLElement>('.ball-card:not(.sold)').forEach(card=>card.addEventListener('click',event=>{if((event.target as HTMLElement).closest('.lock'))return;this.action(()=>this.c.buyItem(Number(card.dataset.slot)))}));
    this.hud.querySelectorAll<HTMLElement>('.peg-card').forEach(card=>{
      card.addEventListener('click',event=>{if(!(event.target as HTMLElement).closest('.lock'))this.toast('把钉子卡拖到左侧任意发光钉位')});
      card.addEventListener('dragstart',event=>{const index=Number(card.dataset.slot);(event as DragEvent).dataTransfer?.setData('text/plain',String(index));window.dispatchEvent(new CustomEvent('pk-peg-drag-start',{detail:index}));card.classList.add('dragging')});
      card.addEventListener('dragend',()=>{card.classList.remove('dragging');window.dispatchEvent(new CustomEvent('pk-peg-drag-end'))});
    });
    this.hud.querySelectorAll<HTMLElement>('[data-lock]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();this.action(()=>this.c.toggleShopLock(Number(button.dataset.lock)))}));
    const popBox=this.hud.querySelector<HTMLElement>('.pop-box');
    if(popBox&&(leveledUp||xpGained)){popBox.classList.add(leveledUp?'pop-level-up':'pop-xp');popBox.addEventListener('animationend',()=>popBox.classList.remove('pop-level-up','pop-xp'),{once:true})}
    const goldChip=this.hud.querySelector<HTMLElement>('.gold-chip');
    if(goldChip&&goldGained){goldChip.classList.add('gold-up');goldChip.addEventListener('animationend',()=>goldChip.classList.remove('gold-up'),{once:true})}
    if(state.phase==='RUN_END')this.results(state);else this.modal.innerHTML='';
    this.renderGrowth(state);
  }

  private renderGrowth(state:RunState,hitId?:string){
    const ids=new Set(state.balls.map(ball=>ball.id));
    for(const id of this.growthStats.keys())if(!ids.has(id))this.growthStats.delete(id);
    const rows=state.balls.map(ball=>{
      const result=state.launchResults[ball.id],pending=result&&!state.transferredBallIds.includes(ball.id);
      const preview=pending?addBallExperience(ball,result.xp):ball,cost=nextExperienceCost(preview),ratio=cost?Math.min(1,preview.xp/cost):1,multiplier=result?.xpMultiplier??1;
      const fighter=createPlayerFighter(preview,result??createLaunchResult(ball.id));
      const stats:GrowthStats={attack:fighter.attack,maxHp:fighter.maxHp,attackEveryMs:fighter.attackEveryMs,range:fighter.range,shield:fighter.shield},previous=this.growthStats.get(ball.id);
      const hot=(key:keyof GrowthStats)=>hitId===ball.id&&previous!==undefined&&previous[key]!==stats[key]?'stat-hot':'';
      this.growthStats.set(ball.id,stats);
      return`<article class="growth-unit" data-ball-id="${ball.id}" style="--unit:${CLASS_COLOR_CSS[ball.class]};--progress:${ratio*100}%">
        <div class="growth-unit-head"><span class="growth-unit-icon">${CLASS_ICON[ball.class]}</span><b>${FORM_NAME[preview.form]}</b><span class="growth-stars">${'★'.repeat(preview.star)}</span></div>
        <div class="growth-values"><span>${cost?`${this.compact(preview.xp)} / ${cost} EXP`:'成长完成'}</span>${multiplier>1?`<strong>×${this.multiplier(multiplier)}</strong>`:''}</div>
        <div class="growth-bar"><i></i></div>
        <div class="growth-stats">
          <span class="${hot('attack')}" title="本轮最终攻击力"><i>攻</i>${fighter.attack}</span>
          <span class="${hot('maxHp')}" title="最大生命"><i>命</i>${fighter.maxHp}</span>
          <span class="${hot('attackEveryMs')}" title="每秒攻击次数"><i>速</i>${(1000/fighter.attackEveryMs).toFixed(2)}</span>
          <span class="${hot('range')}" title="攻击距离"><i>距</i>${fighter.range}</span>
          <span class="${hot('shield')}" title="本轮护盾"><i>盾</i>${fighter.shield}</span>
        </div>
      </article>`;
    }).join('');
    this.growth.innerHTML=`<div class="growth-title"><b>本轮单位成长</b><small>撞击钉子积累经验</small></div><div class="growth-list">${rows||'<div class="growth-empty">购买单位球后显示</div>'}</div>`;
  }

  private pulseGrowth(id:string){
    const row=[...this.growth.querySelectorAll<HTMLElement>('.growth-unit')].find(view=>view.dataset.ballId===id);
    if(!row)return;row.classList.remove('growth-hit');void row.offsetWidth;row.classList.add('growth-hit');
  }
  private compact(value:number){return Number.isFinite(value)?(Math.abs(value)<10000?String(Math.floor(value)):value.toExponential(2)):'∞'}
  private multiplier(value:number){return Number.isFinite(value)?(value<1000?value.toFixed(2):value.toExponential(2)):'∞'}

  private results(state:RunState){
    const maxStar=Math.max(...state.balls.map(ball=>ball.star)),totalXp=state.balls.reduce((sum,ball)=>sum+ball.xp,0);
    this.modal.innerHTML=`<section class="modal"><h2>${state.result==='victory'?'王国得救了！':'远征失败'}</h2><p>${state.result==='victory'?'腐化国王已经倒下。':'调整球与钉子的构筑，再来一次。'}</p><div class="modal-grid"><div class="modal-stat">到达关卡<br><b>${state.stage}/10</b></div><div class="modal-stat">单位球<br><b>${state.balls.length}</b></div><div class="modal-stat">最高星级<br><b>${maxStar} 星</b></div><div class="modal-stat">当前经验<br><b>${totalXp}</b></div></div><button id="restart" class="hud-button danger">重新开始</button></section>`;
    this.modal.querySelector('#restart')?.addEventListener('click',()=>this.c.restart());
  }
}
