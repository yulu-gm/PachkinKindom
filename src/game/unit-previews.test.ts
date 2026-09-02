import{describe,expect,it}from'vitest';
import{GameController}from'./controller';
import{roundUnitPreviews}from'./unit-previews';

describe('round unit previews',()=>{
  it('shows live growth while a unit projectile flies and switches cleanly to deployment',()=>{
    const controller=new GameController(21),card=controller.snapshot().cards[0]!;
    controller.reserveCard(card.id);const projectile=controller.confirmCardLaunch().projectiles[0]!;
    for(let hit=0;hit<10;hit++)controller.recordProjectilePegHit(projectile.id,0);
    expect(controller.snapshot().balls).toEqual([]);
    expect(roundUnitPreviews(controller.snapshot())).toMatchObject([{inFlight:true,unit:{id:projectile.unitId,class:'warrior',star:2,xp:0}}]);
    controller.finishProjectile(projectile.id);
    expect(roundUnitPreviews(controller.snapshot())).toMatchObject([{inFlight:false,unit:{id:projectile.unitId,class:'warrior',star:2,xp:0}}]);
  });
});
