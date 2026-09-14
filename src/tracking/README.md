# 通用定位场景

## 模块边界

- `map/CesiumBase.ts`：只负责 Viewer、地形、底图、基础渲染配置和鼠标事件初始化。
- `map/CesiumInstance.ts`：管理 Viewer 实例，避免重复创建 WebGL 上下文。
- `map/CesiumTools.ts`：负责模型、轨迹、相机、时钟等业务调用。
- `map/SimulatedMotion.ts`：纯 TypeScript 路线、速度和运动状态计算，不依赖 Cesium 和业务数据。
- `map/actors/BaseTrackedActor.ts`：目标 Entity、标签和轨迹的公共生命周期。
- `map/actors/VehicleActor.ts`：车辆车轮、转向和镜头参数。
- `map/actors/PersonActor.ts`：人员步行动画和镜头参数。
- `map/actors/DroneActor.ts`：无人机高度基准、旋翼动画和镜头参数。
- `map/actors/ActorPositionSource.ts`：历史与实时定位共用的数据源接口。
- `scene.ts`：业务兼容出口，只转发场景创建 API。
- `siteConfig.ts`：当前项目的业务配置，更换项目时替换此文件或传入新的配置对象。

`createTrackingScene` 是配置驱动的 Cesium 定位场景入口。业务项目只需要提供一个 `TrackingSceneConfig`：

```ts
import { createTrackingScene, type TrackingSceneConfig } from './tracking';

const config: TrackingSceneConfig = {
    terrain: {
        url: '/terrain/',
        center: { longitude: 111.25, latitude: 39.72 },
    },
    targets: [
        {
            id: 'DEVICE-01',
            name: '巡检设备',
            kind: 'inspection-device',
            kindLabel: '巡检设备',
            operatorLabel: '责任单位',
            operator: '运行部',
            area: '作业区',
            status: '运行中',
            trajectoryUrl: '/trajectory/device-01.json',
            altitudeMode: 'clamp-to-ground',
            model: { uri: '/models/device.glb', scale: 1 },
            style: { color: '#2878ff', trailColor: '#62a0ff', icon: 'vehicle' },
        },
    ],
};

const controller = await createTrackingScene(
    container,
    (seconds) => console.log(seconds),
    (id) => console.log(id),
    (message) => console.error(message),
    {},
    config
);
```

轨迹文件是 JSON 数组，每项包含 `longitude`、`latitude`、`timestamp`，可选 `height`。目标通过 `altitudeMode` 选择贴地、绝对高程或相对航线最高地形飞行。多个同类型目标使用不同 `id` 和 `trajectoryUrl` 即可。

## 复用模拟运动

模拟运动核心不依赖 Cesium，可以直接用在其他页面、Three.js、Canvas 或测试程序中。输入坐标必须是以米为单位的局部二维坐标：

```ts
import { SimulatedMotionFactory } from './tracking';

const motion = SimulatedMotionFactory.create(
    {
        points: [
            [0, 0],
            [100, 0],
            [100, 80],
            [180, 80],
        ],
        cornerRadius: 15,
        height: 0,
        cruiseKmh: 24,
        acceleration: 1.2,
        braking: 1.8,
        maxLateralAcceleration: 1.3,
        mode: 'adaptive',
    },
    5.2
); // 车辆轴距，单位米

// 每一帧传入从起点开始的秒数。
const state = motion.sample(12.5);
console.log(state.position, state.heading, state.speed, state.steer);
```

`position` 是局部米制坐标，不是经纬度。如果目标运行在真实地图上，使用 `trajectoryAt` 处理经纬度轨迹；或者先把局部坐标通过 Cesium 的 ENU 坐标系转换到地球坐标。

## 接入实时定位

当前 `HistoricalTrajectorySource` 从 JSON 历史轨迹取值。实时模式只需实现 `ActorPositionSource` 的 `stateAt` 和 `boundsPoints`，把 WebSocket、MQTT 或接口收到的最新定位状态交给对应 Actor；车辆、人员和无人机类无需修改。
