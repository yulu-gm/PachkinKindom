import type{CardInstance,CardKind,CardRoundState,PegQuality,PegSlot}from'./model';

export const BOMB_DATA:Record<PegQuality,{projectiles:number;experienceBonus:number;multiplier:number;price:number}>={
  common:{projectiles:3,experienceBonus:3,multiplier:1.2,price:4},
  rare:{projectiles:3,experienceBonus:5,multiplier:1.5,price:7},
  epic:{projectiles:4,experienceBonus:5,multiplier:1.5,price:11},
  legendary:{projectiles:5,experienceBonus:8,multiplier:2,price:16},
};

export const FAN_ANGLES:Record<3|4|5,readonly number[]>={3:[-12,0,12],4:[-18,-6,6,18],5:[-24,-12,0,12,24]};
export const roundStateFor=(cards:readonly CardInstance[]):CardRoundState=>Object.fromEntries(cards.map(card=>[card.id,'available']));
export const availableCards=(cards:readonly CardInstance[],round:CardRoundState)=>cards.filter(card=>round[card.id]==='available');
export const unitCardCount=(cards:readonly CardInstance[])=>cards.filter(card=>card.kind==='unit').length;
export const isBallCard=(kind:CardKind):kind is Exclude<CardKind,'peg'>=>kind!=='peg';

export function strengthenPeg(slot:PegSlot,kind:'experience-bomb'|'multiplier-bomb',quality:PegQuality):PegSlot{
  const data=BOMB_DATA[quality];
  return kind==='experience-bomb'?{...slot,bonusXp:slot.bonusXp+data.experienceBonus}:{...slot,bonusMultiplier:slot.bonusMultiplier*data.multiplier};
}
export const fanAnglesFor=(quality:PegQuality)=>FAN_ANGLES[BOMB_DATA[quality].projectiles as 3|4|5];
