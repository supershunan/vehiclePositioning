import * as Cesium from 'cesium';
import { BaseTrackedActor, type ActorNodeBinding } from './BaseTrackedActor';

/** 矿卡模型逻辑：车轮随里程旋转，前轮预留真实转向角输入。 */
export class VehicleActor extends BaseTrackedActor {
    focusRange(): number {
        return 48;
    }

    protected nodeBindings(): ActorNodeBinding[] {
        const bindings: ActorNodeBinding[] = [];
        for (const x of [-2.05, 2.05]) {
            bindings.push({
                nodeName: `steer${x}2.55`,
                axis: 'y',
                angle: ({ steer }) => -steer,
            });
            for (const z of [-2.65, 2.55]) {
                bindings.push({
                    nodeName: `wheel${x}${z}`,
                    axis: 'x',
                    angle: ({ distance }) => distance / 2,
                });
            }
        }
        return bindings;
    }

    protected viewFrom(): Cesium.Cartesian3 {
        // trackedEntity 使用目标局部 ENU 坐标：x 向东、y 向北、z 向上。
        // 增大水平距离和离地高度，保持矿卡位于镜头前下方并看见周边道路。
        return new Cesium.Cartesian3(-110, -110, 75);
    }

    protected trailWidth(): number {
        return 4;
    }

    /** 矿卡体积较大，抬高模型原点，避免车轮或底盘进入地形网格。 */
    protected groundClearance(): number {
        return 1;
    }
}
