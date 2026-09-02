import{createBall}from'./ball-progression';
import type{BallClass,BallUnit,Cell,PegQuality,PopulationState,RunState,ShopItem,ShopSlot,ShopState,SpecialPegType}from'./model';

export const POP_THRESHOLDS=[0,4,10,18,30,46,66,90]as const;
const BALLS:readonly BallClass[]=['warrior','mage','archer'];
const QUALITY_ORDER:readonly PegQuality[]=['common','rare','epic','legendary'];
type QualityWeights=Record<PegQuality,number>;
export const QUALITY_WEIGHTS:Record<number,QualityWeights>={
  1:{common:70,rare:23,epic:6,legendary:1},2:{common:64,rare:25,epic:9,legendary:2},
  3:{common:58,rare:27,epic:12,legendary:3},4:{common:52,rare:29,epic:15,legendary:4},
  5:{common:46,rare:30,epic:18,legendary:6},6:{common:40,rare:31,epic:21,legendary:8},
  7:{common:34,rare:32,epic:24,legendary:10},8:{common:28,rare:33,epic:27,legendary:12},
};
export const QUALITY_XP:Record<PegQuality,number>={common:2,rare:5,epic:10,legendary:20};
export const QUALITY_PREMIUM:Record<PegQuality,number>={common:0,rare:1,epic:3,legendary:6};
export const PEG_BASE_PRICES:Record<SpecialPegType,number>={experience:2,power:4,haste:4,guard:5,spring:5,echo:6,multiplier:7,teleport:4};
const PEGS_BY_QUALITY:Record<PegQuality,readonly SpecialPegType[]>={
  common:['experience','power','haste','guard','spring'],
  rare:['experience','power','haste','guard','spring','echo'],
  epic:['experience','power','haste','guard','spring','echo','multiplier','teleport'],
  legendary:['experience','power','haste','guard','spring','echo','multiplier','teleport'],
};
export const BALL_PRICE=5;
export const BALL_SELL_PRICE=3;
const pick=<T>(values:readonly T[],roll:number)=>values[Math.min(values.length-1,Math.floor(roll*values.length))]!;
const slot=(item:ShopItem):ShopSlot=>({item,locked:false,sold:false});
const random=(seed:number,salt:number)=>{let value=(seed^Math.imul(salt+1,0x9e3779b9))>>>0;value=Math.imul(value^(value>>>16),0x7feb352d);value=Math.imul(value^(value>>>15),0x846ca68b);return((value^(value>>>16))>>>0)/4294967296};

export const qualityForRoll=(populationLevel:number,roll:number):PegQuality=>{
  const level=Math.max(1,Math.min(8,Math.floor(populationLevel))),weights=QUALITY_WEIGHTS[level]!;
  let cursor=0;
  for(const quality of QUALITY_ORDER){cursor+=weights[quality]/100;if(roll<cursor)return quality}
  return'legendary';
};

export const pegPrice=(type:SpecialPegType,quality:PegQuality)=>type==='experience'
  ?QUALITY_XP[quality]===2?2:QUALITY_XP[quality]===5?3:QUALITY_XP[quality]===10?5:8
  :PEG_BASE_PRICES[type]+QUALITY_PREMIUM[quality];

const ballItem=(seed:number,salt:number):ShopItem=>({kind:'ball',ballClass:pick(BALLS,random(seed,salt)),price:BALL_PRICE});
const pegItem=(seed:number,populationLevel:number,salt:number):ShopItem=>{
  const quality=qualityForRoll(populationLevel,random(seed,salt)),pegType=pick(PEGS_BY_QUALITY[quality],random(seed,salt+1));
  return{kind:'peg',pegType,quality,price:pegPrice(pegType,quality)};
};

export function rollSlots(seed:number,populationLevel=1,previous?:readonly ShopSlot[]):ShopSlot[]{
  const slots:Array<ShopSlot|undefined>=Array.from({length:5},(_,index)=>previous?.[index]?.locked?previous[index]:undefined),empty=()=>slots.findIndex(value=>!value);
  let salt=0,hasBall=slots.some(value=>value?.item.kind==='ball'),hasPeg=slots.some(value=>value?.item.kind==='peg');
  if(!hasBall){const index=empty();if(index>=0){slots[index]=slot(ballItem(seed,salt++));hasBall=true}}
  if(!hasPeg){const index=empty();if(index>=0){slots[index]=slot(pegItem(seed,populationLevel,salt));salt+=2;hasPeg=true}}
  while(empty()>=0){const index=empty(),makeBall=random(seed,salt++)<.4;slots[index]=slot(makeBall?ballItem(seed,salt++):pegItem(seed,populationLevel,salt));salt+=makeBall?0:2}
  return slots as ShopSlot[];
}

export function createShop(seed:number,populationLevel=1):ShopState{return{slots:rollSlots(seed,populationLevel),rerollCost:2,seed}}

export function rerollShop(shop:ShopState,seed:number,populationLevel=1):ShopState{
  return{seed,rerollCost:shop.rerollCost+1,slots:rollSlots(seed,populationLevel,shop.slots)};
}

export function buyPopulationXp(population:PopulationState,gold:number){
  if(gold<4)throw new Error('金币不足');
  if(population.level>=8)throw new Error('人口已满级');
  const xp=population.xp+4;
  const level=Math.min(8,POP_THRESHOLDS.filter(threshold=>threshold<=xp).length);
  return{population:{level,xp},gold:gold-4};
}

export const populationProgress=(population:PopulationState)=>{
  const current=POP_THRESHOLDS[population.level-1]!;
  const next=POP_THRESHOLDS[population.level];
  return next===undefined?{current:0,required:0,max:true}:{current:population.xp-current,required:next-current,max:false};
};

export function firstFreeCell(balls:readonly BallUnit[]):Cell{
  for(let col=0;col<3;col++)for(let row=0;row<4;row++){
    if(!balls.some(ball=>ball.cell.row===row&&ball.cell.col===col))return{row:row as Cell['row'],col:col as Cell['col']};
  }
  throw new Error('棋盘已满');
}

export function buyBallFromShop(state:RunState,slotIndex:number):RunState{
  if(state.phase!=='SHOP')throw new Error('当前无法购买');
  const shopSlot=state.shop.slots[slotIndex];
  if(!shopSlot||shopSlot.sold||shopSlot.item.kind!=='ball')throw new Error('商品不可购买');
  if(state.balls.length>=state.population.level)throw new Error('人口已满');
  if(state.gold<shopSlot.item.price)throw new Error('金币不足');
  const ball=createBall(`b${state.nextId}`,shopSlot.item.ballClass,firstFreeCell(state.balls));
  return{
    ...state,gold:state.gold-shopSlot.item.price,nextId:state.nextId+1,balls:[...state.balls,ball],
    shop:{...state.shop,slots:state.shop.slots.map((value,index)=>index===slotIndex?{...value,sold:true}:value)},
  };
}
