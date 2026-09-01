import{describe,expect,it}from'vitest';
import{createBattle,createPlayerFighter,runBattleToEnd,stepBattle}from'./battle';
import{createLaunchResult}from'./peg-grid';

describe('battle',()=>{
  it('combines permanent form stars with temporary launch bonuses',()=>{
    const ball={id:'b1',class:'warrior',form:'general',star:3,xp:0,cell:{row:1,col:1}}as const;
    const launch={...createLaunchResult('b1'),attackBonus:.4,hasteBonus:.24,shieldRatio:.24};
    expect(createPlayerFighter(ball,launch)).toMatchObject({attack:102,maxHp:676,attackEveryMs:645,shield:162});
  });

  it('absorbs damage with launch shield before hp',()=>{
    const player={id:'p',class:'warrior',form:'warrior',star:1,xp:0,cell:{row:1,col:1}}as const;
    const state=createBattle([player],{p:{...createLaunchResult('p'),shieldRatio:.12}},[{id:'e',form:'warrior',star:1,row:1,col:2}],1);
    const next=stepBattle(state,50),fighter=next.fighters.find(value=>value.id==='p')!;
    expect(fighter.hp).toBe(120);
    expect(fighter.shield).toBe(2);
    expect(next.events).toContainEqual(expect.objectContaining({type:'shield-hit',id:'p',amount:12}));
  });

  it('finishes a simple fight',()=>{
    const player={id:'p',class:'warrior',form:'knight',star:1,xp:0,cell:{row:1,col:1}}as const;
    const battle=createBattle([player],{p:createLaunchResult('p')},[{id:'e',form:'warrior',star:1,row:1,col:4}],.65);
    expect(runBattleToEnd(battle).winner).toBe('player');
  });
});
