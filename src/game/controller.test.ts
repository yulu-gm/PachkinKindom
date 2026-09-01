import{describe,expect,it}from'vitest';
import{GameController,stageReward}from'./controller';

describe('controller',()=>{
  it('starts with one warrior ball and launches every owned ball in order',()=>{
    const controller=new GameController(1);
    expect(controller.snapshot().balls).toMatchObject([{class:'warrior',star:1}]);
    expect(controller.beginLaunch()).toEqual([controller.snapshot().balls[0]!.id]);
  });

  it('applies launch xp and begins battle after the last ball enters',()=>{
    const controller=new GameController(1);
    const [id]=controller.beginLaunch();
    for(let hit=0;hit<13;hit++)controller.recordPegHit(id!,0);
    controller.finishBallLaunch(id!);
    expect(controller.snapshot().balls[0]).toMatchObject({form:'knight',star:1,xp:10});
    expect(controller.snapshot().phase).toBe('TRANSFERRING');
    controller.completeBallTransfer(id!);
    expect(controller.snapshot().phase).toBe('BATTLE');
  });

  it('places a purchased special peg and charges its price',()=>{
    const controller=new GameController(3);
    const index=controller.snapshot().shop.slots.findIndex(slot=>slot.item.kind==='peg');
    const price=controller.snapshot().shop.slots[index]!.item.price;
    controller.placePeg(index,7);
    expect(controller.snapshot().pegGrid[7]!.type).not.toBe('normal');
    expect(controller.snapshot().gold).toBe(50-price);
    expect(controller.snapshot().shop.slots[index]!.sold).toBe(true);
  });

  it('resets reroll price after a victory and grants stage gold',()=>{
    const controller=new GameController(2);
    controller.beginLaunch();
    const id=controller.snapshot().launchQueue[0]!;
    controller.finishBallLaunch(id);
    controller.completeBallTransfer(id);
    for(let tick=0;tick<3000&&controller.snapshot().phase==='BATTLE';tick++)controller.tickBattle(50);
    expect(controller.snapshot()).toMatchObject({phase:'SHOP',stage:2,gold:50+stageReward(1)});
    expect(controller.snapshot().shop.rerollCost).toBe(2);
  });
});
