/** 目标高度解释方式。贴地目标可以不传 height。 */
export type AltitudeMode = 'clamp-to-ground' | 'absolute' | 'relative-to-route-maximum';
export type RotationAxis = 'x' | 'y' | 'z';

export interface GeographicPointInput {
    /** WGS84 经度，单位：度。 */
    longitude: number;
    /** WGS84 纬度，单位：度。 */
    latitude: number;
    /** ISO 8601 时间，建议始终携带时区，例如 +08:00。 */
    timestamp: string;
    /** 单位：米；具体含义由目标的 altitudeMode 决定。 */
    height?: number;
}

export interface ModelNodeRotation {
    nodeName: string;
    axis: RotationAxis;
    radiansPerSecond: number;
}

export interface TrackedTarget {
    /** 全局唯一 ID，也是轨迹表的索引键。 */
    id: string;
    name: string;
    kind: string;
    kindLabel: string;
    operatorLabel: string;
    operator: string;
    area: string;
    status: string;
    data: GeographicPointInput[];
    altitudeMode: AltitudeMode;
    model: {
        uri: string;
        scale?: number;
        minimumPixelSize?: number;
        maximumScale?: number;
        headingOffsetRadians?: number;
        nodeRotations?: ModelNodeRotation[];
    };
    style: {
        color: string;
        trailColor: string;
        icon: 'vehicle' | 'person' | 'aircraft';
    };
}

export interface TrackingSceneConfig {
    /** Cesium quantized-mesh 地形服务配置。 */
    terrain: {
        url: string;
        center: { longitude: number; latitude: number; height?: number };
        sampleLevel?: number;
    };
    imageryUrl?: string;
    /** 所有需要加载和播放的目标；同一种 kind 可以配置任意多个。 */
    targets: TrackedTarget[];
    initialTargetId?: string;
    camera?: { range?: number; topRange?: number; orbitRange?: number };
}

export interface TrajectorySample extends GeographicPointInput {
    height: number;
    time: number;
    seconds: number;
    distance: number;
    segmentDistance: number;
    segmentDuration: number;
    speed: number;
    heading: number;
}

export interface TrajectoryTrack {
    samples: TrajectorySample[];
    startMs: number;
    stopMs: number;
    length: number;
}

export interface TrajectoryState {
    longitude: number;
    latitude: number;
    height: number;
    heading: number;
    speed: number;
    distance: number;
    duration: number;
    stage: string;
}

export interface LoadedTrajectories {
    tracks: Record<string, TrajectoryTrack>;
    startMs: number;
    stopMs: number;
    duration: number;
}
