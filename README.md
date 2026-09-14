# 岩序 · 矿区三维运行中心

基于 React、TypeScript 和 CesiumJS 的车辆、人员与无人机轨迹展示前端。场景读取本地 Cesium Terrain 地形，定位轨迹暂由 `public/trajectory/` 下的经纬度 JSON 文件提供。

## 启动

```sh
npm install
npm run dev -- --port 5173
```

生产检查：

```sh
npm run typecheck
npm run build
```

## 配置

项目业务配置集中在 `src/siteConfig.ts`，包括：

- 本地地形地址和矿区中心坐标
- 影像服务地址
- 车辆、人员、无人机模型
- 各目标的轨迹文件、高度模式和显示样式
- 默认目标和相机距离

轨迹文件为 JSON 数组。每个采样点包含 WGS84 `longitude`、`latitude`、`timestamp`，`height` 按目标的高度模式选填。地面车辆和人员使用 `clamp-to-ground`；无人机可使用绝对高度或相对整条航线最高地形点的高度。

## 代码边界

- `src/map/CesiumBase.ts`：负责 Viewer、地形、底图和基础事件初始化。
- `src/map/CesiumInstance.ts`：管理 Viewer 实例生命周期。
- `src/map/CesiumTools.ts`：负责模型、轨迹、相机和时钟等业务调用。
- `src/map/SimulatedMotion.ts`：纯 TypeScript 运动计算与车辆、人员、无人机节点动作工厂，不依赖 Cesium、React 或业务配置。
- `src/scene.ts`：兼容旧业务调用的轻量出口。
- `src/trajectory.ts`：读取和插值经纬度轨迹。
- `src/siteConfig.ts`：当前矿区的业务配置。
- `src/App.tsx`：页面交互和状态展示。

迁移到其他项目时，可复制 `src/map/` 和 `src/tracking/`，再通过 `TrackingSceneConfig` 接入新项目的地形、模型和轨迹。
