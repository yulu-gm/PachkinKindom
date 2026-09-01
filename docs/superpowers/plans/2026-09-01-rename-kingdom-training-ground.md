# 王国训练场标题修改实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将左侧弹珠区域标题改为「♛ 王国训练场」，保持其余界面与玩法不变。

**Architecture:** 这是 Phaser 场景中的静态显示文案变更。直接修改 `GameScene.create()` 中现有标题字符串，不增加状态、组件或资源。

**Tech Stack:** TypeScript、Phaser 3、Vite

---

### Task 1: 修改并验证左侧区域标题

**Files:**
- Modify: `src/phaser/scenes/GameScene.ts:55`

- [ ] **Step 1: 修改标题文本**

将标题创建语句改为：

```ts
this.add.text(332, 14, '♛ 王国训练场', {
  fontFamily: 'monospace',
  fontSize: '22px',
  color: '#ffe1a0',
}).setOrigin(0.5, 0);
```

修改时遵循文件现有格式，只替换字符串内容，避免无关格式变化。

- [ ] **Step 2: 检查新旧文案引用**

Run: `rg -n -e "单位球锻造机" -e "王国训练场" src`

Expected: 仅有 `王国训练场` 命中，且位于 `src/phaser/scenes/GameScene.ts`。

- [ ] **Step 3: 构建项目**

Run: `npm.cmd run build`

Expected: Vite 构建成功并以退出码 0 结束。

- [ ] **Step 4: 检查变更范围**

Run: `git diff --check` 和 `git diff -- src/phaser/scenes/GameScene.ts`

Expected: 无空白错误，代码差异仅包含标题字符串替换。

- [ ] **Step 5: 提交修改**

```bash
git add src/phaser/scenes/GameScene.ts docs/superpowers/plans/2026-09-01-rename-kingdom-training-ground.md
git commit -m "ui: rename left area to kingdom training ground"
```

