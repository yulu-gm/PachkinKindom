# 弹珠王国

像素王国风格的 Pachinko 抽兵 + PvE 自走棋浏览器原型。

## 运行

```powershell
npm install
npm run dev
```

打开 http://127.0.0.1:5173/ 。生产构建使用 `npm run build`，逻辑测试使用 `npm test`。

执行 `npm run build:onefile` 可生成无需外部 JavaScript、CSS 或图片资源的 `dist-onefile/PachinkoKingdom.html`，可直接双击离线游玩。

## 操作

- 顶部“单发 10”或“五连 45”：发射弹珠。
- 弹珠落入五种品质槽后获得对应品质单位。
- 左键点击单位，再点击棋盘左半区格子：上阵或换位。
- 右键点击单位：出售并返还金币。
- “开始战斗”：锁定阵容并自动战斗。
- “动效 满/低”：切换完整效果和降低动态效果。

战败立即结束本局；击败第 10 关腐化国王即通关。

## 素材

- 单位精灵（剑盾士兵、史莱姆）来自 itch.io Free Characters Animations Asset Pack（作者 Oboropixel，可商用、不可再分发），文件位于 `public/assets/sprites/`，许可登记见 `public/assets/LICENSES.md`。
- 其余图形（弹珠、钉阵、奖励槽、棋盘、粒子）仍为程序化生成。后续加入新素材时必须同步更新 `public/assets/LICENSES.md`。
