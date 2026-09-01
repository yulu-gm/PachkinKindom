# Five-Tier Progression and Unit Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend every unit class to five three-star forms and show live final combat stats in the training-field growth sidebar.

**Architecture:** Keep progression data in `ball-progression.ts` and combat values in `battle.ts`. The HUD derives preview progression from pending launch EXP, then calls the same exported player-fighter factory used by battle so display and simulation cannot diverge. Peg-hit events redraw only the sidebar and identify the row whose changed values should animate.

**Tech Stack:** TypeScript, Phaser 3, DOM/CSS HUD, Vitest, Vite

---

### Task 1: Extend the progression model to fifteen nodes

**Files:**
- Modify: `src/game/model.ts`
- Modify: `src/game/ball-progression.ts`
- Test: `src/game/ball-progression.test.ts`

- [ ] **Step 1: Add failing tests for the five-form chains and late XP costs**

Assert all three chains have five entries, the cost list equals `[20,40,60,80,100,120,140,160,200,250,310,380,460,550]`, large overflow reaches the fifth form, and final form three-star returns no next cost.

- [ ] **Step 2: Run the focused progression test and confirm it fails**

Run: `npm.cmd test -- src/game/ball-progression.test.ts`
Expected: FAIL because the chains still contain three forms and only eight costs.

- [ ] **Step 3: Extend types, chains, costs, and the generic final-node cap**

Add `commander`, `lord`, `crossbowman`, `hawkeye`, `wizard`, and `magus` to `BallForm`. Use these chains:

```ts
warrior:['warrior','knight','general','commander','lord']
archer:['archer','crossbowman','ranger','sharpshooter','hawkeye']
mage:['mage','wizard','elementalist','magus','archmage']
```

Replace the hard-coded chain index `2` in the cap branch with `FORM_CHAINS[ball.class].at(-1)!`.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm.cmd test -- src/game/ball-progression.test.ts`
Expected: all progression tests PASS.

### Task 2: Add the five-form combat stats and complete mappings

**Files:**
- Modify: `src/game/battle.ts`
- Modify: `src/game/controller.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Test: `src/game/battle.test.ts`
- Test: `src/game/controller.test.ts`

- [ ] **Step 1: Add failing combat tests for new final forms**

Create one-star fighters and assert `lord` produces 500 HP/56 attack/700ms/range 2, `hawkeye` produces 210/44/480ms/range 5, and `archmage` produces 215/58/850ms/range 5. Assert star and peg bonuses still apply through `createPlayerFighter`.

- [ ] **Step 2: Run battle and controller tests and confirm missing mappings fail**

Run: `npm.cmd test -- src/game/battle.test.ts src/game/controller.test.ts`
Expected: FAIL until every `BallForm` has stats and bounty tier data.

- [ ] **Step 3: Populate `FORM_STATS` and `FORM_TIER` for all fifteen forms**

Use the exact values from `docs/superpowers/specs/2026-09-01-unit-card-five-tier-progression-design.md`. Keep `createPlayerFighter` as the single final-stat calculator and preserve the bounty cap of 8.

- [ ] **Step 4: Replace brittle form inference in `GameScene`**

Add an exhaustive `FORM_CLASS: Record<BallForm,BallClass>` mapping and use it for enemy rendering. Expand `FORM_NAME` to the exact Chinese chain names, including base `mage: '术士'`, `wizard: '法师'`, and `archmage: '大魔法师'`.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run: `npm.cmd test -- src/game/battle.test.ts src/game/controller.test.ts`
Expected: all focused tests PASS.

### Task 3: Show live final battle attributes in the sidebar

**Files:**
- Modify: `src/ui/Hud.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Derive card stats from the battle factory**

In `renderGrowth`, build the preview ball with pending EXP, obtain the current launch result or `createLaunchResult(ball.id)`, then call `createPlayerFighter(preview, launch)`. Render attack, max HP, attacks per second (`1000 / attackEveryMs`), range, and shield.

- [ ] **Step 2: Highlight only values changed by the latest peg hit**

Maintain the previous projected fighter values by ball id. Change `renderGrowth(state, hitId?)` so the `pk-growth-hit` handler passes the hit id, compares its prior values, and adds `stat-hot` only to fields whose displayed values changed. Normal controller subscription renders establish the baseline without highlighting.

- [ ] **Step 3: Expand all name and shop text mappings**

Use the same exhaustive Chinese names as `GameScene`; rename mage shop copy to `术士球` and archer copy to `弓手球`.

- [ ] **Step 4: Add a compact attribute strip without obscuring either playfield**

Add a five-cell stat strip to `.growth-unit`, reduce card padding/gaps, and widen the external sidebar proportionally while retaining the Phaser canvas aspect ratio. Use `overflow-y:auto` as a safety fallback, but size the compact layout so eight units fit at the supported minimum viewport.

### Task 4: Verify the integrated feature

**Files:**
- Verify: `src/game/*.test.ts`
- Verify: `src/phaser/scenes/GameScene.ts`
- Verify: `src/ui/Hud.ts`
- Verify: `src/styles.css`

- [ ] **Step 1: Run the complete automated suite**

Run: `npm.cmd test`
Expected: 7 test files pass with no failures.

- [ ] **Step 2: Run production type-check and build**

Run: `npm.cmd run build`
Expected: TypeScript and Vite build succeed; the existing chunk-size advisory may remain.

- [ ] **Step 3: Check patch formatting and local service**

Run: `git diff --check`
Expected: no whitespace errors.

Open `http://127.0.0.1:5174/` and verify the page responds, up to eight cards remain outside both playfields, and EXP plus affected combat values refresh on every peg collision.
