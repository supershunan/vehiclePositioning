import * as Cesium from 'cesium';
import { CesiumBase } from './CesiumBase';
import CesiumInstance from './CesiumInstance';
import { ActorFactory, HistoricalTrajectorySource, type BaseTrackedActor } from './actors';
import { loadTrajectories } from '../trajectory';
import type { TrackedTarget, TrackingSceneConfig, TrajectoryState } from '../tracking/types';

export interface TrackingSceneOptions {
    historyActive?: boolean;
    onTelemetry?: (state: TrajectoryState) => void;
}

export interface TrackingSceneController {
    duration: number;
    viewer: CesiumBase;
    loadTargets(targets: TrackedTarget[], preserveCamera?: boolean): Promise<number>;
    updateRealtimeTargets(targets: TrackedTarget[]): Promise<number>;
    select(id: string): void;
    home(top?: boolean): void;
    follow(): boolean;
    orbit(): boolean;
    setPlaying(value: boolean): void;
    setHistoryActive(value: boolean): void;
    setSpeed(value: number): void;
    seek(seconds: number): void;
    setTrails(value: boolean): void;
    setLabels(value: boolean): void;
    setFilter(kind: string): void;
    focus(): void;
    destroy(): void;
}

/**
 * 场景调用编排层。
 * 本类只管理目标集合、时钟、筛选和相机；具体模型逻辑由 actors 目录负责。
 */
export class CesiumTools {
    private readonly actors = new Map<string, BaseTrackedActor>();
    private readonly sources = new Map<string, HistoricalTrajectorySource>();
    private selected: string;
    private following = false;
    private followHeading?: number;
    private followRange?: number;
    private followUpdatedAt?: number;
    private orbiting = false;
    private orbitHeading = 0;
    private showTrails = true;
    private historyActive: boolean;
    private filter = 'all';
    private lastUiUpdate = -1;
    private loadVersion = 0;
    private start!: Cesium.JulianDate;
    private mineBounds!: Cesium.BoundingSphere;
    private removeClick?: () => void;
    private removeTick?: () => void;

    constructor(
        private readonly viewer: CesiumBase,
        private readonly config: TrackingSceneConfig,
        private readonly onTick: (seconds: number) => void,
        private readonly onSelect: (id: string) => void,
        private readonly options: TrackingSceneOptions,
        private trajectoryData: Awaited<ReturnType<typeof loadTrajectories>>
    ) {
        this.selected = config.initialTargetId ?? config.targets[0]?.id ?? '';
        this.historyActive = options.historyActive ?? true;
    }

    async mount(): Promise<TrackingSceneController> {
        this.start = Cesium.JulianDate.fromDate(new Date(this.trajectoryData.startMs));
        this.viewer.setClockRange(this.start, this.trajectoryData.duration, this.historyActive);
        this.viewer.clock.multiplier = 1;

        // 当前接入历史数据源；以后实时模式在这里注入 RealtimePositionSource 即可。
        for (const target of this.config.targets) {
            const source = new HistoricalTrajectorySource(this.trajectoryData.tracks[target.id]);
            const actor = ActorFactory.create(this.viewer, target, source, (time) =>
                this.elapsed(time)
            );
            await actor.prepare();
            actor.mount();
            actor.setVisible(this.historyActive, this.showTrails);
            this.actors.set(target.id, actor);
        }
        this.mineBounds = this.actors.size
            ? Cesium.BoundingSphere.fromPoints(
                  [...this.actors.values()].flatMap((actor) => actor.boundsPositions())
              )
            : new Cesium.BoundingSphere(
                  Cesium.Cartesian3.fromDegrees(
                      this.config.terrain.center.longitude,
                      this.config.terrain.center.latitude,
                      this.config.terrain.center.height ?? 0
                  ),
                  0
              );
        this.bindEvents();
        this.home();
        return this.createController();
    }

    private elapsed(time: Cesium.JulianDate): number {
        return Cesium.JulianDate.secondsDifference(time, this.start);
    }

    private bindEvents(): void {
        this.removeClick = this.viewer.onLeftClick(({ pickedObject }) => {
            const id = (pickedObject as { id?: Cesium.Entity } | undefined)?.id?.id;
            if (typeof id === 'string') this.select(id);
        });
        const listener = (clock: Cesium.Clock) => {
            const seconds = Math.max(
                0,
                Math.min(this.trajectoryData.duration, this.elapsed(clock.currentTime))
            );
            if (seconds - this.lastUiUpdate >= 0.1 || seconds < this.lastUiUpdate) {
                this.lastUiUpdate = seconds;
                this.onTick(seconds);
                this.options.onTelemetry?.(
                    this.actors.get(this.selected)?.stateAt(seconds) ?? this.emptyState()
                );
            }
            if (this.orbiting) {
                this.orbitHeading += 0.00035 * Math.max(0.25, Math.abs(0));
                this.viewer.camera.lookAt(
                    this.mineBounds.center,
                    new Cesium.HeadingPitchRange(
                        this.orbitHeading,
                        Cesium.Math.toRadians(-35),
                        this.config.camera?.orbitRange ?? 3800
                    )
                );
            }
            if (this.following) this.updateFollowCamera(seconds);
        };
        this.viewer.clock.onTick.addEventListener(listener);
        this.removeTick = () => this.viewer.clock.onTick.removeEventListener(listener);
    }

    private select(id: string): void {
        const actor = this.actors.get(id);
        if (!actor) return;
        this.selected = id;
        this.onSelect(id);
        if (this.following) {
            this.followHeading = undefined;
            this.followRange = undefined;
            this.updateFollowCamera(this.elapsed(this.viewer.clock.currentTime));
        }
    }

    /** 按轨迹航向从目标后方观察，转弯时沿最短角度平滑旋转。 */
    private updateFollowCamera(seconds: number): void {
        const actor = this.actors.get(this.selected);
        const position = actor?.entity?.position?.getValue(this.viewer.clock.currentTime);
        const viewFrom = actor?.entity?.viewFrom?.getValue(this.viewer.clock.currentTime);
        if (!actor || !position || !viewFrom) return;
        const now = performance.now();
        const targetHeading = actor.stateAt(seconds).heading;
        if (this.followHeading === undefined) {
            this.followHeading = targetHeading;
        } else {
            const deltaSeconds = Math.min((now - (this.followUpdatedAt ?? now)) / 1000, 0.1);
            const blend = 1 - Math.exp(-deltaSeconds / 0.25);
            this.followHeading +=
                Cesium.Math.negativePiToPi(targetHeading - this.followHeading) * blend;
        }
        this.followUpdatedAt = now;
        const horizontalDistance = Math.hypot(viewFrom.x, viewFrom.y);
        const defaultRange = Cesium.Cartesian3.magnitude(viewFrom);
        if (this.followRange === undefined) {
            this.followRange = defaultRange;
        } else {
            // Cesium 的滚轮缩放会改变当前局部相机距离；下次跟随更新沿用该距离。
            const cameraRange = Cesium.Cartesian3.magnitude(this.viewer.camera.position);
            if (Number.isFinite(cameraRange) && cameraRange > 1) this.followRange = cameraRange;
        }
        this.viewer.camera.lookAt(
            position,
            new Cesium.HeadingPitchRange(
                this.followHeading,
                -Math.atan2(viewFrom.z, horizontalDistance),
                this.followRange
            )
        );
    }

    private home(top = false): void {
        this.following = false;
        this.orbiting = false;
        this.releaseCamera();
        const range = top
            ? (this.config.camera?.topRange ?? Math.max(2400, this.mineBounds.radius * 3.5))
            : (this.config.camera?.range ?? Math.max(1800, this.mineBounds.radius * 2.8));
        this.viewer.camera.flyToBoundingSphere(this.mineBounds, {
            offset: new Cesium.HeadingPitchRange(
                top ? 0 : Cesium.Math.toRadians(-28),
                top ? -(Cesium.Math.PI_OVER_TWO - 0.0001) : Cesium.Math.toRadians(-42),
                range
            ),
            duration: 1.2,
        });
    }

    private releaseCamera(): void {
        this.followHeading = undefined;
        this.followRange = undefined;
        this.followUpdatedAt = undefined;
        this.viewer.trackedEntity = undefined;
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }

    private updateVisibility(): void {
        this.actors.forEach((actor) => {
            const visible = this.filter === 'all' || actor.target.kind === this.filter;
            actor.setVisible(visible, this.showTrails);
        });
    }

    private createController(): TrackingSceneController {
        return {
            duration: this.trajectoryData.duration,
            viewer: this.viewer,
            loadTargets: (targets, preserveCamera) => this.loadTargets(targets, preserveCamera),
            updateRealtimeTargets: (targets) => this.updateRealtimeTargets(targets),
            select: (id) => this.select(id),
            home: (top) => this.home(top),
            follow: () => {
                this.following = !this.following;
                this.orbiting = false;
                this.releaseCamera();
                if (this.following)
                    this.updateFollowCamera(this.elapsed(this.viewer.clock.currentTime));
                return this.following;
            },
            orbit: () => {
                this.orbiting = !this.orbiting;
                this.following = false;
                this.releaseCamera();
                if (this.orbiting) this.orbitHeading = this.viewer.camera.heading;
                return this.orbiting;
            },
            setPlaying: (value) => this.viewer.setPlayback(this.historyActive && value),
            setHistoryActive: (value) => {
                if (this.historyActive === value) return;
                this.historyActive = value;
                this.following = false;
                this.orbiting = false;
                this.viewer.camera.cancelFlight();
                this.releaseCamera();
                if (!value) this.viewer.setPlayback(false);
                this.updateVisibility();
            },
            setSpeed: (value) => {
                this.viewer.clock.multiplier = value;
            },
            seek: (seconds) => {
                this.viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
                    this.start,
                    Math.max(0, Math.min(seconds, this.trajectoryData.duration)),
                    new Cesium.JulianDate()
                );
            },
            setTrails: (value) => {
                this.showTrails = value;
                this.updateVisibility();
            },
            setLabels: (value) => this.actors.forEach((actor) => actor.setLabelVisible(value)),
            setFilter: (kind) => {
                this.filter = kind;
                this.updateVisibility();
            },
            focus: () => {
                const actor = this.actors.get(this.selected);
                this.following = false;
                this.orbiting = false;
                this.releaseCamera();
                if (!actor?.entity) return;
                this.viewer.flyTo(actor.entity, {
                    duration: 0.8,
                    offset: new Cesium.HeadingPitchRange(
                        0,
                        Cesium.Math.toRadians(-20),
                        actor.focusRange()
                    ),
                });
            },
            destroy: () => this.destroy(),
        };
    }

    private async loadTargets(targets: TrackedTarget[], preserveCamera = false): Promise<number> {
        const version = ++this.loadVersion;
        const trajectoryData = await loadTrajectories(targets);
        const start = Cesium.JulianDate.fromDate(new Date(trajectoryData.startMs));
        const actors: BaseTrackedActor[] = [];
        const sources = new Map<string, HistoricalTrajectorySource>();
        for (const target of targets) {
            const source = new HistoricalTrajectorySource(trajectoryData.tracks[target.id]);
            const actor = ActorFactory.create(this.viewer, target, source, (time) =>
                Cesium.JulianDate.secondsDifference(time, start)
            );
            await actor.prepare();
            if (version !== this.loadVersion) return 0;
            actors.push(actor);
            sources.set(target.id, source);
        }
        if (version !== this.loadVersion) return 0;

        this.viewer.setPlayback(false);
        this.following = false;
        this.orbiting = false;
        this.releaseCamera();
        this.actors.forEach((actor) => {
            if (actor.entity) this.viewer.entities.remove(actor.entity);
            if (actor.trail) this.viewer.entities.remove(actor.trail);
        });
        this.actors.clear();
        this.sources.clear();
        this.start = start;
        this.trajectoryData = trajectoryData;
        this.selected =
            (preserveCamera && targets.find((target) => target.id === this.selected)?.id) ||
            targets.find((target) => target.id === this.config.initialTargetId)?.id ||
            targets[0]?.id ||
            '';
        this.lastUiUpdate = -1;
        this.viewer.setClockRange(start, trajectoryData.duration, this.historyActive);
        for (const actor of actors) {
            actor.mount();
            actor.setVisible(true, this.showTrails);
            this.actors.set(actor.target.id, actor);
            this.sources.set(actor.target.id, sources.get(actor.target.id)!);
        }
        if (actors.length) {
            this.mineBounds = Cesium.BoundingSphere.fromPoints(
                actors.flatMap((actor) => actor.boundsPositions())
            );
        }
        this.updateVisibility();
        if (!preserveCamera) this.home();
        this.onSelect(this.selected);
        this.onTick(0);
        this.options.onTelemetry?.(this.actors.get(this.selected)?.stateAt(0) ?? this.emptyState());
        return trajectoryData.duration;
    }

    private async updateRealtimeTargets(targets: TrackedTarget[]): Promise<number> {
        if (this.historyActive) return 0;
        if (
            this.actors.size !== targets.length ||
            targets.some((target) => !this.actors.has(target.id))
        ) {
            const duration = await this.loadTargets(targets, true);
            if (this.historyActive || !this.actors.size) return 0;
            // this.viewer.clock.multiplier = 30;
            this.viewer.setPlayback(true);
            return duration;
        }
        const version = this.loadVersion;
        const trajectoryData = await loadTrajectories(targets);
        if (version !== this.loadVersion || this.historyActive) return 0;
        for (const target of targets)
            this.sources.get(target.id)?.updateTrack(trajectoryData.tracks[target.id]);
        this.trajectoryData = trajectoryData;
        this.viewer.scene.requestRender();
        return trajectoryData.duration;
    }

    private destroy(): void {
        this.removeClick?.();
        this.removeTick?.();
        this.actors.clear();
        CesiumInstance.resetInstance(this.viewer.container, this.viewer);
        if (!this.viewer.isDestroyed()) this.viewer.destroy();
    }

    private emptyState(): TrajectoryState {
        return {
            longitude: 0,
            latitude: 0,
            height: 0,
            heading: 0,
            speed: 0,
            distance: 0,
            duration: 0,
            stage: '无数据',
        };
    }
}

export async function createTrackingScene(
    container: HTMLElement,
    onTick: (seconds: number) => void,
    onSelect: (id: string) => void,
    _onError: (message: string) => void,
    options: TrackingSceneOptions = {},
    config: TrackingSceneConfig
): Promise<TrackingSceneController> {
    const [viewer, trajectories] = await Promise.all([
        CesiumInstance.getInstance(container, {
            terrainUrl: config.terrain.url,
            imageryUrl: config.imageryUrl,
        }),
        loadTrajectories(config.targets),
    ]);
    return new CesiumTools(viewer, config, onTick, onSelect, options, trajectories).mount();
}

export const createScene = createTrackingScene;
