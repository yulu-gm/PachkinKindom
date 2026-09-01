# Peg Opening and Instant Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the top two peg rows and replace the cross-screen transfer animation with immediate tactics-board deployment plus a stationary spawn burst.

**Architecture:** `peg-grid.ts` remains the single source of truth for legal peg positions. `GameScene` keeps collision and rendering responsibilities: it resolves the ball at the bottom exit, creates a waiting tactics piece at the saved cell, plays a short local effect, then advances the controller queue.

**Tech Stack:** TypeScript 5.9, Phaser 3.90 Matter physics, Vitest 3, Vite 7.

---

### Task 1: Reduce the Peg Grid to the Lower Five Rows

**Files:**
- Modify: `src/game/peg-grid.ts`
- Modify: `src/game/peg-grid.test.ts`
- Modify: `src/phaser/pachinko/geometry.test.ts`

- [ ] **Step 1: Change the failing rule assertions**

```ts
expect(GRID_SLOTS).toHaveLength(40);
expect(new Set(GRID_SLOTS.map(slot=>slot.x))).toHaveLength(8);
expect(new Set(GRID_SLOTS.map(slot=>slot.y))).toHaveLength(5);
expect(Math.min(...GRID_SLOTS.map(slot=>slot.y))).toBe(250);
expect(Math.max(...GRID_SLOTS.map(slot=>slot.y))).toBe(470);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/game/peg-grid.test.ts src/phaser/pachinko/geometry.test.ts`

Expected: FAIL because the current grid still contains 56 slots across seven rows starting at Y 140.

- [ ] **Step 3: Implement the lower five-row grid**

```ts
export const GRID_COLUMNS=8;
export const GRID_ROWS=5;
export const GRID_SLOTS:PegSlot[]=Array.from({length:GRID_COLUMNS*GRID_ROWS},(_,id)=>({
  id,
  x:60+(id%GRID_COLUMNS)*68,
  y:250+Math.floor(id/GRID_COLUMNS)*55,
  type:'normal',
}));
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm.cmd test -- src/game/peg-grid.test.ts src/phaser/pachinko/geometry.test.ts`

Expected: 7 focused tests pass.

### Task 2: Replace the Transfer Lane with Instant Deployment

**Files:**
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Remove transfer-lane rendering**

Delete the lane `Graphics`, “单位转移轨道” label, and the `transferring` guard set. Keep the bottom exit sensor and “单位转移出口” label.

- [ ] **Step 2: Replace `exitBall` with immediate deployment**

```ts
private exitBall(id:string){
  if(!this.active||this.active.id!==id)return;
  const before=this.c.snapshot().balls.find(ball=>ball.id===id)!;
  this.clearRetry();
  this.active.img.destroy();
  this.active=undefined;
  this.c.finishBallLaunch(id);
  const after=this.c.snapshot().balls.find(ball=>ball.id===id)!;
  if(before.form!==after.form)this.banner(`${FORM_NAME[before.form]} 进化为 ${FORM_NAME[after.form]}！`,CLASS_COLOR[after.class]);
  else if(before.star!==after.star)this.banner(`${FORM_NAME[after.form]} 升至 ${after.star} 星！`,0xffd65c);
  const target=boardPoint(after.cell.row,after.cell.col);
  const waiting=this.makeUnit(target.x,target.y,after.form,after.star,false,after);
  waiting.root.setScale(.75).setAlpha(0);
  this.transferViews.set(id,waiting.root);
  this.spawnBurst(target.x,target.y,after.class);
  this.tweens.add({
    targets:waiting.root,scale:1,alpha:1,duration:180,ease:'Back.Out',
    onComplete:()=>{
      this.c.completeBallTransfer(id);
      if(this.c.snapshot().phase==='LAUNCHING')this.time.delayedCall(120,()=>this.spawnCurrentBall());
    },
  });
}
```

- [ ] **Step 3: Add the stationary spawn burst**

```ts
private spawnBurst(x:number,y:number,ballClass:BallClass){
  this.burst(x,y,CLASS_COLOR[ballClass]);
  const flash=this.add.circle(x,y,18,0xffffff,.55).setStrokeStyle(4,CLASS_COLOR[ballClass]).setDepth(24);
  this.tweens.add({targets:flash,scale:2,alpha:0,duration:180,ease:'Cubic.Out',onComplete:()=>flash.destroy()});
}
```

- [ ] **Step 4: Verify obsolete presentation is gone**

Run: `rg -n -e "单位转移轨道" -e "tweens.chain" -e "transferring" src/phaser/scenes/GameScene.ts`

Expected: no matches.

- [ ] **Step 5: Run complete verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: 20 tests pass, production build succeeds, and the diff check reports no errors.

- [ ] **Step 6: Commit**

```powershell
git add src/game/peg-grid.ts src/game/peg-grid.test.ts src/phaser/pachinko/geometry.test.ts src/phaser/scenes/GameScene.ts
git commit -m "feat: open peg field and deploy balls instantly"
```
