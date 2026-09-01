import{createBall}from'./ball-progression';
import type{BallClass,BallUnit,Cell,PopulationState,RunState,ShopItem,ShopSlot,ShopState,SpecialPegType}from'./model';

export const POP_THRESHOLDS=[0,4,10,18,30,46,66,90]as const;
const BALLS:readonly BallClass[]=['warrior','mage','archer'];
const PEGS:readonly SpecialPegType[]=['power','haste','guard','spring','echo'];
export const PEG_PRICES:Record<SpecialPegType,number>={power:4,haste:4,guard:5,spring:5,echo:6};
const pick=<T>(values:readonly T[],seed:number)=>values[Math.abs(seed)%values.length]!;
const slot=(item:ShopItem):ShopSlot=>({item,locked:false,sold:false});

export function rollSlots(seed:number):ShopSlot[]{
  const pegA=pick(PEGS,seed*5+2),pegB=pick(PEGS,seed*7+3);
  return[
    slot({kind:'ball',ballClass:pick(BALLS,seed),price:5}),
    slot({kind:'ball',ballClass:pick(BALLS,seed*3+1),price:5}),
    slot({kind:'peg',pegType:pegA,price:PEG_PRICES[pegA]}),
    slot({kind:'peg',pegType:pegB,price:PEG_PRICES[pegB]}),
  ];
}

export function createShop(seed:number):ShopState{return{slots:rollSlots(seed),rerollCost:2,seed}}

export function rerollShop(shop:ShopState,seed:number):ShopState{
  const fresh=rollSlots(seed);
  return{seed,rerollCost:shop.rerollCost+1,slots:shop.slots.map((old,index)=>old.locked?old:fresh[index]!)};
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
