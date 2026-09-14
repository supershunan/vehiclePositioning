import * as Cesium from 'cesium';
import type { CesiumBase } from '../CesiumBase';
import type { TrackedTarget, TrajectoryState } from '../../tracking/types';
import type { ActorPositionPoint, ActorPositionSource } from './ActorPositionSource';

export type RotationAxis = 'x' | 'y' | 'z';
export interface ActorMotionContext {
    seconds: number;
    distance: number;
    speed: number;
    steer: number;
}
export interface ActorNodeBinding {
    nodeName: string;
    axis: RotationAxis;
    angle(context: ActorMotionContext): number;
}

/** 车辆、人员和无人机共用的 Cesium Entity 生命周期。 */
export abstract class BaseTrackedActor {
    entity?: Cesium.Entity;
    trail?: Cesium.Entity;
    protected heightBase = 0;
    private groundHeightSamples: Array<{
        seconds: number;
        height: number;
    }> = [];

    constructor(
        protected readonly viewer: CesiumBase,
        readonly target: TrackedTarget,
        readonly source: ActorPositionSource,
        protected readonly elapsedSeconds: (time: Cesium.JulianDate) => number
    ) {}

    /**
     * 地面目标提前采样真实地形高度。
     * CLAMP_TO_GROUND 只改变模型的绘制位置，不会改变 Entity.position；
     * 跟随相机读取的是 Entity.position，因此必须为它提供真实地表高程。
     */
    async prepare(): Promise<void> {
        if (!this.isGroundActor()) return;
        const sourcePoints = this.source.boundsPoints();
        const cartographics = sourcePoints.map((point) =>
            Cesium.Cartographic.fromDegrees(point.longitude, point.latitude)
        );
        const sampled = this.viewer.terrain.availability
            ? await Cesium.sampleTerrainMostDetailed(this.viewer.terrain, cartographics)
            : await Cesium.sampleTerrain(this.viewer.terrain, 14, cartographics);
        if (sampled.some((point) => !Number.isFinite(point.height))) {
            throw new Error(`${this.target.name} 地形高度采样失败，请检查轨迹是否在地形范围内`);
        }
        this.groundHeightSamples = sampled.map((point, index) => ({
            seconds: sourcePoints[index].seconds,
            height: point.height,
        }));
    }

    mount(): void {
        const position = new Cesium.CallbackPositionProperty((time) => {
            const seconds = this.elapsedSeconds(time);
            return this.toCartesian(this.source.stateAt(seconds), seconds);
        }, false);
        const axes = {
            x: Cesium.Cartesian3.UNIT_X,
            y: Cesium.Cartesian3.UNIT_Y,
            z: Cesium.Cartesian3.UNIT_Z,
        };
        const transformations: Record<string, Cesium.CallbackProperty> = {};
        for (const binding of this.nodeBindings()) {
            transformations[binding.nodeName] = new Cesium.CallbackProperty((time) => {
                const seconds = this.elapsedSeconds(time);
                const movement = this.source.stateAt(seconds);
                return new Cesium.TranslationRotationScale(
                    Cesium.Cartesian3.ZERO,
                    Cesium.Quaternion.fromAxisAngle(
                        axes[binding.axis],
                        binding.angle({
                            seconds,
                            distance: movement.distance,
                            speed: movement.speed,
                            steer: 0,
                        })
                    ),
                    new Cesium.Cartesian3(1, 1, 1)
                );
            }, false);
        }
        this.entity = this.viewer.entities.add({
            id: this.target.id,
            name: this.target.name,
            position,
            orientation: new Cesium.CallbackProperty((time) => {
                const state = this.source.stateAt(this.elapsedSeconds(time));
                const value = position.getValue(time);
                return value
                    ? Cesium.Transforms.headingPitchRollQuaternion(
                          value,
                          new Cesium.HeadingPitchRoll(
                              state.heading + (this.target.model.headingOffsetRadians ?? 0),
                              0,
                              0
                          )
                      )
                    : undefined;
            }, false),
            model: {
                uri: this.target.model.uri,
                scale: this.target.model.scale ?? 1,
                minimumPixelSize: this.target.model.minimumPixelSize ?? 0,
                maximumScale: this.target.model.maximumScale,
                // 地面目标已经使用采样高程生成 position，无需再次异步贴地。
                heightReference: Cesium.HeightReference.NONE,
                nodeTransformations: new Cesium.PropertyBag(transformations),
            },
            viewFrom: this.viewFrom(),
            label: {
                text: this.target.name,
                font: '600 13px sans-serif',
                fillColor: Cesium.Color.WHITE,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString('#1f2926').withAlpha(0.78),
                backgroundPadding: new Cesium.Cartesian2(9, 6),
                pixelOffset: new Cesium.Cartesian2(0, -32),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference: Cesium.HeightReference.NONE,
            },
        });
        this.trail = this.viewer.entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty((time) => {
                    const current = Math.max(0, this.elapsedSeconds(time));
                    const first = Math.max(0, current - 110);
                    const points: Cesium.Cartesian3[] = [];
                    for (let second = first; second < current; second += 2) {
                        points.push(this.toCartesian(this.source.stateAt(second), second));
                    }
                    points.push(this.toCartesian(this.source.stateAt(current), current));
                    return points;
                }, false),
                width: this.trailWidth(),
                material: new Cesium.PolylineGlowMaterialProperty({
                    color: Cesium.Color.fromCssColorString(this.target.style.trailColor).withAlpha(
                        0.96
                    ),
                    glowPower: 0.22,
                    taperPower: 0.35,
                }),
                clampToGround: this.isGroundActor(),
                arcType: Cesium.ArcType.GEODESIC,
            },
        });
    }

    stateAt(seconds: number): TrajectoryState {
        return this.source.stateAt(seconds);
    }

    boundsPositions(): Cesium.Cartesian3[] {
        return this.source.boundsPoints().map((point) => this.toCartesian(point, point.seconds));
    }

    setVisible(visible: boolean, trailVisible: boolean): void {
        if (this.entity) this.entity.show = visible;
        if (this.trail) this.trail.show = visible && trailVisible;
    }

    setLabelVisible(visible: boolean): void {
        if (this.entity?.label) this.entity.label.show = new Cesium.ConstantProperty(visible);
    }

    /** 当前类型目标的推荐近景观察距离。 */
    abstract focusRange(): number;

    protected toCartesian(point: ActorPositionPoint, seconds = 0): Cesium.Cartesian3 {
        const height =
            this.target.altitudeMode === 'relative-to-route-maximum'
                ? this.heightBase + point.height
                : this.target.altitudeMode === 'absolute'
                  ? point.height
                  : this.groundHeightAt(seconds) + this.groundClearance();
        return Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, height);
    }

    /** 按轨迹时间插值高程，避免误用空间上相近但分属上下平台的采样点。 */
    private groundHeightAt(seconds: number): number {
        if (!this.groundHeightSamples.length) return 0;
        if (seconds <= this.groundHeightSamples[0].seconds)
            return this.groundHeightSamples[0].height;
        const last = this.groundHeightSamples.at(-1)!;
        if (seconds >= last.seconds) return last.height;
        let low = 0;
        let high = this.groundHeightSamples.length - 1;
        while (low + 1 < high) {
            const middle = (low + high) >> 1;
            if (this.groundHeightSamples[middle].seconds <= seconds) low = middle;
            else high = middle;
        }
        const before = this.groundHeightSamples[low];
        const after = this.groundHeightSamples[high];
        const fraction = (seconds - before.seconds) / (after.seconds - before.seconds);
        return before.height + (after.height - before.height) * fraction;
    }

    protected isGroundActor(): boolean {
        return this.target.altitudeMode === 'clamp-to-ground';
    }

    /** 模型坐标原点距离地表的安全净空，子类可按模型尺寸覆盖。 */
    protected groundClearance(): number {
        return 1.5;
    }

    protected abstract nodeBindings(): ActorNodeBinding[];
    protected abstract viewFrom(): Cesium.Cartesian3;
    protected abstract trailWidth(): number;
}
