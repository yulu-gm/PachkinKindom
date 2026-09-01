import{describe,expect,it}from'vitest';
import{applyPegHit,createLaunchResult,GRID_SLOTS}from'./peg-grid';

describe('peg grid',()=>{
  it('creates an evenly spaced 8 by 5 grid with a clear upper field',()=>{
    expect(GRID_SLOTS).toHaveLength(40);
    expect(new Set(GRID_SLOTS.map(slot=>slot.x))).toHaveLength(8);
    expect(new Set(GRID_SLOTS.map(slot=>slot.y))).toHaveLength(5);
    expect(Math.min(...GRID_SLOTS.map(slot=>slot.x))).toBe(60);
    expect(Math.max(...GRID_SLOTS.map(slot=>slot.x))).toBe(536);
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
});
