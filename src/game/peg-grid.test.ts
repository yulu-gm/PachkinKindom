import{describe,expect,it}from'vitest';
import{applyPegHit,createLaunchResult,GRID_SLOTS}from'./peg-grid';

describe('peg grid',()=>{
  it('creates an evenly spaced 8 by 5 grid with a clear upper field',()=>{
    expect(GRID_SLOTS).toHaveLength(40);
    expect(new Set(GRID_SLOTS.map(slot=>slot.x))).toHaveLength(8);
    expect(new Set(GRID_SLOTS.map(slot=>slot.y))).toHaveLength(5);
    expect(Math.min(...GRID_SLOTS.map(slot=>slot.x))).toBe(72);
    expect(Math.max(...GRID_SLOTS.map(slot=>slot.x))).toBe(534);
    expect(Math.min(...GRID_SLOTS.map(slot=>slot.y))).toBe(250);
    expect(Math.max(...GRID_SLOTS.map(slot=>slot.y))).toBe(470);
  });

  it('always grants experience and consumes echo on the next special peg',()=>{
    let result=createLaunchResult('b1');
    result=applyPegHit(result,'echo');
    result=applyPegHit(result,'normal');
    result=applyPegHit(result,'power');
    expect(result).toMatchObject({xp:6,attackBonus:.2,echoPending:false});
  });

  it('keeps echo armed through normal pegs until another special peg',()=>{
    let result=applyPegHit(createLaunchResult('b1'),'echo');
    result=applyPegHit(result,'normal');
    expect(result.echoPending).toBe(true);
  });

  it('stacks amplifier multipliers without a design cap and doubles amplification after echo',()=>{
    let result=applyPegHit(createLaunchResult('b1'),'amplifier',4);
    expect(result).toMatchObject({xp:4,xpMultiplier:1.5});
    result=applyPegHit(result,'amplifier',4);
    expect(result).toMatchObject({xp:10,xpMultiplier:2.25});
    result=applyPegHit(result,'echo',4);
    result=applyPegHit(result,'amplifier',4);
    expect(result.xp).toBe(28);
    expect(result.xpMultiplier).toBeCloseTo(5.0625);
    for(let hit=0;hit<20;hit++)result=applyPegHit(result,'amplifier',4);
    expect(result.xpMultiplier).toBeGreaterThan(10000);
  });
});
