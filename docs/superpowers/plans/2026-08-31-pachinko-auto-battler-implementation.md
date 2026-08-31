# Pachinko Auto-Battler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete desktop-browser prototype of 《弹珠王国》 with a Matter.js Pachinko machine, visible rarity rewards, mergeable units, a 4×6 PvE auto-battle board, ten stages, and restartable run flow.

**Architecture:** Serializable simulation state lives under `src/game` and never imports Phaser. Phaser scenes render that state, own Matter bodies and effects, and send typed actions through a single `GameController`. The persistent HUD and settings are DOM surfaces; the canvas owns the Pachinko machine, board, units, particles, and camera effects.

**Tech Stack:** TypeScript, Vite, Phaser 3 with Matter.js, Vitest, native DOM/CSS.

---

## File map

```text
index.html                         Vite entry and DOM mount points
package.json                       scripts and dependencies
tsconfig.json                      strict TypeScript configuration
src/main.ts                        application bootstrap
src/styles.css                     pixel-kingdom shell and responsive HUD
src/game/model.ts                  shared serializable types and constants
src/game/run-state.ts              run creation and phase transitions
src/game/economy.ts                purchases, refunds, rewards, and selling
src/game/roster.ts                 placement, capacity, selling, and merge chains
src/game/battle.ts                 renderer-independent grid battle simulation
src/game/encounters.ts             ten authored PvE encounters
src/game/controller.ts             sole coordinator for state-changing actions
src/game/*.test.ts                 domain tests
src/phaser/config.ts               Phaser configuration
src/phaser/scenes/BootScene.ts     generated fallback textures and scene routing
src/phaser/scenes/GameScene.ts     split-screen orchestration
src/phaser/pachinko/PachinkoView.ts Matter bodies, launch queue, and ball recovery
src/phaser/pachinko/RewardView.ts  chest reveal and rarity presentation
src/phaser/battle/BattleView.ts    grid, unit views, drag/drop, and combat playback
src/phaser/fx/FxDirector.ts        particles, shake, hit stop, reduced-motion gates
src/ui/Hud.ts                      DOM HUD, controls, settings, and results
src/assets/manifest.ts             stable asset keys and fallback metadata
public/assets/LICENSES.md          third-party asset ledger
```

### Task 1: Project scaffold and static game shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/phaser/config.ts`
- Create: `src/phaser/scenes/BootScene.ts`
- Create: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Install the runtime and test toolchain**

Run:

```powershell
npm init -y
npm install phaser
npm install -D vite typescript vitest @types/node
```

Expected: `package-lock.json` exists and `npm ls phaser vite typescript vitest` exits 0.

- [ ] **Step 2: Replace scripts and add strict TypeScript configuration**

Set `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `ES2022`, `DOM`, and `moduleResolution: "Bundler"`.

- [ ] **Step 3: Create the fixed 1280×720 application shell**

`index.html` must contain:

```html
<div id="app">
  <header id="hud"></header>
  <main id="game-frame"><div id="game-canvas"></div></main>
  <div id="modal-root"></div>
</div>
<script type="module" src="/src/main.ts"></script>
```

`src/styles.css` must define theme variables for wood, brass, parchment, player blue, enemy red, and all five rarities. Use a 16:9 `#game-frame`, pixelated canvas rendering, and a `<1024×640` media query that replaces the game with a desktop/landscape notice.

- [ ] **Step 4: Add a minimal bootable Phaser scene**

Use this boundary:

```ts
export const createGame = (parent: string): Phaser.Game => new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: 1280,
  height: 656,
  backgroundColor: '#101820',
  pixelArt: true,
  physics: { default: 'matter', matter: { gravity: { y: 1.05 }, debug: false } },
  scene: [BootScene, GameScene],
});
```

`BootScene` creates a one-pixel white fallback texture and starts `GameScene`. `GameScene` draws temporary left and right panels labelled `王室征兵机` and `战棋场` without containing gameplay rules.

- [ ] **Step 5: Verify and commit**

Run `npm run build`.

Expected: TypeScript passes and Vite creates `dist/`.

Commit:

```powershell
git add package.json package-lock.json tsconfig.json index.html src
git commit -m "chore: scaffold phaser game shell"
```

### Task 2: Serializable run model and phase state machine

**Files:**
- Create: `src/game/model.ts`
- Create: `src/game/run-state.ts`
- Create: `src/game/run-state.test.ts`

- [ ] **Step 1: Write phase-transition tests**

Cover `PREP → LAUNCHING → REVEAL → PREP`, `PREP → BATTLE → VICTORY → PREP`, `BATTLE → RUN_END`, and rejection of `PREP → REVEAL`.

```ts
it('rejects an illegal transition', () => {
  const run = createRun(123);
  expect(() => transition(run, 'REVEAL')).toThrow('Illegal phase transition PREP -> REVEAL');
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run `npm test -- src/game/run-state.test.ts`.

Expected: FAIL because `createRun` and `transition` do not exist.

- [ ] **Step 3: Implement the model and transitions**

Define exact unions:

```ts
export type Phase = 'PREP' | 'LAUNCHING' | 'REVEAL' | 'BATTLE' | 'VICTORY' | 'RUN_END';
export type Rarity = 'white' | 'blue' | 'purple' | 'orange' | 'red';
export type UnitKind = 'guard' | 'swordsman' | 'axeman' | 'longbow' | 'crossbow' | 'slinger';
export type Star = 1 | 2 | 3;
export type Cell = { row: 0 | 1 | 2 | 3; col: 0 | 1 | 2 | 3 | 4 | 5 };
export type Unit = { id: string; kind: UnitKind; rarity: Rarity; star: Star; location: 'board' | 'bench' | 'recruit'; cell?: Cell; benchIndex?: number };
export type RunState = { seed: number; phase: Phase; gold: number; stage: number; nextId: number; units: Unit[]; settledBallIds: string[]; result?: 'victory' | 'defeat' };
```

`createRun(seed)` returns 50 gold, stage 1, `PREP`, no units, `nextId: 1`. Implement transitions with a constant adjacency map; the function returns a new state and never mutates its input.

- [ ] **Step 4: Run tests and commit**

Run `npm test -- src/game/run-state.test.ts` then `npm run build`.

Expected: all focused tests pass and build exits 0.

Commit `src/game/model.ts`, `src/game/run-state.ts`, and its test with message `feat: add serializable run state`.

### Task 3: Economy and deterministic reward layout

**Files:**
- Create: `src/game/economy.ts`
- Create: `src/game/economy.test.ts`

- [ ] **Step 1: Write economy tests**

Test these exact results:

```ts
expect(purchase(createRun(1), 'single').state.gold).toBe(40);
expect(purchase(createRun(1), 'five').state.gold).toBe(5);
expect(stageReward(1)).toBe(25);
expect(stageReward(10)).toBe(70);
expect(sellValue({ rarity: 'orange', star: 2 })).toBe(36);
expect(() => purchase({ ...createRun(1), gold: 9 }, 'single')).toThrow('Need 10 gold');
```

Also assert that a seeded shuffle always contains each rarity exactly once and returns the same order for the same seed and purchase index.

- [ ] **Step 2: Verify failure**

Run `npm test -- src/game/economy.test.ts`.

Expected: FAIL because the economy module is absent.

- [ ] **Step 3: Implement economy rules**

Export:

```ts
export const SHOT_COST = { single: 10, five: 45 } as const;
export const RARITY_WIDTH = { white: 34, blue: 26, purple: 20, orange: 13, red: 7 } as const;
export const RARITY_MULTIPLIER = { white: 1, blue: 1.3, purple: 1.7, orange: 2.2, red: 3 } as const;
export const SELL_BASE = { white: 3, blue: 5, purple: 8, orange: 12, red: 20 } as const;
export const stageReward = (stage: number): number => 20 + 5 * stage;
export const sellValue = ({ rarity, star }: Pick<Unit, 'rarity' | 'star'>): number => SELL_BASE[rarity] * 3 ** (star - 1);
```

`purchase` requires `PREP`, no recruit-slot unit, and enough gold. It returns `{ state, count, layout }`, moves to `LAUNCHING`, and uses a small seeded Fisher–Yates function instead of `Math.random`.

- [ ] **Step 4: Verify and commit**

Run the focused test, full `npm test`, and `npm run build`.

Commit with message `feat: add run economy and reward layouts`.

### Task 4: Roster placement and chained three-to-one merging

**Files:**
- Create: `src/game/roster.ts`
- Create: `src/game/roster.test.ts`

- [ ] **Step 1: Write roster tests**

Cover insertion into the first bench slot, recruit-slot overflow, maximum 5 deployed units, illegal right-side placement, one-star merge, chained merge to three stars, and no merge beyond three stars.

```ts
it('chains nine identical one-stars into one three-star', () => {
  const run = withUnits(createRun(7), 9, { kind: 'guard', rarity: 'blue', star: 1 });
  const merged = resolveMerges(run);
  expect(merged.units).toMatchObject([{ kind: 'guard', rarity: 'blue', star: 3 }]);
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- src/game/roster.test.ts` and confirm missing exports.

- [ ] **Step 3: Implement immutable roster operations**

Export `addRewardUnit`, `placeOnBoard`, `moveToBench`, `sellUnit`, `resolveMerges`, `boardUnits`, and `benchUnits`. Compare merge candidates by kind, rarity, and star, then sort by deployed-first and lowest stable id. A merged unit keeps the earliest deployed cell if present; otherwise it occupies the lowest freed bench index.

`placeOnBoard` rejects columns above 2, occupied cells, combat phases, and a sixth deployed unit. `addRewardUnit` uses the first empty bench index from 0–11, then the single recruit slot.

- [ ] **Step 4: Verify and commit**

Run focused tests, full tests, and build.

Commit with message `feat: add roster placement and merging`.

### Task 5: Renderer-independent battle simulator

**Files:**
- Create: `src/game/battle.ts`
- Create: `src/game/battle.test.ts`

- [ ] **Step 1: Write battle-rule tests**

Test stat calculation, target tie-breaking, melee movement, ranged stopping, attack cadence, death cell release, frenzy scaling after 30 seconds, and simultaneous wipe loss.

```ts
it('applies rarity and star multipliers only to hp and attack', () => {
  const stats = unitStats({ kind: 'swordsman', rarity: 'purple', star: 2 });
  expect(stats).toEqual({ maxHp: 337, attack: 37, attackEveryMs: 850, range: 1, moveEveryMs: 550 });
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- src/game/battle.test.ts`.

Expected: FAIL because the simulator is absent.

- [ ] **Step 3: Implement fixed-step combat**

Define base stats exactly as the approved spec. Export `createBattle`, `stepBattle(state, 50)`, and `runBattleToEnd`. Runtime combat entities contain `hp`, `cell`, `nextMoveAt`, `nextAttackAt`, and `team`; they are separate from roster units. Use 50 ms fixed steps and stable id ordering.

Target priority is Manhattan distance, same row, current HP, then stable id. Use orthogonal breadth-first pathfinding over occupied cells. Frenzy multiplies attack by `1.03 ** floor((elapsedMs - 30000) / 1000)` after 30 seconds.

- [ ] **Step 4: Verify and commit**

Run focused and full tests, then build.

Commit with message `feat: implement deterministic grid battles`.

### Task 6: Authored encounters and run controller

**Files:**
- Create: `src/game/encounters.ts`
- Create: `src/game/controller.ts`
- Create: `src/game/controller.test.ts`

- [ ] **Step 1: Write controller integration tests**

Assert all ten encounters have the exact names, enemy counts, and multipliers from the spec. Test purchase → settle all balls → reveal → prep, battle victory → reward and stage increment, stage 10 victory → `RUN_END`, and defeat → `RUN_END`.

- [ ] **Step 2: Verify failure**

Run `npm test -- src/game/controller.test.ts`.

- [ ] **Step 3: Implement the sole mutation coordinator**

`GameController` owns current `RunState`, exposes `snapshot()`, `subscribe(listener)`, `buy(mode)`, `settleBall(ballId, rarity)`, `finishReveals()`, `placeUnit`, `sellUnit`, `startBattle()`, `advanceBattle(deltaMs)`, and `restart(seed)`. Every method calls pure domain functions and emits one immutable snapshot after a successful action.

Use a seeded PRNG to choose the six unit kinds with equal probability. `settleBall` ignores an already settled id, guaranteeing at-most-once rewards.

- [ ] **Step 4: Verify and commit**

Run focused tests, full tests, and build.

Commit with message `feat: connect run progression and encounters`.

### Task 7: Phaser split-screen scene and procedural pixel assets

**Files:**
- Modify: `src/phaser/scenes/BootScene.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Create: `src/assets/manifest.ts`
- Create: `public/assets/LICENSES.md`

- [ ] **Step 1: Define stable asset keys and fallback policy**

Create manifest entries grouped as `characters`, `environment`, `ui`, `fx`, and `audio`. Each entry includes `{ key, url, required, licenseId }`. Start with no required external files; generated textures are registered under the same stable keys.

`LICENSES.md` begins with the project-owned procedural assets and columns for title, author, source URL, license, attribution, and local files.

- [ ] **Step 2: Generate pixel-kingdom textures in BootScene**

Use `Phaser.GameObjects.Graphics` and `generateTexture` for brass peg, steel ball, five chest colors, six blue player silhouettes, six red enemy silhouettes, board tiles, health-bar pixels, and spark particles. Set nearest-neighbour sampling.

- [ ] **Step 3: Compose the locked camera layout**

`GameScene` reserves x=0–665 for Pachinko and x=665–1280 for battle. It creates `PachinkoView`, `RewardView`, `BattleView`, and `FxDirector`, subscribes to `GameController`, and destroys the subscription in `shutdown`.

- [ ] **Step 4: Verify and commit**

Run `npm run build`, then `npm run dev` and visually confirm both panels appear without console errors.

Commit with message `feat: add pixel kingdom game scene`.

### Task 8: Matter.js Pachinko machine and guaranteed settlement

**Files:**
- Create: `src/phaser/pachinko/PachinkoView.ts`
- Create: `src/phaser/pachinko/PachinkoView.test.ts`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Test non-physics launch bookkeeping**

Extract and test a `BallLedger` inside the module. It registers purchased ball ids, refuses duplicate settlements, reports unresolved ids, and produces refunds for ids that fail before body creation.

- [ ] **Step 2: Implement the machine geometry**

Create static Matter bodies for the wood/glass boundary, right launch rail, staggered brass peg rows, and five bottom sensors. Build sensor widths from the shuffled rarity percentages and attach the rarity to each sensor body.

- [ ] **Step 3: Implement input and launch queue**

Pointer-down starts the 1.2-second ping-pong force meter. Pointer-up calls `controller.buy`, freezes the layout, and launches 1 or 5 balls at 200 ms spacing. Apply ±3% seeded variation for five-shot bodies. Disable pointer input outside `PREP`.

- [ ] **Step 4: Implement recovery and focus pause**

Track low speed for each ball. After 2 seconds below threshold, apply a small horizontal force; after 10 seconds, play a hand tween and call settlement with the nearest sensor rarity. Pause the Phaser scene on `document.visibilitychange` and resume without catch-up.

- [ ] **Step 5: Verify and commit**

Run tests and build. In browser, fire at least 20 singles and 5 five-shots; verify every paid ball leaves the scene exactly once.

Commit with message `feat: implement pachinko physics and recovery`.

### Task 9: Reward reveal, roster rendering, and board drag/drop

**Files:**
- Create: `src/phaser/pachinko/RewardView.ts`
- Create: `src/phaser/battle/BattleView.ts`
- Modify: `src/phaser/scenes/GameScene.ts`

- [ ] **Step 1: Render reward pockets and reveal queue**

`RewardView` renders the five labelled pockets from controller layout, animates the chest from the contacted sensor, reveals the unit card, then calls `finishReveals` after the queue empties. White and blue reveal tweens are skippable after first display; unit insertion is never skipped.

- [ ] **Step 2: Render the 4×6 board and twelve-slot bench**

Draw alternating stone/wood tiles with a brass midline. Derive every unit sprite, rarity frame, stars, and HP bar from snapshots; never store gameplay stats on sprites.

- [ ] **Step 3: Add legal drag/drop actions**

During `PREP`, dragging a unit highlights legal player cells and bench slots. On release call the controller; if rejected, tween the sprite back. During `BATTLE`, disable drag input and render simulator snapshots.

- [ ] **Step 4: Verify and commit**

Run build and browser smoke test: acquire units, fill five board cells, swap positions, bench a unit, and confirm a sixth deployment is rejected.

Commit with message `feat: add reward and roster interaction`.

### Task 10: Battle playback, ten-stage progression, and results

**Files:**
- Modify: `src/phaser/battle/BattleView.ts`
- Modify: `src/game/controller.ts`
- Create: `src/ui/Hud.ts`
- Create: `src/ui/Hud.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Test HUD view-model actions**

Test that single/five buttons expose correct disabled reasons for gold, phase, and recruit-slot state; battle is disabled with zero deployed units; results expose restart.

- [ ] **Step 2: Implement battle playback**

Advance the pure simulator in a fixed 50 ms accumulator. Interpolate sprite movement between cells, play attack lunge/projectile tweens from emitted battle events, update HP bars, and route victory or defeat back through the controller.

- [ ] **Step 3: Implement DOM HUD and result modal**

Render gold, stage, single/five costs, current phase, start battle, volume, mute, and reduced-motion controls. Result modal shows reached stage, balls fired, highest rarity, two/three-star counts, final five unit cards, and restart.

- [ ] **Step 4: Wire all ten stages**

On victory, award `20 + 5 × stage`, restore roster units, increment stage, and show the next encounter title. Stage 5 and 10 use boss banners. Stage 10 victory shows completion instead of returning to `PREP`.

- [ ] **Step 5: Verify and commit**

Run tests and build. Use a development gold override guarded by `import.meta.env.DEV` to play every stage, then remove the override before commit.

Commit with message `feat: complete ten-stage run flow`.

### Task 11: FX, audio gates, reduced motion, and resilience

**Files:**
- Create: `src/phaser/fx/FxDirector.ts`
- Modify: `src/phaser/pachinko/RewardView.ts`
- Modify: `src/phaser/battle/BattleView.ts`
- Modify: `src/ui/Hud.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement an effect budget**

`FxDirector` owns at most 450 ordinary particles, recycles oldest small collision effects first, and reserves reward emitters. Add peg sparks with pitch escalation reset after 400 ms, hit-stop, damage numbers, death puffs, and rarity auras.

- [ ] **Step 2: Implement exact rarity presentations**

Use the approved duration caps: white 350 ms, blue 450 ms, purple 650 ms, orange 900 ms with 80 ms freeze, and red 1200 ms with 120 ms freeze and crown burst. Do not block controller settlement on visual completion.

- [ ] **Step 3: Add resilient settings**

Persist only `{ masterVolume, musicVolume, sfxVolume, muted, reducedMotion }` in localStorage. Validate every field and fall back to defaults on corrupt data. Resume WebAudio only after user gesture. Reduced motion removes large shake, camera zoom, and white flashes while preserving labels and color frames.

- [ ] **Step 4: Verify and commit**

Run build. Manually test muted startup, corrupted localStorage, reduced motion, hidden tab pause, and a missing optional asset URL.

Commit with message `feat: polish feedback and accessibility`.

### Task 12: Asset selection, full verification, and playtest report

**Files:**
- Modify: `src/assets/manifest.ts`
- Modify: `public/assets/LICENSES.md`
- Create: `docs/test-report.md`
- Modify: `README.md`

- [ ] **Step 1: Select only compatible itch.io assets**

Choose free or CC0/commercial-use 32px medieval top-down character/UI assets with a consistent palette. For every downloaded file, record title, author, source URL, exact license, attribution, and local path in `LICENSES.md`. Do not purchase a paid pack without user confirmation.

- [ ] **Step 2: Run the automated suite**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass, TypeScript reports no errors, and Vite production build succeeds.

- [ ] **Step 3: Run the 500-ball soak test**

Add a development-only scripted launcher that records `created`, `settled`, `recovered`, `refunded`, and `duplicate` counts. Run 500 balls across varied force values.

Acceptance: `created = settled + refunded`, `duplicate = 0`, unresolved balls = 0, and no launch remains active after its 10-second recovery deadline.

- [ ] **Step 4: Browser playtest**

Test Chrome/Edge-compatible local browser at 1280×720, 1440×900, and 1920×1080. Verify onboarding, five-shot readability, drag/drop, all ten stages, defeat restart, victory result, focus pause, audio gate, and reduced motion. Capture representative screenshots and list any issues in `docs/test-report.md`.

- [ ] **Step 5: Document and commit**

`README.md` must contain prerequisites, `npm install`, `npm run dev`, `npm test`, `npm run build`, controls, scope, and asset-license location.

Run `git diff --check` and `git status --short`.

Commit with message `docs: finalize pachinko auto-battler prototype`.

## Plan self-review

- Spec coverage: tasks cover economy, physical settlement, all six units, merge chains, 4×6 combat, ten encounters, progression, UI, results, effects, settings, licenses, fallbacks, performance, and browser verification.
- Placeholder scan: the plan contains no deferred behavior or unspecified implementation step.
- Type consistency: `RunState`, `Unit`, `Rarity`, `UnitKind`, phases, controller methods, and battle boundaries use the same names throughout.
- Scope control: mobile portrait, backend, online play, permanent progression, complex abilities, and paid assets remain excluded.
