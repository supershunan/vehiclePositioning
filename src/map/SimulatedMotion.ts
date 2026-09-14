/**
 * 纯运动计算模块。
 *
 * 本文件不导入 Cesium、React、业务配置或网络模块。所有距离单位为米，时间单位为秒，
 * 对外速度单位为 km/h。调用者只负责输入参数并消费输出状态。
 */

export type MotionPoint2 = readonly [number, number];
export type MotionPoint3 = [number, number, number];
export type DrivingMode = 'adaptive' | 'constant';

export interface MotionProfileOptions {
    points: MotionPoint2[];
    cornerRadius?: number;
    height?: number;
    cruiseKmh: number;
    acceleration?: number;
    braking?: number;
    maxLateralAcceleration?: number;
    mode?: DrivingMode;
    speedStrategy?: MotionSpeedStrategy;
    strategyName?: string;
}

export interface MotionProfile {
    points: MotionPoint3[];
    distances: number[];
    headings: number[];
    curvature: number[];
    speeds: number[];
    times: number[];
    duration: number;
    length: number;
}

export interface MotionState {
    position: MotionPoint3;
    heading: number;
    speed: number;
    distance: number;
    turnRate: number;
    steer: number;
    stage: string;
    duration: number;
}

/** 策略模式：负责根据曲率和距离生成每个采样点的速度。 */
export interface MotionSpeedStrategy {
    createSpeeds(
        curvature: readonly number[],
        distances: readonly number[],
        options: MotionProfileOptions
    ): number[];
}

export class ConstantSpeedStrategy implements MotionSpeedStrategy {
    createSpeeds(
        curvature: readonly number[],
        _distances: readonly number[],
        options: MotionProfileOptions
    ): number[] {
        return curvature.map(() => options.cruiseKmh / 3.6);
    }
}

/** 弯道限速，并应用前向加速和反向制动约束。 */
export class AdaptiveSpeedStrategy implements MotionSpeedStrategy {
    createSpeeds(
        curvature: readonly number[],
        distances: readonly number[],
        options: MotionProfileOptions
    ): number[] {
        const vmax = options.cruiseKmh / 3.6;
        const acceleration = options.acceleration ?? 1.2;
        const braking = options.braking ?? 1.8;
        const lateral = options.maxLateralAcceleration ?? 1.3;
        const speeds = curvature.map((value) =>
            Math.min(vmax, Math.sqrt(lateral / Math.max(Math.abs(value), 0.00001)))
        );
        speeds[0] = 0;
        speeds[speeds.length - 1] = 0;
        for (let i = 1; i < speeds.length; i++)
            speeds[i] = Math.min(
                speeds[i],
                Math.sqrt(speeds[i - 1] ** 2 + 2 * acceleration * (distances[i] - distances[i - 1]))
            );
        for (let i = speeds.length - 2; i >= 0; i--)
            speeds[i] = Math.min(
                speeds[i],
                Math.sqrt(speeds[i + 1] ** 2 + 2 * braking * (distances[i + 1] - distances[i]))
            );
        return speeds;
    }
}

const strategies: Record<string, MotionSpeedStrategy> = {
    adaptive: new AdaptiveSpeedStrategy(),
    constant: new ConstantSpeedStrategy(),
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const distance2D = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1]);
const normalizeAngle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

/** 把折线路口转换成连续的二次贝塞尔弯道。 */
function roundCorners(points: MotionPoint2[], trim: number): MotionPoint2[] {
    if (points.length < 2) throw new Error('模拟路线至少需要两个点');
    const output: MotionPoint2[] = [points[0]];
    const pushLine = (point: MotionPoint2) => {
        const start = output.at(-1)!;
        const count = Math.max(1, Math.ceil(distance2D(start, point) / 0.6));
        for (let i = 1; i <= count; i++)
            output.push([lerp(start[0], point[0], i / count), lerp(start[1], point[1], i / count)]);
    };
    for (let i = 1; i < points.length - 1; i++) {
        const previous = points[i - 1],
            corner = points[i],
            next = points[i + 1];
        const radius = Math.min(
            trim,
            distance2D(previous, corner) * 0.45,
            distance2D(corner, next) * 0.45
        );
        const entry: MotionPoint2 = [
            corner[0] + ((previous[0] - corner[0]) * radius) / distance2D(previous, corner),
            corner[1] + ((previous[1] - corner[1]) * radius) / distance2D(previous, corner),
        ];
        const exit: MotionPoint2 = [
            corner[0] + ((next[0] - corner[0]) * radius) / distance2D(corner, next),
            corner[1] + ((next[1] - corner[1]) * radius) / distance2D(corner, next),
        ];
        pushLine(entry);
        const count = Math.max(12, Math.ceil(radius * 4));
        for (let step = 1; step <= count; step++) {
            const t = step / count;
            output.push([
                entry[0] * (1 - t) ** 2 + 2 * corner[0] * t * (1 - t) + exit[0] * t ** 2,
                entry[1] * (1 - t) ** 2 + 2 * corner[1] * t * (1 - t) + exit[1] * t ** 2,
            ]);
        }
    }
    pushLine(points.at(-1)!);
    return output;
}

/** 由任意局部米制路线构建可重复采样的运动剖面。 */
export function buildMotionProfile(options: MotionProfileOptions): MotionProfile {
    const points = roundCorners(options.points, options.cornerRadius ?? 0).map(
        ([x, y]) => [x, y, options.height ?? 0] as MotionPoint3
    );
    const distances = [0];
    for (let i = 1; i < points.length; i++)
        distances.push(distances[i - 1] + distance2D(points[i - 1], points[i]));
    const headings = points.map((_, i) => {
        const a = points[Math.max(0, i - 2)],
            b = points[Math.min(points.length - 1, i + 2)];
        return Math.atan2(b[0] - a[0], b[1] - a[1]);
    });
    const curvature = headings.map((_, i) => {
        const a = Math.max(0, i - 2),
            b = Math.min(headings.length - 1, i + 2);
        return (
            normalizeAngle(headings[b] - headings[a]) / Math.max(0.001, distances[b] - distances[a])
        );
    });
    const strategy =
        options.speedStrategy ?? strategies[options.strategyName ?? options.mode ?? 'adaptive'];
    if (!strategy) throw new Error(`未注册的运动速度策略：${options.strategyName}`);
    const speeds = strategy.createSpeeds(curvature, distances, options);
    const times = [0];
    for (let i = 1; i < points.length; i++)
        times.push(
            times[i - 1] +
                (2 * (distances[i] - distances[i - 1])) / Math.max(0.001, speeds[i] + speeds[i - 1])
        );
    return {
        points,
        distances,
        headings,
        curvature,
        speeds,
        times,
        duration: times.at(-1)!,
        length: distances.at(-1)!,
    };
}

/** 输入模拟秒数，输出该时刻的纯运动状态。 */
export function sampleMotionProfile(
    profile: MotionProfile,
    seconds: number,
    wheelbase = 5.2
): MotionState {
    const time = Math.max(0, seconds);
    if (time >= profile.duration)
        return {
            position: profile.points.at(-1)!,
            heading: profile.headings.at(-1)!,
            speed: 0,
            distance: profile.length,
            turnRate: 0,
            steer: 0,
            stage: '已到终点',
            duration: profile.duration,
        };
    let low = 0,
        high = profile.times.length - 1;
    while (low + 1 < high) {
        const middle = (low + high) >> 1;
        if (profile.times[middle] <= time) low = middle;
        else high = middle;
    }
    const duration = profile.times[high] - profile.times[low];
    const elapsed = time - profile.times[low];
    const acceleration = (profile.speeds[high] - profile.speeds[low]) / duration;
    const traveled = profile.speeds[low] * elapsed + 0.5 * acceleration * elapsed ** 2;
    const fraction = traveled / Math.max(0.001, profile.distances[high] - profile.distances[low]);
    const velocity = profile.speeds[low] + acceleration * elapsed;
    const curvature = lerp(profile.curvature[low], profile.curvature[high], fraction);
    return {
        position: profile.points[low].map((value, index) =>
            lerp(value, profile.points[high][index], fraction)
        ) as MotionPoint3,
        heading:
            profile.headings[low] +
            normalizeAngle(profile.headings[high] - profile.headings[low]) * fraction,
        speed: velocity * 3.6,
        distance: profile.distances[low] + traveled,
        turnRate: (curvature * velocity * 180) / Math.PI,
        steer: Math.atan(wheelbase * curvature),
        stage:
            Math.abs(curvature) > 0.002
                ? '转弯中'
                : acceleration > 0.05
                  ? '加速中'
                  : acceleration < -0.05
                    ? '减速中'
                    : '直线巡航',
        duration: profile.duration,
    };
}

export class SimulatedMotion {
    public readonly profile: MotionProfile;
    public readonly wheelbase: number;

    constructor(profile: MotionProfile, wheelbase = 5.2) {
        this.profile = profile;
        this.wheelbase = wheelbase;
    }
    sample(seconds: number): MotionState {
        return sampleMotionProfile(this.profile, seconds, this.wheelbase);
    }
}

/** 工厂模式入口，可注入或注册新的速度策略。 */
export class SimulatedMotionFactory {
    static create(options: MotionProfileOptions, wheelbase = 5.2): SimulatedMotion {
        return new SimulatedMotion(buildMotionProfile(options), wheelbase);
    }
    static registerStrategy(name: string, strategy: MotionSpeedStrategy): void {
        if (!name.trim()) throw new Error('策略名称不能为空');
        strategies[name] = strategy;
    }
}
