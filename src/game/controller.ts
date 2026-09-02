import{addBallExperience}from'./ball-progression';
import{createBattle,stepBattle,type BattleEvent,type BattleState}from'./battle';
import{BOMB_DATA,fanAnglesFor,isBallCard,roundStateFor,strengthenPeg}from'./cards';
import{ENCOUNTERS}from'./encounters';
import type{ActiveProjectile,BallForm,CardInstance,Cell,PegQuality,RunState,Star}from'./model';
import{applyPegHit,createLaunchResult,SPRING_EFFECT}from'./peg-grid';
import{createRun,freshPegGrid}from'./run-state';
import{BALL_SELL_PRICE,buyCardFromShop,buyPopulationXp,createShop,rerollShop}from'./shop';
import{createBall}from'./ball-progression';

type Listener=(state:RunState)=>void;
const FORM_TIER:Record<BallForm,number>={warrior:0,knight:1,general:2,commander:3,lord:4,mage:0,wizard:1,elementalist:2,magus:3,archmage:4,archer:0,crossbowman:1,ranger:2,sharpshooter:3,hawkeye:4};
const STAR_BONUS:Record<Star,number>={1:0,2:3,3:5};
export const enemyBounty=(enemy:{form:BallForm;star:Star})=>5+FORM_TIER[enemy.form]+STAR_BONUS[enemy.star];
export const stageReward=(stage:number)=>5+ENCOUNTERS[Math.min(stage-1,ENCOUNTERS.length-1)]!.enemies.reduce((sum,enemy)=>sum+enemyBounty(enemy),0);

const firstFreeCell=(balls:RunState['balls']):Cell=>{
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)if(!balls.some(ball=>ball.cell.row===row&&ball.cell.col===col))return{row:row as Cell['row'],col:col as Cell['col']};
  throw new Error('棋盘已满，无法部署单位');
};
const physicalEffect=(state:RunState,slotId:number)=>{
  const peg=state.pegGrid[slotId]!;
  return{springPower:peg.type==='spring'?SPRING_EFFECT[peg.quality]:0,teleport:peg.type==='teleport',teleportPower:peg.type==='teleport'?1:0};
};

export class GameController{
  private state:RunState;
  private listeners=new Set<Listener>();
  private battle?:BattleState;
  private random:number;
  constructor(seed=Date.now(),initial?:RunState){this.state=initial??createRun(seed);this.random=seed>>>0}
  snapshot(){return this.state}
  battleSnapshot(){return this.battle}
  encounter(){return ENCOUNTERS[Math.min(this.state.stage-1,ENCOUNTERS.length-1)]!}
  subscribe(listener:Listener){this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener)}
  private emit(){for(const listener of this.listeners)listener(this.state)}
  private nextSeed(){this.random=(this.random*1664525+1013904223)>>>0;return this.random}
  card(id:string){return this.state.cards.find(card=>card.id===id)}
  hand(){return this.state.cards.filter(card=>this.state.cardRound[card.id]==='available')}
  usedCards(){return this.state.cards.filter(card=>['used','invalidated'].includes(this.state.cardRound[card.id]??''))}

  startBlockReason(){
    if(this.state.phase!=='SHOP')return'当前不在整备阶段';
    if(this.state.aimingCardId)return'请先发射或取消正在瞄准的卡牌';
    if(Object.keys(this.state.activeProjectiles).length)return'还有弹丸未结算';
    if(!this.state.balls.length)return'至少需要一个单位';
    return undefined;
  }
  beginExpedition(){
    const reason=this.startBlockReason();if(reason)throw new Error(reason);
    const encounter=this.encounter(),enemies=encounter.enemies.map((enemy,index)=>({id:`e${this.state.stage}-${index}`,...enemy}));
    this.battle=createBattle(this.state.balls,this.state.launchResults,enemies,encounter.scale);
    this.state={...this.state,phase:'BATTLE'};this.emit();
  }
  beginLaunch(){this.beginExpedition();return[]}

  reserveCard(cardId:string){
    if(this.state.phase!=='SHOP')throw new Error('当前无法使用卡牌');
    const card=this.card(cardId);if(!card||!isBallCard(card.kind))throw new Error('请拖动小球卡');
    if(this.state.aimingCardId)throw new Error('已有卡牌正在瞄准');
    if(this.state.cardRound[cardId]!=='available')throw new Error('卡牌本局不可用');
    this.state={...this.state,aimingCardId:cardId,cardRound:{...this.state.cardRound,[cardId]:'reserved'}};this.emit();return card;
  }
  cancelCardAim(){
    const id=this.state.aimingCardId;if(!id)return;
    this.state={...this.state,aimingCardId:undefined,cardRound:{...this.state.cardRound,[id]:'available'}};this.emit();
  }
  confirmCardLaunch():{card:CardInstance;projectiles:ActiveProjectile[];angles:readonly number[]}{
    const cardId=this.state.aimingCardId,card=cardId?this.card(cardId):undefined;
    if(!cardId||!card||!isBallCard(card.kind)||this.state.cardRound[cardId]!=='reserved')throw new Error('没有可发射的瞄准卡');
    const quality=card.quality??'common',count=card.kind==='unit'?1:BOMB_DATA[quality].projectiles,angles=card.kind==='unit'?[0]:fanAnglesFor(quality);
    const projectiles:ActiveProjectile[]=Array.from({length:count},(_,index)=>{
      const serial=this.state.nextId+index,id=`p${serial}`;
      return{id,sourceCardId:card.id,kind:card.kind as ActiveProjectile['kind'],quality:card.quality,ballClass:card.ballClass,unitId:card.kind==='unit'?`u${serial}`:undefined,hitPegIds:[]};
    });
    const active={...this.state.activeProjectiles},results={...this.state.launchResults};
    for(const projectile of projectiles){active[projectile.id]=projectile;if(projectile.unitId)results[projectile.unitId]=createLaunchResult(projectile.unitId)}
    const cards=card.consumable?this.state.cards.filter(value=>value.id!==card.id):this.state.cards;
    this.state={...this.state,cards,nextId:this.state.nextId+count,aimingCardId:undefined,activeProjectiles:active,launchResults:results,roundUsedCards:{...this.state.roundUsedCards,[card.id]:card},
      cardRound:{...this.state.cardRound,[card.id]:'used'}};this.emit();
    return{card,projectiles,angles};
  }
  rollbackCardLaunch(card:CardInstance,projectileIds:readonly string[]){
    const active={...this.state.activeProjectiles},results={...this.state.launchResults};
    for(const id of projectileIds){const projectile=active[id];if(projectile?.unitId)delete results[projectile.unitId];delete active[id]}
    const cards=this.state.cards.some(value=>value.id===card.id)?this.state.cards:[...this.state.cards,card];
    const roundUsedCards={...this.state.roundUsedCards};delete roundUsedCards[card.id];
    this.state={...this.state,cards,activeProjectiles:active,launchResults:results,roundUsedCards,cardRound:{...this.state.cardRound,[card.id]:'available'}};this.emit();
  }

  recordProjectilePegHit(projectileId:string,slotId:number,effectReady=true){
    if(this.state.phase!=='SHOP')throw new Error('弹丸当前不可计分');
    const projectile=this.state.activeProjectiles[projectileId],peg=this.state.pegGrid[slotId];
    if(!projectile)throw new Error('弹丸不存在');if(!peg)throw new Error('钉位不存在');
    if(projectile.kind==='unit'){
      const unitId=projectile.unitId!,current=this.state.launchResults[unitId]??createLaunchResult(unitId),outcome=applyPegHit(current,peg,effectReady);
      this.state={...this.state,launchResults:{...this.state.launchResults,[unitId]:outcome.result}};
      return{kind:'unit' as const,applied:true,...outcome};
    }
    if(projectile.hitPegIds.includes(slotId))return{kind:projectile.kind,applied:false,...physicalEffect(this.state,slotId)};
    const updated={...projectile,hitPegIds:[...projectile.hitPegIds,slotId]};
    this.state={...this.state,activeProjectiles:{...this.state.activeProjectiles,[projectileId]:updated},
      pegGrid:this.state.pegGrid.map(slot=>slot.id===slotId?strengthenPeg(slot,projectile.kind as 'experience-bomb'|'multiplier-bomb',projectile.quality??'common'):slot)};
    this.emit();return{kind:projectile.kind,applied:true,...physicalEffect(this.state,slotId)};
  }
  recordPegHit(projectileId:string,slotId:number,effectReady=true){return this.recordProjectilePegHit(projectileId,slotId,effectReady)}

  finishProjectile(projectileId:string){
    const projectile=this.state.activeProjectiles[projectileId];if(!projectile)throw new Error('弹丸已结算');
    let balls=this.state.balls,deployed;
    if(projectile.kind==='unit'){
      const unitId=projectile.unitId!,ballClass=projectile.ballClass;
      if(!ballClass)throw new Error('单位卡缺少兵种');
      const result=this.state.launchResults[unitId]??createLaunchResult(unitId),base=createBall(unitId,ballClass,firstFreeCell(balls),projectile.sourceCardId);
      deployed=addBallExperience(base,result.xp);balls=[...balls,deployed];
    }
    const active={...this.state.activeProjectiles};delete active[projectileId];
    this.state={...this.state,activeProjectiles:active,balls};this.emit();return deployed;
  }
  finishBallLaunch(projectileId:string){return this.finishProjectile(projectileId)}
  completeBallTransfer(){/* deployment is committed atomically when the projectile exits */}

  buyItem(slotIndex:number){this.state=buyCardFromShop(this.state,slotIndex);this.emit()}
  toggleShopLock(slotIndex:number){
    if(this.state.phase!=='SHOP')throw new Error('当前无法锁定商店');if(!this.state.shop.slots[slotIndex])throw new Error('商品不存在');
    this.state={...this.state,shop:{...this.state.shop,slots:this.state.shop.slots.map((slot,index)=>index===slotIndex?{...slot,locked:!slot.locked}:slot)}};this.emit();
  }
  reroll(){
    if(this.state.phase!=='SHOP')throw new Error('当前无法刷新');if(this.state.gold<this.state.shop.rerollCost)throw new Error('金币不足');
    this.state={...this.state,gold:this.state.gold-this.state.shop.rerollCost,shop:rerollShop(this.state.shop,this.nextSeed(),this.state.population.level)};this.emit();
  }
  buyPopulationExperience(){
    if(this.state.phase!=='SHOP')throw new Error('当前无法升级人口');const result=buyPopulationXp(this.state.population,this.state.gold);
    this.state={...this.state,population:result.population,gold:result.gold};this.emit();
  }
  placePegCard(cardId:string,gridSlotId:number){
    if(this.state.phase!=='SHOP')throw new Error('当前无法放置钉子');
    const card=this.card(cardId),target=this.state.pegGrid[gridSlotId];
    if(!card||card.kind!=='peg'||!card.pegType||!card.quality)throw new Error('请拖动钉子卡');if(!target)throw new Error('钉位不存在');
    if(this.state.cardRound[cardId]!=='available')throw new Error('卡牌本局不可用');
    const round={...this.state.cardRound};if(target.installedCardId)round[target.installedCardId]='invalidated';round[cardId]='equipped';
    const cards=card.consumable?this.state.cards.filter(value=>value.id!==card.id):this.state.cards;
    this.state={...this.state,cards,cardRound:round,roundUsedCards:{...this.state.roundUsedCards,[card.id]:card},pegGrid:this.state.pegGrid.map(slot=>slot.id===gridSlotId?{...slot,type:card.pegType!,quality:card.quality!,installedCardId:card.id}:slot)};this.emit();
  }
  placePeg(_shopSlotIndex:number,_gridSlotId:number){throw new Error('请先购买钉子卡，再从手牌拖动装配')}

  sellBall(ballId:string){
    if(this.state.phase!=='SHOP')throw new Error('只能在备战阶段售出单位');
    const ball=this.state.balls.find(value=>value.id===ballId);if(!ball)throw new Error('单位不存在');
    const sourceCardId=ball.sourceCardId??ball.id,round={...this.state.cardRound};delete round[sourceCardId];
    this.state={...this.state,gold:this.state.gold+BALL_SELL_PRICE,balls:this.state.balls.filter(value=>value.id!==ballId),
      cards:this.state.cards.filter(card=>card.id!==sourceCardId),cardRound:round};this.emit();
  }
  moveBall(ballId:string,cell:Cell){
    if(this.state.phase!=='SHOP')throw new Error('当前无法布阵');if(cell.col>2)throw new Error('只能布置在己方半场');
    if(this.state.balls.some(ball=>ball.id!==ballId&&ball.cell.row===cell.row&&ball.cell.col===cell.col))throw new Error('格子已占用');
    if(!this.state.balls.some(ball=>ball.id===ballId))throw new Error('单位不存在');
    this.state={...this.state,balls:this.state.balls.map(ball=>ball.id===ballId?{...ball,cell}:ball)};this.emit();
  }

  tickBattle(ms:number):BattleEvent[]{
    if(!this.battle||this.state.phase!=='BATTLE')return[];this.battle=stepBattle(this.battle,ms);const events=[...this.battle.events];
    if(this.battle.winner){
      if(this.battle.winner==='player'){
        const gold=this.state.gold+stageReward(this.state.stage);
        if(this.state.stage>=ENCOUNTERS.length)this.state={...this.state,gold,phase:'RUN_END',result:'victory'};
        else{const stage=this.state.stage+1,cards=this.state.cards;
          this.state={...this.state,gold,stage,phase:'SHOP',shop:createShop(this.nextSeed(),this.state.population.level),cards,cardRound:roundStateFor(cards),roundUsedCards:{},
            aimingCardId:undefined,activeProjectiles:{},balls:[],pegGrid:freshPegGrid(),launchResults:{},launchQueue:[],transferredBallIds:[]};
        }
      }else this.state={...this.state,phase:'RUN_END',result:'defeat'};this.emit();
    }return events;
  }
  restart(seed=Date.now()){this.state=createRun(seed);this.random=seed>>>0;this.battle=undefined;this.emit()}
}
