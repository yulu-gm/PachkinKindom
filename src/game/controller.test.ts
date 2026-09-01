import{describe,it,expect}from'vitest';import{GameController}from'./controller';import{createRun}from'./run-state';import{addUnit}from'./roster';
describe('controller',()=>{
  it('settles each purchased ball once',()=>{const c=new GameController(1);const shot=c.buy('single');expect(shot.ids).toHaveLength(1);c.settleBall(shot.ids[0]!,'purple');c.settleBall(shot.ids[0]!,'red');expect(c.snapshot().units).toHaveLength(1);expect(c.snapshot().highestRarity).toBe('purple')});

  it.each([
    ['blue','swordsman'],
    ['purple','axeman'],
    ['orange','longbow'],
    ['red','crossbow'],
  ]as const)('maps a %s blind box to its fixed unit kind',(rarity,kind)=>{
    const c=new GameController(11);
    const shot=c.buy('single');
    c.settleBall(shot.ids[0]!,rarity);
    expect(c.snapshot().units[0]!.kind).toBe(kind);
  });

  it('maps a white blind box only to a white-tier unit',()=>{
    const c=new GameController(11);
    const shot=c.buy('single');
    c.settleBall(shot.ids[0]!,'white');
    expect(['guard','slinger']).toContain(c.snapshot().units[0]!.kind);
  });

  it('stores quality only through the unit kind',()=>{
    const c=new GameController(11);
    const shot=c.buy('single');
    c.settleBall(shot.ids[0]!,'red');
    expect(c.snapshot().units[0]).not.toHaveProperty('rarity');
  });

  it('returns every battle event from each simulation step',()=>{
    let run=addUnit(createRun(4),'crossbow');
    const id=run.units[0]!.id;
    run={...run,units:run.units.map(unit=>({...unit,location:'board' as const,cell:{row:0 as const,col:2 as const},benchIndex:undefined}))};
    const c=new GameController(4,run);
    c.startBattle();
    const events=c.tickBattle(50);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({type:'hit',id,target:'e1-0'}),
    ]));
  });

  it('advances after victory',()=>{let run=createRun(2);for(let i=0;i<9;i++)run=addUnit(run,'crossbow');const c=new GameController(2,run);c.place(c.snapshot().units[0]!.id,{row:1,col:1});c.startBattle();for(let i=0;i<3000&&c.snapshot().phase==='BATTLE';i++)c.tickBattle(50);expect(c.snapshot().stage).toBe(2);expect(c.snapshot().gold).toBeGreaterThan(50)});
});
