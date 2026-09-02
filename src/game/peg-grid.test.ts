import{describe,expect,it}from'vitest';
import{applyPegHit,createLaunchResult,GRID_SLOTS}from'./peg-grid';

const peg=(type:Parameters<typeof applyPegHit>[1]['type'],quality:Parameters<typeof applyPegHit>[1]['quality'])=>({type,quality});

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
    result=applyPegHit(result,peg('echo','rare')).result;
    result=applyPegHit(result,peg('normal','common')).result;
    result=applyPegHit(result,peg('power','common')).result;
    expect(result).toMatchObject({xp:9,attackBonus:.2,echoRepeats:0});
  });

  it('keeps echo armed through normal pegs until another special peg',()=>{
    let result=applyPegHit(createLaunchResult('b1'),peg('echo','epic')).result;
    result=applyPegHit(result,peg('experience','legendary')).result;
    expect(result.echoRepeats).toBe(3);
  });

  it('stacks multiplier pegs after awarding quality experience and preserves echo during cooldown',()=>{
    let outcome=applyPegHit(createLaunchResult('b1'),peg('multiplier','epic'));
    expect(outcome).toMatchObject({xpGained:10,cooldownMs:1000,result:{xp:10,xpMultiplier:1.5}});
    outcome=applyPegHit(outcome.result,peg('echo','rare'));
    outcome=applyPegHit(outcome.result,peg('multiplier','epic'),false);
    expect(outcome).toMatchObject({xpGained:15,effectTriggered:false,result:{xpMultiplier:1.5,echoRepeats:2}});
    outcome=applyPegHit(outcome.result,peg('multiplier','epic'),true);
    expect(outcome.result.xpMultiplier).toBeCloseTo(3.375);
    for(let hit=0;hit<20;hit++)outcome=applyPegHit(outcome.result,peg('multiplier','legendary'));
    expect(outcome.result.xpMultiplier).toBeGreaterThan(10000);
  });

  it('uses quality experience and scalable effect values without population input',()=>{
    let outcome=applyPegHit(createLaunchResult('b1'),peg('power','legendary'));
    expect(outcome).toMatchObject({xpGained:20,result:{attackBonus:.32}});
    outcome=applyPegHit(outcome.result,peg('haste','epic'));
    expect(outcome.result.hasteBonus).toBe(.18);
    outcome=applyPegHit(outcome.result,peg('guard','rare'));
    expect(outcome.result.shieldRatio).toBe(.18);
    outcome=applyPegHit(outcome.result,peg('spring','legendary'));
    expect(outcome.springPower).toBe(2.1);
  });
});
