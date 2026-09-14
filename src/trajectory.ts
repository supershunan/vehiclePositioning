import type {
    GeographicPointInput,
    LoadedTrajectories,
    TrackedTarget,
    TrajectorySample,
    TrajectoryState,
    TrajectoryTrack,
} from './tracking/types';

const EARTH_RADIUS = 6371008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const shortestTurn = (from: number, to: number) =>
    Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** 在轨迹点前后各留一小段时间转向，避免分段航向在点位处跳变。 */
function smoothHeading(samples: TrajectorySample[], low: number, seconds: number): number {
    const current = samples[low];
    const next = samples[low + 1];
    const turnAt = (index: number, before: number, after: number) => {
        const point = samples[index];
        const window = Math.min(3, before / 2, after / 2);
        if (window <= 0 || Math.abs(seconds - point.seconds) >= window) return undefined;
        const fraction = (seconds - point.seconds + window) / (2 * window);
        const eased = fraction * fraction * (3 - 2 * fraction);
        const incoming = samples[index - 1].heading;
        return incoming + shortestTurn(incoming, point.heading) * eased;
    };
    if (low > 0) {
        const heading = turnAt(low, samples[low - 1].segmentDuration, current.segmentDuration);
        if (heading !== undefined) return heading;
    }
    if (low + 2 < samples.length) {
        const heading = turnAt(
            low + 1,
            next.seconds - current.seconds,
            samples[low + 2].seconds - next.seconds
        );
        if (heading !== undefined) return heading;
    }
    return current.heading;
}

/**
 * 纯数学大圆计算，避免数据层依赖 Cesium。
 * 返回地表距离、起始航向，以及沿球面插值的方法。
 */
function greatCircle(
    a: { longitude: number; latitude: number },
    b: { longitude: number; latitude: number }
) {
    const lon1 = toRadians(a.longitude),
        lat1 = toRadians(a.latitude);
    const lon2 = toRadians(b.longitude),
        lat2 = toRadians(b.latitude);
    const deltaLon = lon2 - lon1;
    const haversine =
        Math.sin((lat2 - lat1) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const angularDistance =
        2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
    const heading = Math.atan2(
        Math.sin(deltaLon) * Math.cos(lat2),
        Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
    );
    return {
        distance: EARTH_RADIUS * angularDistance,
        heading,
        interpolate(fraction: number) {
            if (angularDistance < 1e-12) return { longitude: a.longitude, latitude: a.latitude };
            const denominator = Math.sin(angularDistance);
            const first = Math.sin((1 - fraction) * angularDistance) / denominator;
            const second = Math.sin(fraction * angularDistance) / denominator;
            const x =
                first * Math.cos(lat1) * Math.cos(lon1) + second * Math.cos(lat2) * Math.cos(lon2);
            const y =
                first * Math.cos(lat1) * Math.sin(lon1) + second * Math.cos(lat2) * Math.sin(lon2);
            const z = first * Math.sin(lat1) + second * Math.sin(lat2);
            return {
                longitude: toDegrees(Math.atan2(y, x)),
                latitude: toDegrees(Math.atan2(z, Math.hypot(x, y))),
            };
        },
    };
}

/** 在进入渲染循环前统一校验轨迹数据，避免错误数据传给 Cesium。 */
function validatePoint(point: GeographicPointInput, index: number, source: string) {
    const longitude = Number(point.longitude);
    const latitude = Number(point.latitude);
    const height = Number(point.height ?? 0);
    const time = Date.parse(point.timestamp);
    if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(height) ||
        !Number.isFinite(time) ||
        Math.abs(longitude) > 180 ||
        Math.abs(latitude) > 90
    ) {
        throw new Error(`${source} 第 ${index + 1} 个轨迹点格式无效`);
    }
    return { longitude, latitude, height, time, timestamp: point.timestamp };
}

function segmentMetrics(
    a: { longitude: number; latitude: number; height: number },
    b: { longitude: number; latitude: number; height: number }
) {
    const geodesic = greatCircle(a, b);
    return {
        distance: Math.hypot(geodesic.distance, b.height - a.height),
        heading: geodesic.heading,
    };
}

/** 预计算每段距离、航向和速度，逐帧采样时只需二分查找与插值。 */
function prepare(points: GeographicPointInput[], source: string): TrajectoryTrack {
    if (points.length < 2) throw new Error(`${source} 至少需要两个轨迹点`);
    const raw = points
        .map((point, index) => validatePoint(point, index, source))
        .sort((a, b) => a.time - b.time);
    const samples = raw.map((point) => ({
        ...point,
        seconds: 0,
        distance: 0,
        segmentDistance: 0,
        segmentDuration: 0,
        speed: 0,
        heading: 0,
    })) as TrajectorySample[];
    let cumulative = 0;
    for (let index = 0; index < samples.length - 1; index += 1) {
        const current = samples[index],
            next = samples[index + 1];
        const duration = (next.time - current.time) / 1000;
        if (duration <= 0) throw new Error(`${source} 时间戳必须严格递增`);
        const metrics = segmentMetrics(current, next);
        current.segmentDistance = metrics.distance;
        current.segmentDuration = duration;
        current.speed = (metrics.distance / duration) * 3.6;
        current.heading = metrics.heading;
        next.distance = cumulative += metrics.distance;
    }
    samples.at(-1)!.heading = samples.at(-2)!.heading;
    return {
        samples,
        startMs: samples[0].time,
        stopMs: samples.at(-1)!.time,
        length: cumulative,
    };
}

/** 处理配置中的所有轨迹，并把时间统一为全局起点后的秒数。 */
export async function loadTrajectories(targets: TrackedTarget[]): Promise<LoadedTrajectories> {
    if (!targets.length) {
        const now = Date.now();
        return { tracks: {}, startMs: now, stopMs: now, duration: 0 };
    }
    const entries = targets.map((target) => {
        if (!Array.isArray(target.data)) throw new Error(`${target.name} 的 data 必须是轨迹点数组`);
        return [target.id, prepare(target.data, target.name)] as const;
    });
    const tracks = Object.fromEntries(entries);
    const startMs = Math.min(...entries.map(([, track]) => track.startMs));
    const stopMs = Math.max(...entries.map(([, track]) => track.stopMs));
    for (const track of Object.values(tracks))
        for (const sample of track.samples) sample.seconds = (sample.time - startMs) / 1000;
    return { tracks, startMs, stopMs, duration: (stopMs - startMs) / 1000 };
}

/** 按时间进行测地线插值；超出轨迹范围时保持在起点或终点。 */
export function trajectoryAt(track: TrajectoryTrack, seconds: number): TrajectoryState {
    const samples = track.samples;
    if (seconds <= samples[0].seconds)
        return {
            ...samples[0],
            speed: 0,
            duration: (track.stopMs - track.startMs) / 1000,
            stage: '等待出发',
        };
    if (seconds >= samples.at(-1)!.seconds)
        return {
            ...samples.at(-1)!,
            speed: 0,
            duration: (track.stopMs - track.startMs) / 1000,
            stage: '已到终点',
        };
    let low = 0,
        high = samples.length - 1;
    while (low + 1 < high) {
        const middle = (low + high) >> 1;
        if (samples[middle].seconds <= seconds) low = middle;
        else high = middle;
    }
    const a = samples[low],
        b = samples[high];
    const fraction = (seconds - a.seconds) / (b.seconds - a.seconds);
    const geodesic = greatCircle(a, b);
    const position = geodesic.interpolate(fraction);
    return {
        longitude: position.longitude,
        latitude: position.latitude,
        height: a.height + (b.height - a.height) * fraction,
        heading: smoothHeading(samples, low, seconds),
        speed: a.speed,
        distance: a.distance + a.segmentDistance * fraction,
        duration: (track.stopMs - track.startMs) / 1000,
        stage: '轨迹运行中',
    };
}
