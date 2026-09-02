import{describe,expect,it}from'vitest';
import{buyBallFromShop,buyPopulationXp,createShop,pegPrice,QUALITY_WEIGHTS,qualityForRoll,rerollShop}from'./shop';
import{createRun}from'./run-state';

describe('shop',()=>{
  it('raises reroll cost and preserves locked slots',()=>{
    const shop=createShop(7);
    const locked={...shop,slots:shop.slots.map((value,index)=>({...value,locked:index===0}))};
    const next=rerollShop(locked,9);
    expect(next.rerollCost).toBe(3);
    expect(next.slots[0]!.item).toEqual(shop.slots[0]!.item);
    expect(next.slots).toHaveLength(5);
    expect(next.slots.some(slot=>slot.item.kind==='ball')).toBe(true);
    expect(next.slots.some(slot=>slot.item.kind==='peg')).toBe(true);
  });

  it('buys four population xp for four gold and levels at thresholds',()=>{
    expect(buyPopulationXp({level:1,xp:0},8)).toEqual({population:{level:2,xp:4},gold:4});
  });

  it('rejects a ball purchase at population cap',()=>{
    const state=createRun(7);
    const ballSlot=state.shop.slots.findIndex(value=>value.item.kind==='ball');
    expect(()=>buyBallFromShop(state,ballSlot)).toThrow('人口已满');
  });

  it('always rolls five products with at least one ball and one peg',()=>{
    for(let seed=0;seed<50;seed++){
      const slots=createShop(seed,1).slots;
      expect(slots).toHaveLength(5);
      expect(slots.some(slot=>slot.item.kind==='ball')).toBe(true);
      expect(slots.some(slot=>slot.item.kind==='peg')).toBe(true);
    }
  });

  it('increases quality odds with population level at exact boundaries',()=>{
    for(const weights of Object.values(QUALITY_WEIGHTS))expect(Object.values(weights).reduce((sum,value)=>sum+value,0)).toBe(100);
    expect(qualityForRoll(1,.69)).toBe('common');
    expect(qualityForRoll(1,.70)).toBe('rare');
    expect(qualityForRoll(8,.27)).toBe('common');
    expect(qualityForRoll(8,.28)).toBe('rare');
    expect(qualityForRoll(8,.99)).toBe('legendary');
  });

  it('prices experience and effect pegs by quality',()=>{
    expect(['common','rare','epic','legendary'].map(quality=>pegPrice('experience',quality as never))).toEqual([2,3,5,8]);
    expect(pegPrice('power','legendary')).toBe(10);
    expect(pegPrice('echo','rare')).toBe(7);
    expect(pegPrice('multiplier','epic')).toBe(10);
    expect(pegPrice('teleport','legendary')).toBe(10);
  });
});
