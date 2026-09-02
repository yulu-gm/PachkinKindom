import{describe,expect,it}from'vitest';
import{createRun,transition}from'./run-state';

describe('run state',()=>{
  it('starts with one persistent warrior card and an empty round board',()=>{
    const run=createRun(123);
    expect(run).toMatchObject({phase:'SHOP',gold:0,stage:1,population:{level:1,xp:0},balls:[]});
    expect(run.cards).toMatchObject([{kind:'unit',ballClass:'warrior'}]);
    expect(run.cardRound[run.cards[0]!.id]).toBe('available');
    expect(()=>transition(run,'BATTLE')).not.toThrow();
  });
});
