# Unit-Ball Dual-Build Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blind-box rarity loop with persistent unit balls that gain experience from a fixed peg grid, enter the tactics board automatically, and are purchased alongside placeable special pegs in a TFT-style shop.

**Architecture:** Pure TypeScript modules own ball progression, launch effects, peg-grid legality, population, shop state, and battle seeds. `GameController` orchestrates phase transitions and exposes events; Phaser renders physics, drag/drop, the bottom transfer lane, and battle effects, while the DOM HUD renders shop and population controls.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 with Matter physics, Vite 7, Vitest 3.

---

### Task 1: Persistent Unit-Ball Progression

**Files:**
- Create: `src/game/ball-progression.ts`
- Create: `src/game/ball-progression.test.ts`
- Modify: `src/game/model.ts`

- [ ] **Step 1: Write the failing progression tests**

```ts
import{describe,it,expect}from'vitest';
import{addBallExperience,createBall}from'./ball-progression';

describe('unit-ball progression',()=>{
  it('carries excess experience across star and evolution nodes',()=>{
    const ball=createBall('b1','warrior',{row:1,col:1});
    const grown=addBallExperience(ball,125);
    expect(grown).toMatchObject({form:'knight',star:1,xp:5});
  });

  it('caps the final form at three stars',()=>{
    const ball=createBall('b1','mage',{row:1,col:1});
    const grown=addBallExperience(ball,9999);
    expect(grown).toMatchObject({form:'archmage',star:3,xp:0});
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/game/ball-progression.test.ts`

Expected: FAIL because `ball-progression.ts` does not exist.

- [ ] **Step 3: Define the new model and progression implementation**

```ts
// src/game/model.ts
export type BallClass='warrior'|'mage'|'archer';
export type BallForm='warrior'|'knight'|'general'|'mage'|'elementalist'|'archmage'|'archer'|'ranger'|'sharpshooter';
export type Star=1|2|3;
export type Cell={row:0|1|2|3;col:0|1|2|3|4|5};
export type BallUnit={id:string;class:BallClass;form:BallForm;star:Star;xp:number;cell:Cell};
```

```ts
// src/game/ball-progression.ts
import type{BallClass,BallForm,BallUnit,Cell,Star}from'./model';
const COSTS=[20,40,60,80,100,120,140,160]as const;
const CHAINS:Record<BallClass,readonly BallForm[]>={
  warrior:['warrior','knight','general'],
  mage:['mage','elementalist','archmage'],
  archer:['archer','ranger','sharpshooter'],
};
export const createBall=(id:string,ballClass:BallClass,cell:Cell):BallUnit=>({id,class:ballClass,form:CHAINS[ballClass][0]!,star:1,xp:0,cell});
const nodeOf=(ball:BallUnit)=>CHAINS[ball.class].indexOf(ball.form)*3+(ball.star-1);
export function addBallExperience(ball:BallUnit,amount:number):BallUnit{
  let node=nodeOf(ball),xp=ball.xp+amount;
  while(node<COSTS.length&&xp>=COSTS[node]!){xp-=COSTS[node]!;node++}
  if(node>=8){const form=CHAINS[ball.class][2]!;return{...ball,form,star:3,xp:0}}
  return{...ball,form:CHAINS[ball.class][Math.floor(node/3)]!,star:(node%3+1)as Star,xp};
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- src/game/ball-progression.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/game/model.ts src/game/ball-progression.ts src/game/ball-progression.test.ts
git commit -m "feat: add persistent unit-ball progression"
```

### Task 2: Fixed Peg Grid and Per-Launch Effects

**Files:**
- Create: `src/game/peg-grid.ts`
- Create: `src/game/peg-grid.test.ts`
- Modify: `src/game/model.ts`

- [ ] **Step 1: Write failing grid and effect tests**

```ts
import{describe,it,expect}from'vitest';
import{GRID_SLOTS,applyPegHit,createLaunchResult}from'./peg-grid';

describe('peg grid',()=>{
  it('creates an evenly spaced 8 by 7 grid inside the safe bounds',()=>{
    expect(GRID_SLOTS).toHaveLength(56);
    expect(new Set(GRID_SLOTS.map(x=>x.x))).toHaveLength(8);
    expect(new Set(GRID_SLOTS.map(x=>x.y))).toHaveLength(7);
    expect(Math.min(...GRID_SLOTS.map(x=>x.x))).toBe(60);
    expect(Math.max(...GRID_SLOTS.map(x=>x.x))).toBe(536);
  });

  it('always grants experience and consumes echo on the next special peg',()=>{
    let result=createLaunchResult('b1');
    result=applyPegHit(result,'echo');
    result=applyPegHit(result,'power');
    expect(result).toMatchObject({xp:20,attackBonus:0.2,echoPending:false});
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/game/peg-grid.test.ts`

Expected: FAIL because the peg-grid module does not exist.

- [ ] **Step 3: Implement the grid and launch-result reducer**

```ts
export type PegType='normal'|'power'|'haste'|'guard'|'echo'|'spring';
export type PegSlot={id:number;x:number;y:number;type:PegType};
export type LaunchResult={ballId:string;xp:number;attackBonus:number;hasteBonus:number;shieldRatio:number;echoPending:boolean};
export const GRID_SLOTS:PegSlot[]=Array.from({length:56},(_,id)=>({
  id,
  x:60+(id%8)*68,
  y:140+Math.floor(id/8)*55,
  type:'normal',
}));
export const createLaunchResult=(ballId:string):LaunchResult=>({ballId,xp:0,attackBonus:0,hasteBonus:0,shieldRatio:0,echoPending:false});
export function applyPegHit(result:LaunchResult,type:PegType):LaunchResult{
  const times=result.echoPending&&type!=='echo'?2:1;
  const next={...result,xp:result.xp+10,echoPending:type==='echo'?true:type==='normal'?result.echoPending:false};
  if(type==='power')next.attackBonus=Math.min(1,next.attackBonus+.1*times);
  if(type==='haste')next.hasteBonus=Math.min(.8,next.hasteBonus+.08*times);
  if(type==='guard')next.shieldRatio+=.12*times;
  return next;
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- src/game/peg-grid.test.ts`

Expected: grid and echo tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/game/model.ts src/game/peg-grid.ts src/game/peg-grid.test.ts
git commit -m "feat: add fixed peg grid and launch effects"
```

### Task 3: Population and TFT-Style Shop

**Files:**
- Create: `src/game/shop.ts`
- Create: `src/game/shop.test.ts`
- Modify: `src/game/model.ts`

- [ ] **Step 1: Write failing shop tests**

```ts
import{describe,it,expect}from'vitest';
import{buyPopulationXp,buyShopItem,createShop,rerollShop}from'./shop';

describe('shop',()=>{
  it('raises reroll cost and preserves locked slots',()=>{
    const shop=createShop(7);
    const locked={...shop,slots:shop.slots.map((s,i)=>({...s,locked:i===0}))};
    const next=rerollShop(locked,9);
    expect(next.rerollCost).toBe(3);
    expect(next.slots[0]!.item).toEqual(shop.slots[0]!.item);
  });

  it('buys four population xp for four gold and levels at thresholds',()=>{
    const result=buyPopulationXp({level:1,xp:0},8);
    expect(result).toEqual({population:{level:2,xp:4},gold:4});
  });

  it('rejects a ball purchase at population cap',()=>{
    const shop=createShop(7);
    const ballSlot=shop.slots.findIndex(slot=>slot.item.kind==='ball');
    const state={
      gold:50,nextId:2,shop,population:{level:1,xp:0},pegInventory:[],
      balls:[{id:'b1',class:'warrior',form:'warrior',star:1,xp:0,cell:{row:1,col:1}}],
    }as const;
    expect(()=>buyShopItem(state,ballSlot)).toThrow('人口已满');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/game/shop.test.ts`

Expected: FAIL because `shop.ts` does not exist.

- [ ] **Step 3: Implement deterministic shop and population rules**

```ts
import{createBall}from'./ball-progression';
import type{BallClass,BallUnit,Cell}from'./model';import type{PegType}from'./peg-grid';
export type ShopItem={kind:'ball';ballClass:BallClass;price:5}|{kind:'peg';pegType:Exclude<PegType,'normal'>;price:number};
export type ShopSlot={item:ShopItem;locked:boolean;sold:boolean};
export type ShopState={slots:ShopSlot[];rerollCost:number;seed:number};
export type PopulationState={level:number;xp:number};
export type PurchaseState={gold:number;nextId:number;balls:readonly BallUnit[];population:PopulationState;shop:ShopState;pegInventory:readonly Exclude<PegType,'normal'>[]};
export const POP_THRESHOLDS=[0,4,10,18,30,46,66,90]as const;
const BALLS:readonly BallClass[]=['warrior','mage','archer'];
const PEGS:readonly Exclude<PegType,'normal'>[]=['power','haste','guard','spring','echo'];
const PEG_PRICES:Record<Exclude<PegType,'normal'>,number>={power:4,haste:4,guard:5,spring:5,echo:6};
const pick=<T>(values:readonly T[],seed:number)=>values[Math.abs(seed)%values.length]!;
export function rollSlots(seed:number):ShopSlot[]{
  return[
    {item:{kind:'ball',ballClass:pick(BALLS,seed),price:5},locked:false,sold:false},
    {item:{kind:'ball',ballClass:pick(BALLS,seed*3+1),price:5},locked:false,sold:false},
    ...[seed*5+2,seed*7+3].map(value=>{const pegType=pick(PEGS,value);return{item:{kind:'peg' as const,pegType,price:PEG_PRICES[pegType]},locked:false,sold:false}}),
  ];
}
export function createShop(seed:number):ShopState{return{slots:rollSlots(seed),rerollCost:2,seed}}
export function rerollShop(shop:ShopState,seed:number):ShopState{const fresh=rollSlots(seed);return{seed,rerollCost:shop.rerollCost+1,slots:shop.slots.map((slot,i)=>slot.locked?slot:fresh[i]!)}}
export function buyPopulationXp(population:PopulationState,gold:number){
  if(gold<4)throw new Error('金币不足');
  const xp=population.xp+4;
  const level=Math.min(8,POP_THRESHOLDS.filter(x=>x<=xp).length);
  return{population:{level,xp},gold:gold-4};
}
const firstFreeCell=(balls:readonly BallUnit[]):Cell=>{
  for(let row=0 as Cell['row'];row<4;row=(row+1)as Cell['row'])for(let col=0 as Cell['col'];col<6;col=(col+1)as Cell['col'])if(!balls.some(ball=>ball.cell.row===row&&ball.cell.col===col))return{row,col};
  throw new Error('棋盘已满');
};
export function buyShopItem(state:PurchaseState,slotIndex:number):PurchaseState{
  const slot=state.shop.slots[slotIndex];if(!slot||slot.sold)throw new Error('商品不可购买');
  if(state.gold<slot.item.price)throw new Error('金币不足');
  if(slot.item.kind==='ball'&&state.balls.length>=state.population.level)throw new Error('人口已满');
  const slots=state.shop.slots.map((entry,index)=>index===slotIndex?{...entry,sold:true}:entry);
  if(slot.item.kind==='peg')return{...state,gold:state.gold-slot.item.price,shop:{...state.shop,slots},pegInventory:[...state.pegInventory,slot.item.pegType]};
  const ball=createBall(`b${state.nextId}`,slot.item.ballClass,firstFreeCell(state.balls));
  return{...state,gold:state.gold-slot.item.price,nextId:state.nextId+1,shop:{...state.shop,slots},balls:[...state.balls,ball]};
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- src/game/shop.test.ts`

Expected: all shop and population tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/game/model.ts src/game/shop.ts src/game/shop.test.ts
git commit -m "feat: add population and escalating-reroll shop"
```

### Task 4: Run State and Controller Phase Loop

**Files:**
- Modify: `src/game/run-state.ts`
- Modify: `src/game/controller.ts`
- Modify: `src/game/controller.test.ts`
- Delete after replacements compile: `src/game/economy.ts`, `src/game/roster.ts`, `src/game/unit-defs.ts`

- [ ] **Step 1: Write failing controller-loop tests**

```ts
it('starts with one warrior ball and launches every owned ball in order',()=>{
  const c=new GameController(1);
  expect(c.snapshot().balls).toMatchObject([{class:'warrior',star:1}]);
  expect(c.beginLaunch()).toEqual([c.snapshot().balls[0]!.id]);
});

it('applies launch xp and begins battle after the last ball enters',()=>{
  const c=new GameController(1);
  const [id]=c.beginLaunch();
  for(let hit=0;hit<13;hit++)c.recordPegHit(id!,0);
  c.finishBallLaunch(id!);
  expect(c.snapshot().balls[0]).toMatchObject({form:'knight',star:1,xp:10});
  expect(c.snapshot().phase).toBe('TRANSFERRING');
  c.completeBallTransfer(id!);
  expect(c.snapshot().phase).toBe('BATTLE');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/game/controller.test.ts`

Expected: FAIL because the current controller exposes blind-box `buy/settleBall` instead of the unit-ball launch queue.

- [ ] **Step 3: Replace the run state**

```ts
export type Phase='SHOP'|'LAUNCHING'|'TRANSFERRING'|'BATTLE'|'RUN_END';
export type RunState={
  seed:number;phase:Phase;gold:number;stage:number;nextId:number;
  balls:BallUnit[];pegGrid:PegSlot[];shop:ShopState;population:PopulationState;
  launchResults:Record<string,LaunchResult>;launchQueue:string[];result?:'victory'|'defeat';
};
```

Create the initial state with 50 gold, stage 1, one warrior ball at row 1/col 1, normal 8×7 peg grid, level-1 population, and a four-slot shop.

- [ ] **Step 4: Replace controller commands**

```ts
beginLaunch():string[]
recordPegHit(ballId:string,slotId:number):{result:LaunchResult;spring:boolean}
finishBallLaunch(ballId:string):void
completeBallTransfer(ballId:string):void
buyItem(slotIndex:number):void
toggleShopLock(slotIndex:number):void
reroll():void
buyPopulationExperience():void
placePeg(slotIndex:number,gridSlotId:number):void
moveBall(ballId:string,cell:Cell):void
tickBattle(ms:number):BattleEvent[]
```

Remove `buy(mode)`, `settleBall(id,rarity)`, rarity layout state, recruit slots, and merge/sell behavior.

- [ ] **Step 5: Run controller and full rule tests**

Run: `npm.cmd test -- src/game/controller.test.ts src/game/ball-progression.test.ts src/game/peg-grid.test.ts src/game/shop.test.ts`

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/game
git commit -m "feat: replace blind-box controller with unit-ball loop"
```

### Task 5: Battle Seeds from Unit Balls and Launch Results

**Files:**
- Modify: `src/game/battle.ts`
- Modify: `src/game/battle.test.ts`

- [ ] **Step 1: Write failing stat and effect tests**

```ts
it('combines permanent form stars with temporary launch bonuses',()=>{
  const ball={id:'b1',class:'warrior',form:'general',star:3,xp:0,cell:{row:1,col:1}}as const;
  const launch={ballId:'b1',xp:0,attackBonus:.4,hasteBonus:.24,shieldRatio:.24,echoPending:false};
  const fighter=createPlayerFighter(ball,launch);
  expect(fighter).toMatchObject({attack:102,maxHp:676,attackEveryMs:645,shield:162});
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd test -- src/game/battle.test.ts`

Expected: FAIL because the old fighter seed uses unit kinds and no launch result.

- [ ] **Step 3: Implement form stats and temporary effects**

```ts
type FormStats={maxHp:number;attack:number;attackEveryMs:number;range:number};
export const FORM_STATS:Record<BallForm,FormStats>={
  warrior:{maxHp:120,attack:12,attackEveryMs:900,range:1},
  knight:{maxHp:180,attack:18,attackEveryMs:850,range:1},
  general:{maxHp:260,attack:28,attackEveryMs:800,range:1},
  mage:{maxHp:70,attack:16,attackEveryMs:1100,range:3},
  elementalist:{maxHp:95,attack:25,attackEveryMs:1050,range:3},
  archmage:{maxHp:125,attack:38,attackEveryMs:1000,range:4},
  archer:{maxHp:80,attack:11,attackEveryMs:750,range:3},
  ranger:{maxHp:105,attack:17,attackEveryMs:650,range:4},
  sharpshooter:{maxHp:135,attack:26,attackEveryMs:550,range:5},
};
const STAR_MULTIPLIER={1:1,2:1.65,3:2.6}as const;
export function createPlayerFighter(ball:BallUnit,launch:LaunchResult):Fighter{
  const base=FORM_STATS[ball.form],permanent=STAR_MULTIPLIER[ball.star];
  const maxHp=Math.round(base.maxHp*permanent);
  return{
    id:ball.id,side:'player',cell:ball.cell,maxHp,hp:maxHp,
    attack:Math.round(base.attack*permanent*(1+launch.attackBonus)),
    attackEveryMs:Math.round(base.attackEveryMs/(1+launch.hasteBonus)),
    range:base.range,shield:Math.round(maxHp*launch.shieldRatio),
  };
}
```

Build every player fighter from `BallUnit + LaunchResult`. In `stepBattle`, subtract damage from shield first, emit `shield-hit` with the absorbed amount, then subtract any remainder from HP. Preserve `move`, `attack`, `hit`, and `death` events for Phaser effects. Enemy encounters use authored forms with the same table and a stage multiplier.

- [ ] **Step 4: Run battle tests and verify GREEN**

Run: `npm.cmd test -- src/game/battle.test.ts`

Expected: progression stats, shield absorption, and battle completion pass.

- [ ] **Step 5: Commit**

```powershell
git add src/game/battle.ts src/game/battle.test.ts src/game/encounters.ts
git commit -m "feat: derive battle units from launched unit balls"
```

### Task 6: Phaser Unit-Ball Pachinko and Transfer Lane

**Files:**
- Modify: `src/phaser/scenes/BootScene.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Modify: `src/phaser/pachinko/geometry.ts`
- Modify: `src/phaser/pachinko/geometry.test.ts`

- [ ] **Step 1: Replace geometry tests with fixed-grid and safe-lane assertions**

```ts
import{GRID_SLOTS}from'../../game/peg-grid';

it('keeps every 8x7 grid peg outside launcher and transfer safe zones',()=>{
  expect(GRID_SLOTS).toHaveLength(56);
  for(const peg of GRID_SLOTS){
    expect(peg.x).toBeLessThanOrEqual(536);
    expect(peg.y).toBeGreaterThanOrEqual(140);
    expect(peg.y).toBeLessThanOrEqual(470);
  }
});
```

- [ ] **Step 2: Run geometry tests and verify RED**

Run: `npm.cmd test -- src/phaser/pachinko/geometry.test.ts`

Expected: FAIL because the current layout is progressive and the bottom pockets occupy the transfer region.

- [ ] **Step 3: Render the 8×7 grid and typed unit balls**

Generate distinct ball textures in `BootScene`: sword crest for warrior, rune crest for mage, arrow crest for archer. In `GameScene`, spawn the current queue item, label its Matter body `ball:<id>`, update its visible XP/star badge after each peg collision, and use peg tint/symbols for each special type.

- [ ] **Step 4: Replace pockets with an exit and bottom transfer lane**

Remove all rarity pocket bodies and views. Add one wide bottom exit sensor and a curved/segmented visual lane that crosses into the right board. On exit, call `finishBallLaunch(id)`, animate the ball through the lane, call `completeBallTransfer(id)` when the tween reaches its saved cell, then launch the next queued ball. Preserve click-to-relaunch at the launcher origin and add a 12-second guided-exit fallback.

- [ ] **Step 5: Auto-start battle after all transfers**

When the final transfer tween completes, render every ball at its saved cell and let the controller enter `BATTLE`. Continue consuming returned battle events for attack streaks, hit rings, damage text, shields, and form skills.

- [ ] **Step 6: Run tests and build**

Run: `npm.cmd test -- src/phaser/pachinko/geometry.test.ts && npm.cmd run build`

Expected: geometry tests and TypeScript/Vite build pass.

- [ ] **Step 7: Commit**

```powershell
git add src/phaser
git commit -m "feat: turn unit balls into pachinko and battle pieces"
```

### Task 7: Shop HUD, Population Controls, Formation, and Peg Dragging

**Files:**
- Modify: `src/ui/Hud.ts`
- Modify: `src/styles.css`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Replace blind-box controls with shop controls**

Render four shop cards with item name, price, lock toggle, sold state, and disabled reason. Add buttons for `开始远征`, `刷新 2金币`, and `购买人口经验 4金币`. Show level, population usage, population XP progress, stage, and gold.

- [ ] **Step 2: Add DOM-to-scene drag payloads**

```ts
window.dispatchEvent(new CustomEvent('pk-peg-drag-start',{detail:{shopSlot}}));
window.dispatchEvent(new CustomEvent('pk-peg-drop',{detail:{shopSlot,gridSlotId}}));
window.dispatchEvent(new CustomEvent('pk-ball-move',{detail:{ballId,row,col}}));
```

Use pointer coordinates converted through the Phaser scale manager. Highlight the nearest legal peg slot while dragging; on valid release call `placePeg`, and on invalid release return the product to its shop card without spending gold.

- [ ] **Step 3: Add formation controls**

During `SHOP`, make owned ball pieces draggable across the player's half of the board. Snap to the nearest free cell and call `moveBall`. Disable formation and peg editing during launch, transfer, and battle.

- [ ] **Step 4: Add readable growth UI**

Each ball card and board piece must show class/form icon, star count, current XP, and the next threshold. During launch, show floating `+10 EXP`, star-up, and evolution banners without covering the peg field.

- [ ] **Step 5: Run build and manual keyboard/pointer sanity checks**

Run: `npm.cmd run build`

Expected: no TypeScript errors and no Vite errors.

- [ ] **Step 6: Commit**

```powershell
git add src/ui/Hud.ts src/styles.css src/phaser/scenes/GameScene.ts
git commit -m "feat: add dual-build shop and drag controls"
```

### Task 8: Remove Blind-Box Artifacts and Complete Playtest

**Files:**
- Delete: `docs/screenshots/pachinko-review-sparse-layout.png`
- Delete: `docs/screenshots/pachinko-review-sparse-entry.png`
- Delete: `docs/screenshots/pachinko-review-sparse-field.png`
- Delete: `docs/screenshots/effects-review-blindbox-smoke.png`
- Delete: `docs/screenshots/effects-review-battle-hit.png`
- Delete: `docs/screenshots/effects-review-battle-impact.png`
- Modify: `docs/test-report.md`
- Verify: all files under `src/`

- [ ] **Step 1: Search for obsolete concepts**

Run:

```powershell
rg -n -e Rarity -e rarity -e blind -e 盲盒 -e pocket src
```

Expected: no gameplay references remain. User-facing migration notes in docs are allowed.

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: every test passes, production build succeeds, and `git diff --check` reports no errors. The existing Phaser chunk-size warning is acceptable.

- [ ] **Step 3: Browser playtest**

Verify:

1. Shop starts with one warrior ball and population 1.
2. Reroll cost increases and locks persist.
3. A full population blocks ball purchase.
4. Peg drag snaps to one of 56 slots and replaces the peg.
5. Every owned ball launches once.
6. Normal peg hits grant 10 XP; overflow crosses multiple nodes.
7. Special effects apply only to the ball that hit them.
8. Each ball rolls through the bottom lane into its saved board cell.
9. Battle starts automatically after the final transfer.
10. Victory returns to shop with gold and reset reroll cost.

- [ ] **Step 4: Capture representative screenshots**

Save screenshots for the shop, peg dragging, multi-ball launch, evolution banner, transfer lane, and battle. Review playfield obstruction, icon readability, grid alignment, and attack/impact effects.

- [ ] **Step 5: Update the test report and commit**

```powershell
git add docs/test-report.md docs/screenshots src
git commit -m "test: verify unit-ball dual-build loop"
```
