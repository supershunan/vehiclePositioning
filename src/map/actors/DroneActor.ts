import * as Cesium from 'cesium';
import { BaseTrackedActor, type ActorNodeBinding } from './BaseTrackedActor';

/** 无人机逻辑：准备航线地形基准，并按照配置驱动各旋翼节点。 */
export class DroneActor extends BaseTrackedActor {
    focusRange(): number {
        return 110;
    }

    async prepare(): Promise<void> {
        if (this.target.altitudeMode !== 'relative-to-route-maximum') return;
        const points = this.source
            .boundsPoints()
            .map((point) => Cesium.Cartographic.fromDegrees(point.longitude, point.latitude));
        const sampled = this.viewer.terrain.availability
            ? await Cesium.sampleTerrainMostDetailed(this.viewer.terrain, points)
            : await Cesium.sampleTerrain(this.viewer.terrain, 14, points);
        if (sampled.some((point) => !Number.isFinite(point.height))) {
            throw new Error(`${this.target.name} 航线地形高度采样失败，请检查地形覆盖范围`);
        }
        this.heightBase = Math.max(...sampled.map((point) => point.height));
    }

    protected nodeBindings(): ActorNodeBinding[] {
        return (this.target.model.nodeRotations ?? []).map((rotation) => ({
            nodeName: rotation.nodeName,
            axis: rotation.axis,
            angle: ({ seconds }) => seconds * rotation.radiansPerSecond,
        }));
    }

    protected viewFrom(): Cesium.Cartesian3 {
        return new Cesium.Cartesian3(-55, -55, 34);
    }

    protected trailWidth(): number {
        return 4;
    }
}
