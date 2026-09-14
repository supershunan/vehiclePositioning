import { trajectoryAt } from '../../trajectory';
import type { TrajectoryState, TrajectoryTrack } from '../../tracking/types';

export type ActorPositionPoint = Pick<TrajectoryState, 'longitude' | 'latitude' | 'height'>;
export interface ActorTerrainSample extends ActorPositionPoint {
    /** 相对于全局轨迹起点的秒数。 */
    seconds: number;
}

/**
 * 目标位置数据源协议。
 * 历史回放和实时定位只需实现此接口，模型渲染层无需关心数据来自 JSON 还是 WebSocket。
 */
export interface ActorPositionSource {
    stateAt(seconds: number): TrajectoryState;
    boundsPoints(): readonly ActorTerrainSample[];
}

/** 当前 JSON 历史轨迹的数据源实现。 */
export class HistoricalTrajectorySource implements ActorPositionSource {
    private readonly sampledBounds: ActorTerrainSample[];

    constructor(private track: TrajectoryTrack) {
        // 原始点可能相隔数分钟，按 5 秒加密后再交给地形采样。
        const first = track.samples[0].seconds;
        const last = track.samples.at(-1)!.seconds;
        this.sampledBounds = [];
        for (let seconds = first; seconds < last; seconds += 5) {
            this.sampledBounds.push({ ...trajectoryAt(track, seconds), seconds });
        }
        this.sampledBounds.push({ ...trajectoryAt(track, last), seconds: last });
    }

    stateAt(seconds: number): TrajectoryState {
        return trajectoryAt(this.track, seconds);
    }

    updateTrack(track: TrajectoryTrack): void {
        this.track = track;
    }

    boundsPoints(): readonly ActorTerrainSample[] {
        return this.sampledBounds;
    }
}
