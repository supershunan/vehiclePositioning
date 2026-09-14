import type { CesiumBase } from '../CesiumBase';
import type { TrackedTarget } from '../../tracking/types';
import type { ActorPositionSource } from './ActorPositionSource';
import { BaseTrackedActor } from './BaseTrackedActor';
import { VehicleActor } from './VehicleActor';
import { PersonActor } from './PersonActor';
import { DroneActor } from './DroneActor';

type ActorConstructor = new (
    viewer: CesiumBase,
    target: TrackedTarget,
    source: ActorPositionSource,
    elapsedSeconds: (time: import('cesium').JulianDate) => number
) => BaseTrackedActor;

/** 工厂只负责根据 kind 选择类，CesiumTools 无需出现目标类型分支。 */
export class ActorFactory {
    private static readonly constructors: Record<string, ActorConstructor> = {
        vehicle: VehicleActor,
        person: PersonActor,
        drone: DroneActor,
    };

    static create(
        viewer: CesiumBase,
        target: TrackedTarget,
        source: ActorPositionSource,
        elapsedSeconds: (time: import('cesium').JulianDate) => number
    ): BaseTrackedActor {
        const Constructor = this.constructors[target.kind];
        if (!Constructor) throw new Error(`暂不支持目标类型：${target.kind}`);
        return new Constructor(viewer, target, source, elapsedSeconds);
    }

    static register(kind: string, constructor: ActorConstructor): void {
        this.constructors[kind] = constructor;
    }
}
