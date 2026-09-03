# 永久钉阵与开放训练场实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让所有钉子部署卡在购买后按消耗品处理、已部署钉子跨关保留，并移除底部导流轨道后扩大出口和钉阵可玩范围，降低小球在两侧卡住的概率。

**Architecture:** 卡牌创建时统一给钉子卡设置 `consumable`，控制器继续复用现有成功施放后移除逻辑。进入下一关时只重置单位、弹丸和本局强化，保留 `pegGrid` 的已安装类型与位置；训练场几何由 `geometry.ts` 统一定义更宽出口和横向展开的钉位，`GameScene` 删除两块底部导流板并让出口传感器覆盖更宽范围，同时保留超时结算兜底。

**Tech Stack:** TypeScript、Phaser Matter、Vitest。

---

### Task 1: 固化钉子卡消耗行为

**Files:**
- Modify: `src/game/shop.ts`
- Test: `src/game/controller.test.ts`

**Step 1:** 增加测试，验证从商店购买的钉子卡带有 `consumable:true`，成功部署后从持有卡牌中移除。

**Step 2:** 运行控制器测试确认测试先失败。

**Step 3:** 在 `buyCardFromShop` 创建钉子卡实例时设置 `consumable:true`，沿用 `placePegCard` 的成功消耗逻辑。

**Step 4:** 运行控制器测试确认通过。

### Task 2: 保留跨关永久钉阵

**Files:**
- Modify: `src/game/controller.ts`
- Test: `src/game/controller.test.ts`

**Step 1:** 增加测试，装配钉子并完成一关后，下一关仍保留钉子类型、品质和位置。

**Step 2:** 运行测试确认当前 `freshPegGrid()` 重置行为导致失败。

**Step 3:** 下一关状态切换时保留 `this.state.pegGrid`，仅清空本局单位、弹丸和强化结果；为保留的钉位清除 `bonusXp` 与 `bonusMultiplier`，并保留安装信息。

**Step 4:** 运行控制器测试确认通过。

### Task 3: 扩大出口并重排开放训练场

**Files:**
- Modify: `src/phaser/pachinko/geometry.ts`
- Modify: `src/game/peg-grid.ts`
- Modify: `src/phaser/scenes/GameScene.ts`
- Test: `src/phaser/pachinko/geometry.test.ts`
- Test: `src/game/peg-grid.test.ts`

**Step 1:** 增加几何测试，验证出口覆盖主要底部宽度、钉位横向范围扩大且与两侧墙保持弹珠安全间距。

**Step 2:** 运行几何和钉阵测试确认先失败。

**Step 3:** 调整 `MACHINE.exit` 宽度，扩大 `GRID_SLOTS` 横向间距；删除场景中的底部左右导流板及其 Matter 刚体，使用新出口常量创建更宽传感器和视觉提示。

**Step 4:** 运行完整测试与生产构建，确认 TypeScript、Vitest 和 Vite 构建均通过。

