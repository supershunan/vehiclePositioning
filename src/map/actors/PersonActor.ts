import * as Cesium from 'cesium';
import { BaseTrackedActor, type ActorNodeBinding } from './BaseTrackedActor';

/** 人员模型逻辑：按照移动距离驱动手臂和腿部交替摆动。 */
export class PersonActor extends BaseTrackedActor {
    focusRange(): number {
        return 24;
    }

    protected nodeBindings(): ActorNodeBinding[] {
        const bindings: ActorNodeBinding[] = [];
        for (const side of [-1, 1]) {
            for (const part of ['leg', 'arm'] as const) {
                bindings.push({
                    nodeName: `${part}${side}`,
                    axis: 'x',
                    angle: ({ distance, speed }) =>
                        Math.sin((distance / 7) * Math.PI * 2) *
                        Math.min(1, speed / 2) *
                        0.5 *
                        side *
                        (part === 'arm' ? -1 : 1),
                });
            }
        }
        return bindings;
    }

    protected viewFrom(): Cesium.Cartesian3 {
        // 人员模型尺寸较小，距离比矿卡近，但保留足够高度避免镜头贴到地面。
        return new Cesium.Cartesian3(-65, -65, 50);
    }

    protected trailWidth(): number {
        return 3;
    }

    protected groundClearance(): number {
        return 0.5;
    }
}
