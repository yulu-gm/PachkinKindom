import{addBallExperience,resetBallProgression}from'./ball-progression';
import{createBattle,stepBattle,type BattleEvent,type BattleState}from'./battle';
import{ENCOUNTERS}from'./encounters';
import type{BallForm,Cell,LaunchResult,RunState,SpecialPegType,Star}from'./model';
import{applyPegHit,createLaunchResult}from'./peg-grid';
import{createRun}from'./run-state';
import{buyBallFromShop,buyPopulationXp,createShop,rerollShop}from'./shop';

type Listener=(state:RunState)=>void;
const FORM_TIER:Record<BallForm,number>={warrior:0,knight:1,general:2,commander:3,lord:4,mage:0,wizard:1,elementalist:2,magus:3,archmage:4,archer:0,crossbowman:1,ranger:2,sharpshooter:3,hawkeye:4};
export const enemyBounty=(enemy:{form:BallForm;star:Star})=>Math.min(8,5+FORM_TIER[enemy.form]+enemy.star-1);
export const stageReward=(stage:number)=>ENCOUNTERS[Math.min(stage-1,ENCOUNTERS.length-1)]!.enemies.reduce((sum,enemy)=>sum+enemyBounty(enemy),0);

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

  beginLaunch(){
    if(this.state.phase!=='SHOP')throw new Error('当前无法开始远征');
    const queue=this.state.balls.map(ball=>ball.id);
    if(!queue.length)throw new Error('没有可发射的单位球');
    this.state={
      ...this.state,phase:'LAUNCHING',balls:this.state.balls.map(resetBallProgression),launchQueue:queue,transferredBallIds:[],
      launchResults:Object.fromEntries(queue.map(id=>[id,createLaunchResult(id)])),
    };
    this.emit();
    return[...queue];
  }

  recordPegHit(ballId:string,slotId:number){
    if(this.state.phase!=='LAUNCHING'||!this.state.launchQueue.includes(ballId)||this.state.transferredBallIds.includes(ballId))throw new Error('这颗球当前不可计分');
    const peg=this.state.pegGrid[slotId];
    if(!peg)throw new Error('钉位不存在');
    const current=this.state.launchResults[ballId]??createLaunchResult(ballId);
    const springPower=peg.type==='spring'?(current.echoPending?2:1):0;
    const result=applyPegHit(current,peg.type,this.state.population.level+1);
    this.state={...this.state,launchResults:{...this.state.launchResults,[ballId]:result}};
    return{result,springPower,xpGained:result.xp-current.xp};
  }

  finishBallLaunch(ballId:string){
    if(this.state.phase!=='LAUNCHING'||!this.state.launchQueue.includes(ballId)||this.state.transferredBallIds.includes(ballId))throw new Error('发射顺序错误');
    const result=this.state.launchResults[ballId]??createLaunchResult(ballId);
    this.state={
      ...this.state,
      balls:this.state.balls.map(ball=>ball.id===ballId?addBallExperience(ball,result.xp):ball),
      transferredBallIds:[...this.state.transferredBallIds,ballId],
    };
    this.emit();
  }

  completeBallTransfer(ballId:string){
    if(this.state.phase!=='LAUNCHING'||!this.state.launchQueue.includes(ballId)||!this.state.transferredBallIds.includes(ballId))throw new Error('转移顺序错误');
    const launchQueue=this.state.launchQueue.filter(id=>id!==ballId);
    const transferredBallIds=this.state.transferredBallIds;
    if(launchQueue.length){
      this.state={...this.state,launchQueue,transferredBallIds};
    }else{
      const encounter=this.encounter();
      const enemies=encounter.enemies.map((enemy,index)=>({id:`e${this.state.stage}-${index}`,...enemy}));
      this.battle=createBattle(this.state.balls,this.state.launchResults,enemies,encounter.scale);
      this.state={...this.state,phase:'BATTLE',launchQueue,transferredBallIds};
    }
    this.emit();
  }

  buyItem(slotIndex:number){this.state=buyBallFromShop(this.state,slotIndex);this.emit()}

  toggleShopLock(slotIndex:number){
    if(this.state.phase!=='SHOP')throw new Error('当前无法锁定商店');
    if(!this.state.shop.slots[slotIndex])throw new Error('商品不存在');
    this.state={...this.state,shop:{...this.state.shop,slots:this.state.shop.slots.map((slot,index)=>index===slotIndex?{...slot,locked:!slot.locked}:slot)}};
    this.emit();
  }

  reroll(){
    if(this.state.phase!=='SHOP')throw new Error('当前无法刷新');
    if(this.state.gold<this.state.shop.rerollCost)throw new Error('金币不足');
    this.state={...this.state,gold:this.state.gold-this.state.shop.rerollCost,shop:rerollShop(this.state.shop,this.nextSeed())};
    this.emit();
  }

  buyPopulationExperience(){
    if(this.state.phase!=='SHOP')throw new Error('当前无法升级人口');
    const result=buyPopulationXp(this.state.population,this.state.gold);
    this.state={...this.state,population:result.population,gold:result.gold};
    this.emit();
  }

  placePeg(shopSlotIndex:number,gridSlotId:number){
    if(this.state.phase!=='SHOP')throw new Error('当前无法放置钉子');
    const shopSlot=this.state.shop.slots[shopSlotIndex];
    if(!shopSlot||shopSlot.sold||shopSlot.item.kind!=='peg')throw new Error('请拖动钉子商品');
    if(this.state.gold<shopSlot.item.price)throw new Error('金币不足');
    if(!this.state.pegGrid[gridSlotId])throw new Error('钉位不存在');
    this.state={
      ...this.state,gold:this.state.gold-shopSlot.item.price,
      pegGrid:this.state.pegGrid.map(slot=>slot.id===gridSlotId?{...slot,type:shopSlot.item.kind==='peg'?shopSlot.item.pegType as SpecialPegType:slot.type}:slot),
      shop:{...this.state.shop,slots:this.state.shop.slots.map((slot,index)=>index===shopSlotIndex?{...slot,sold:true}:slot)},
    };
    this.emit();
  }

  moveBall(ballId:string,cell:Cell){
    if(this.state.phase!=='SHOP')throw new Error('当前无法布阵');
    if(cell.col>2)throw new Error('只能布置在己方半场');
    if(this.state.balls.some(ball=>ball.id!==ballId&&ball.cell.row===cell.row&&ball.cell.col===cell.col))throw new Error('格子已占用');
    if(!this.state.balls.some(ball=>ball.id===ballId))throw new Error('单位球不存在');
    this.state={...this.state,balls:this.state.balls.map(ball=>ball.id===ballId?{...ball,cell}:ball)};
    this.emit();
  }

  tickBattle(ms:number):BattleEvent[]{
    if(!this.battle||this.state.phase!=='BATTLE')return[];
    this.battle=stepBattle(this.battle,ms);
    const events=[...this.battle.events];
    if(this.battle.winner){
      if(this.battle.winner==='player'){
        const gold=this.state.gold+stageReward(this.state.stage);
        if(this.state.stage>=ENCOUNTERS.length)this.state={...this.state,gold,phase:'RUN_END',result:'victory'};
        else{
          const stage=this.state.stage+1;
          this.state={...this.state,gold,stage,phase:'SHOP',shop:createShop(this.nextSeed()),launchResults:{},launchQueue:[],transferredBallIds:[]};
        }
      }else this.state={...this.state,phase:'RUN_END',result:'defeat'};
      this.emit();
    }
    return events;
  }

  restart(seed=Date.now()){this.state=createRun(seed);this.random=seed>>>0;this.battle=undefined;this.emit()}
}
