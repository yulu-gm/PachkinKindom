import{describe,expect,it}from'vitest';
import{createRun,transition}from'./run-state';

describe('run state',()=>{
  it('starts with one population and rejects illegal transitions',()=>{
    const run=createRun(123);
    expect(run).toMatchObject({phase:'SHOP',gold:0,stage:1,population:{level:1,xp:0}});
    expect(run.balls).toHaveLength(1);
    expect(()=>transition(run,'BATTLE')).toThrow('Illegal phase transition SHOP -> BATTLE');
  });
});
