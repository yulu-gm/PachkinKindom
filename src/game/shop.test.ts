import{describe,expect,it}from'vitest';
import{buyBallFromShop,buyPopulationXp,createShop,rerollShop}from'./shop';
import{createRun}from'./run-state';

describe('shop',()=>{
  it('raises reroll cost and preserves locked slots',()=>{
    const shop=createShop(7);
    const locked={...shop,slots:shop.slots.map((value,index)=>({...value,locked:index===0}))};
    const next=rerollShop(locked,9);
    expect(next.rerollCost).toBe(3);
    expect(next.slots[0]!.item).toEqual(shop.slots[0]!.item);
  });

  it('buys four population xp for four gold and levels at thresholds',()=>{
    expect(buyPopulationXp({level:1,xp:0},8)).toEqual({population:{level:2,xp:4},gold:4});
  });

  it('rejects a ball purchase at population cap',()=>{
    const state=createRun(7);
    const ballSlot=state.shop.slots.findIndex(value=>value.item.kind==='ball');
    expect(()=>buyBallFromShop(state,ballSlot)).toThrow('人口已满');
  });

  it('rolls the amplifier peg at its seven-gold price',()=>{
    const amplifier=createShop(2).slots.find(slot=>slot.item.kind==='peg'&&slot.item.pegType==='amplifier');
    expect(amplifier?.item).toEqual({kind:'peg',pegType:'amplifier',price:7});
  });
});
