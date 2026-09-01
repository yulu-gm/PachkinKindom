import{describe,expect,it}from'vitest';
import{enemyBounty,GameController,stageReward}from'./controller';
import{BALL_PRICE}from'./shop';
import{createRun}from'./run-state';

describe('controller',()=>{
  it('starts with one warrior ball and launches every owned ball in order',()=>{
    const controller=new GameController(1);
    expect(controller.snapshot().balls).toMatchObject([{class:'warrior',star:1}]);
    expect(controller.beginLaunch()).toEqual([controller.snapshot().balls[0]!.id]);
  });

  it('applies launch xp while balls are in flight and begins battle after the last ball transfers',()=>{
    const controller=new GameController(1);
    const [id]=controller.beginLaunch();
    for(let hit=0;hit<13;hit++)controller.recordPegHit(id!,0);
    controller.finishBallLaunch(id!);
    expect(controller.snapshot().balls[0]).toMatchObject({form:'warrior',star:2,xp:6});
    expect(controller.snapshot().phase).toBe('LAUNCHING');
    controller.completeBallTransfer(id!);
    expect(controller.snapshot().phase).toBe('BATTLE');
  });

  it('keeps every launched ball in flight at once and transfers them out of order',()=>{
    const controller=new GameController(2,{...createRun(2),gold:BALL_PRICE*2,population:{level:3,xp:10}});
    controller.buyItem(0);controller.buyItem(1);
    const ids=controller.beginLaunch();
    expect(ids).toHaveLength(3);
    const [first,middle,last]=ids;
    // the last-launched ball may finish and transfer while earlier ones still fly
    for(let hit=0;hit<3;hit++)controller.recordPegHit(last!,0);
    expect(controller.snapshot().launchResults[last!]!.xp).toBe(12);
    controller.finishBallLaunch(last!);
    expect(()=>controller.finishBallLaunch(last!)).toThrow();
    expect(controller.snapshot().phase).toBe('LAUNCHING');
    controller.completeBallTransfer(last!);
    expect(controller.snapshot().phase).toBe('LAUNCHING');
    expect(()=>controller.recordPegHit(last!,0)).toThrow();
    // earlier balls still score while later ones are done
    controller.recordPegHit(first!,1);
    controller.finishBallLaunch(first!);
    controller.completeBallTransfer(first!);
    expect(controller.snapshot().phase).toBe('LAUNCHING');
    controller.recordPegHit(middle!,2);
    controller.finishBallLaunch(middle!);
    controller.completeBallTransfer(middle!);
    expect(controller.snapshot().phase).toBe('BATTLE');
    expect(controller.snapshot().transferredBallIds.slice().sort()).toEqual(ids.slice().sort());
  });

  it('places a purchased special peg and charges its price',()=>{
    const controller=new GameController(3,{...createRun(3),gold:10});
    const index=controller.snapshot().shop.slots.findIndex(slot=>slot.item.kind==='peg');
    const price=controller.snapshot().shop.slots[index]!.item.price;
    controller.placePeg(index,7);
    expect(controller.snapshot().pegGrid[7]!.type).not.toBe('normal');
    expect(controller.snapshot().gold).toBe(10-price);
    expect(controller.snapshot().shop.slots[index]!.sold).toBe(true);
  });

  it('starts at zero gold and grants five to eight gold per defeated enemy after victory',()=>{
    const controller=new GameController(2);
    expect(controller.snapshot().gold).toBe(0);
    expect(enemyBounty({form:'warrior',star:1})).toBe(5);
    expect(enemyBounty({form:'knight',star:2})).toBe(7);
    expect(enemyBounty({form:'general',star:3})).toBe(8);
    controller.beginLaunch();
    const id=controller.snapshot().launchQueue[0]!;
    controller.finishBallLaunch(id);
    controller.completeBallTransfer(id);
    for(let tick=0;tick<3000&&controller.snapshot().phase==='BATTLE';tick++)controller.tickBattle(50);
    expect(controller.snapshot()).toMatchObject({phase:'SHOP',stage:2,gold:stageReward(1)});
    expect(stageReward(1)).toBe(5);
    expect(controller.snapshot().shop.rerollCost).toBe(2);
  });

  it('launches a second expedition cleanly after the first battle ends',()=>{
    const controller=new GameController(4,{...createRun(4),gold:4});
    // round 1: launch the starter ball and fight to a win
    const [firstId]=controller.beginLaunch();
    for(let hit=0;hit<10;hit++)controller.recordPegHit(firstId!,3);
    controller.finishBallLaunch(firstId!);
    expect(controller.snapshot().balls[0]).toMatchObject({star:2,xp:0});
    controller.completeBallTransfer(firstId!);
    expect(controller.snapshot().phase).toBe('BATTLE');
    for(let tick=0;tick<3000&&controller.snapshot().phase==='BATTLE';tick++)controller.tickBattle(50);
    expect(controller.snapshot().phase).toBe('SHOP');
    expect(controller.snapshot().stage).toBe(2);
    expect(controller.snapshot().balls[0]).toMatchObject({form:'warrior',star:2,xp:0});
    // round 2: buy one more ball and launch everything at once
    controller.buyPopulationExperience();
    controller.buyItem(0);
    const ids=controller.beginLaunch();
    expect(controller.snapshot().balls.every(ball=>ball.star===1&&ball.xp===0)).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for(const id of ids){
      controller.recordPegHit(id,2);
      controller.finishBallLaunch(id);
    }
    expect(controller.snapshot().phase).toBe('LAUNCHING');
    for(const id of ids)controller.completeBallTransfer(id);
    expect(controller.snapshot().phase).toBe('BATTLE');
  });
});
