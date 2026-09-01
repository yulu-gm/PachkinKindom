import type{GameController}from'../game/controller';
import type{BallClass,PegType,RunState,ShopSlot}from'../game/model';
import{populationProgress}from'../game/shop';

const CLASS_NAME:Record<BallClass,string>={warrior:'战士球',mage:'法师球',archer:'弓箭手球'};
const CLASS_ICON:Record<BallClass,string>={warrior:'⚔',mage:'✦',archer:'➶'};
const PEG_NAME:Record<Exclude<PegType,'normal'>,string>={power:'力量钉',haste:'疾速钉',guard:'守护钉',echo:'回响钉',spring:'弹簧钉'};
const PEG_ICON:Record<Exclude<PegType,'normal'>,string>={power:'攻',haste:'速',guard:'盾',echo:'双',spring:'弹'};
const PHASE_NAME:Record<RunState['phase'],string>={SHOP:'整备',LAUNCHING:'发射',TRANSFERRING:'转移',BATTLE:'战斗',RUN_END:'结算'};

export class Hud{
  private hud=document.querySelector<HTMLElement>('#hud')!;
  private modal=document.querySelector<HTMLElement>('#modal-root')!;
  private reduced=localStorage.getItem('pk-reduced')==='1';
  constructor(private c:GameController){c.subscribe(state=>this.render(state))}
  private action(fn:()=>void){try{fn()}catch(error){this.toast(error instanceof Error?error.message:'操作失败')}}
  private toast(text:string){const view=document.createElement('div');view.className='toast';view.textContent=text;document.body.append(view);setTimeout(()=>view.remove(),1600)}

  private card(slot:ShopSlot,index:number,state:RunState){
    const item=slot.item,isBall=item.kind==='ball',full=isBall&&state.balls.length>=state.population.level;
    const icon=isBall?CLASS_ICON[item.ballClass]:PEG_ICON[item.pegType],name=isBall?CLASS_NAME[item.ballClass]:PEG_NAME[item.pegType];
    const hint=isBall?(full?'人口已满':'点击购买'):'拖到左侧钉位';
    const disabled=slot.sold||state.phase!=='SHOP'||state.gold<item.price||full;
    return`<article class="shop-card ${isBall?'ball-card':'peg-card'} ${slot.sold?'sold':''}" data-slot="${index}" ${!isBall&&!disabled?'draggable="true"':''}>
      <button class="lock ${slot.locked?'active':''}" data-lock="${index}" title="锁定此格">${slot.locked?'🔒':'◇'}</button>
      <div class="item-icon">${icon}</div><div class="item-copy"><b>${name}</b><small>${slot.sold?'已售出':hint}</small></div>
      <div class="price">● ${item.price}</div>
    </article>`;
  }

  private render(state:RunState){
    const shopPhase=state.phase==='SHOP',progress=populationProgress(state.population);
    this.hud.innerHTML=`
      <div class="hud-top">
        <div class="brand">♛ 弹珠王国</div>
        <div class="hud-chip">● <b>${state.gold}</b></div>
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
    if(state.phase==='RUN_END')this.results(state);else this.modal.innerHTML='';
  }

  private results(state:RunState){
    const maxStar=Math.max(...state.balls.map(ball=>ball.star)),totalXp=state.balls.reduce((sum,ball)=>sum+ball.xp,0);
    this.modal.innerHTML=`<section class="modal"><h2>${state.result==='victory'?'王国得救了！':'远征失败'}</h2><p>${state.result==='victory'?'腐化国王已经倒下。':'调整球与钉子的构筑，再来一次。'}</p><div class="modal-grid"><div class="modal-stat">到达关卡<br><b>${state.stage}/10</b></div><div class="modal-stat">单位球<br><b>${state.balls.length}</b></div><div class="modal-stat">最高星级<br><b>${maxStar} 星</b></div><div class="modal-stat">当前经验<br><b>${totalXp}</b></div></div><button id="restart" class="hud-button danger">重新开始</button></section>`;
    this.modal.querySelector('#restart')?.addEventListener('click',()=>this.c.restart());
  }
}
