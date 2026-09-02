# OneFile HTML Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `dist-onefile/PachinkoKingdom.html`, containing the complete Phaser game and all runtime sprite assets, while preserving the existing Vite build.

**Architecture:** Keep Vite as the compiler and bundler, then use a dependency-free Node postprocessor to inline the generated module, stylesheet, and sprite sheets. `BootScene` reads sprites from an optional generated data-URL map and otherwise retains the existing web path.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vite 7, Node.js ES modules, PowerShell verification

---

### Task 1: Make sprite loading work in both build modes

**Files:**
- Modify: `src/phaser/scenes/BootScene.ts`

- [ ] **Step 1: Add the optional inline asset contract**

Add a global `window.__PK_INLINE_ASSETS__` map and this resolver beside `ROLES` and `ANIMS`:

```ts
const spriteUrl=(role:typeof ROLES[number],name:keyof typeof ANIMS)=>{
  const path=`assets/sprites/${role}-${name}.png`;
  return window.__PK_INLINE_ASSETS__?.[path]??path;
};

declare global{interface Window{__PK_INLINE_ASSETS__?:Readonly<Record<string,string>>}}
```

- [ ] **Step 2: Route Phaser sprite loading through the resolver**

Replace the spritesheet URL argument with `spriteUrl(role,name)` and leave frame sizes unchanged.

- [ ] **Step 3: Type-check the dual-mode loader**

Run: `npm.cmd run build`

Expected: TypeScript and Vite finish with exit code 0; the existing chunk-size advisory may remain.

### Task 2: Add the OneFile postprocessor

**Files:**
- Create: `scripts/make-onefile.mjs`

- [ ] **Step 1: Resolve and validate build paths**

Resolve the project root from `import.meta.url`, use `dist` as input, and use the exact guarded output directory `dist-onefile`.

- [ ] **Step 2: Encode sprite sheets**

Read image files from `dist/assets/sprites`, encode them as MIME-correct base64 data URLs, and create map keys in the same `assets/sprites/<name>` format used by `BootScene`.

- [ ] **Step 3: Inline CSS and JavaScript**

Read `dist/index.html`, replace generated stylesheet links with `<style>`, replace the single Vite module script with the inline asset map plus an inline module, remove module-preload links, and escape closing script/style tags.

- [ ] **Step 4: Reject incomplete output**

Fail if the build contains anything other than one module entry, no PNG data URL, or an external script/stylesheet reference. Clear only the validated `dist-onefile` directory and write `PachinkoKingdom.html`.

### Task 3: Expose and document the build command

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add the package command**

Add:

```json
"build:onefile": "npm run build && node scripts/make-onefile.mjs"
```

- [ ] **Step 2: Document the artifact**

Document `npm run build:onefile` and the exact output path `dist-onefile/PachinkoKingdom.html` in the run/build section.

### Task 4: Verify the standalone artifact

**Files:**
- Verify: `dist-onefile/PachinkoKingdom.html`

- [ ] **Step 1: Run the logical tests**

Run: `npm.cmd test`

Expected: all current Vitest files pass with no failures.

- [ ] **Step 2: Build the OneFile artifact**

Run: `npm.cmd run build:onefile`

Expected: exit code 0 and a printed output size for `dist-onefile/PachinkoKingdom.html`.

- [ ] **Step 3: Inspect the output structure**

Run a PowerShell check that requires exactly one output file, confirms inline CSS, module JavaScript, and PNG data URLs, and rejects external script or stylesheet URLs.

- [ ] **Step 4: Smoke-test the disk URL**

Open the absolute HTML path in the in-app browser, wait for the game canvas, and verify that no sprite or script request fails.

- [ ] **Step 5: Check the scoped diff**

Run: `git diff --check -- package.json README.md src/phaser/scenes/BootScene.ts scripts/make-onefile.mjs`

Expected: no whitespace errors. Confirm unrelated pre-existing working-tree changes remain untouched.
