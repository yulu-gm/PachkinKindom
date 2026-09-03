import{describe,expect,it}from'vitest';
import{createBall}from'./ball-progression';
import{BOMB_DATA,roundStateFor}from'./cards';
import{enemyBounty,GameController,stageReward}from'./controller';
import type{CardInstance}from'./model';
import{createRun}from'./run-state';

const withCards=(seed:number,cards:CardInstance[])=>{const run=createRun(seed);return{...run,cards,cardRound:roundStateFor(cards)}};
const launch=(controller:GameController,cardId:string)=>{controller.reserveCard(cardId);return controller.confirmCardLaunch()};

describe('card preparation controller',()=>{
  it('starts with a warrior unit card and supports reserve/cancel without use',()=>{
    const controller=new GameController(1),card=controller.snapshot().cards[0]!;
    expect(controller.snapshot().balls).toEqual([]);expect(card).toMatchObject({kind:'unit',ballClass:'warrior'});
    controller.reserveCard(card.id);expect(controller.snapshot().cardRound[card.id]).toBe('reserved');controller.cancelCardAim();expect(controller.hand()).toContainEqual(card);
  });
  it('launches a unit card, applies peg growth, and deploys it to the first cell',()=>{
    const controller=new GameController(2),card=controller.snapshot().cards[0]!,batch=launch(controller,card.id),projectile=batch.projectiles[0]!;
    for(let hit=0;hit<13;hit++)controller.recordProjectilePegHit(projectile.id,0);
    expect(controller.startBlockReason()).toBe('还有弹丸未结算');
    const unit=controller.finishProjectile(projectile.id)!;expect(unit).toMatchObject({class:'warrior',star:2,xp:6,cell:{row:0,col:0}});
    expect(controller.startBlockReason()).toBeUndefined();controller.beginExpedition();expect(controller.snapshot().phase).toBe('BATTLE');
  });
  it('allows concurrent bomb batches and applies each projectile to one peg once',()=>{
    const cards:CardInstance[]=[{id:'c1',kind:'unit',ballClass:'warrior'},{id:'x1',kind:'experience-bomb',quality:'rare'},{id:'m1',kind:'multiplier-bomb',quality:'epic'}],controller=new GameController(3,withCards(3,cards));
    const xp=launch(controller,'x1'),mult=launch(controller,'m1');expect(xp.projectiles).toHaveLength(3);expect(mult.projectiles).toHaveLength(4);expect(Object.keys(controller.snapshot().activeProjectiles)).toHaveLength(7);
    const first=xp.projectiles[0]!,second=xp.projectiles[1]!,factor=mult.projectiles[0]!;
    controller.recordProjectilePegHit(first.id,5);controller.recordProjectilePegHit(first.id,5);controller.recordProjectilePegHit(second.id,5);controller.recordProjectilePegHit(factor.id,5);
    expect(controller.snapshot().pegGrid[5]).toMatchObject({bonusXp:10,bonusMultiplier:1.5});
  });
  it('uses four quality tiers for bomb count and values',()=>{
    expect(Object.values(BOMB_DATA).map(data=>[data.projectiles,data.experienceBonus,data.multiplier])).toEqual([[3,3,1.2],[3,5,1.5],[4,5,1.5],[5,8,2]]);
  });
  it('consumes peg cards and keeps their installed pegs across rounds',()=>{
    const cards:CardInstance[]=[{id:'c1',kind:'unit',ballClass:'warrior'},{id:'g1',kind:'peg',pegType:'power',quality:'rare'},{id:'g2',kind:'peg',pegType:'guard',quality:'epic'}];
    const initial=withCards(4,cards),controller=new GameController(4,{...initial,balls:[{...createBall('hero','warrior',{row:0,col:0},'c1'),form:'lord',star:3}]});
    controller.placePegCard('g1',2);controller.placePegCard('g2',2);expect(controller.snapshot().cardRound).toMatchObject({g1:'invalidated',g2:'equipped'});expect(controller.snapshot().roundUsedCards).toMatchObject({g1:{id:'g1'},g2:{id:'g2'}});expect(controller.snapshot().pegGrid[2]).toMatchObject({type:'guard',quality:'epic'});
    controller.beginExpedition();for(let tick=0;tick<3000&&controller.snapshot().phase==='BATTLE';tick++)controller.tickBattle(50);
    expect(controller.snapshot().stage).toBe(2);expect(controller.snapshot().balls).toEqual([]);expect(controller.snapshot().pegGrid[2]).toMatchObject({type:'guard',quality:'epic',bonusXp:0,bonusMultiplier:1});expect(controller.card('g1')).toBeUndefined();expect(controller.card('g2')).toBeUndefined();
  });
  it('marks shop peg cards as consumable before they are deployed',()=>{
    const run=createRun(9),controller=new GameController(9,{...run,gold:20}),pegSlot=controller.snapshot().shop.slots.findIndex(slot=>slot.item.kind==='peg');
    expect(pegSlot).toBeGreaterThanOrEqual(0);controller.buyItem(pegSlot);const card=controller.snapshot().cards.find(value=>value.kind==='peg');
    expect(card).toMatchObject({kind:'peg',consumable:true});
  });
  it('removes consumable cards only after a successful launch',()=>{
    const cards:CardInstance[]=[{id:'c1',kind:'unit',ballClass:'warrior'},{id:'once',kind:'experience-bomb',quality:'common',consumable:true}],controller=new GameController(5,withCards(5,cards));
    controller.reserveCard('once');controller.cancelCardAim();expect(controller.card('once')).toBeDefined();launch(controller,'once');expect(controller.card('once')).toBeUndefined();expect(controller.snapshot().roundUsedCards.once).toMatchObject({id:'once',consumable:true});
  });
  it('rolls a committed launch back if Phaser cannot create its bodies',()=>{
    const cards:CardInstance[]=[{id:'c1',kind:'unit',ballClass:'warrior'},{id:'once',kind:'experience-bomb',quality:'common',consumable:true}],controller=new GameController(8,withCards(8,cards)),batch=launch(controller,'once');
    controller.rollbackCardLaunch(batch.card,batch.projectiles.map(projectile=>projectile.id));
    expect(controller.card('once')).toBeDefined();expect(controller.snapshot().cardRound.once).toBe('available');expect(controller.snapshot().roundUsedCards.once).toBeUndefined();expect(Object.keys(controller.snapshot().activeProjectiles)).toEqual([]);
  });
  it('blocks expedition for no unit, aiming, or active projectile, but not unused cards',()=>{
    const controller=new GameController(6),card=controller.snapshot().cards[0]!;expect(controller.startBlockReason()).toBe('至少需要一个单位');controller.reserveCard(card.id);expect(controller.startBlockReason()).toContain('瞄准');controller.cancelCardAim();
    const batch=launch(controller,card.id);expect(controller.startBlockReason()).toContain('弹丸');controller.finishProjectile(batch.projectiles[0]!.id);expect(controller.startBlockReason()).toBeUndefined();
  });
  it('keeps bounty and stage rewards unchanged',()=>{expect(enemyBounty({form:'warrior',star:1})).toBe(5);expect(enemyBounty({form:'general',star:3})).toBe(12);expect(stageReward(1)).toBe(10)});
});
