import { ArrowUpRight, LocateFixed, Maximize, Plane, Route } from 'lucide-react';
import type { TrackedTarget, TrajectoryState } from '../../tracking';

interface ListProps {
    targets: TrackedTarget[];
    selectedId: string;
    state: TrajectoryState;
    onSelect(id: string): void;
}

/** 无人机巡检业务列表。 */
export function DroneInspectionList({ targets, selectedId, state, onSelect }: ListProps) {
    return (
        <>
            {targets.map((item) => (
                <button
                    className={`target ${selectedId === item.id ? 'selected' : ''}`}
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                >
                    <span className="target-icon drone">
                        <Plane size={19} />
                    </span>
                    <span className="target-copy">
                        <b>{item.name.split(' · ')[0]}</b>
                        <small>
                            {item.id} · {item.area}
                        </small>
                    </span>
                    <span className="target-status">
                        <i />
                        {item.status}
                        <small>{selectedId === item.id ? state.speed.toFixed(1) : '--'} km/h</small>
                    </span>
                </button>
            ))}
        </>
    );
}

interface DetailProps {
    item: TrackedTarget;
    state: TrajectoryState;
    following: boolean;
    onFollow(): void;
    onFocus(): void;
}

/** 无人机巡检详情和操作。 */
export default function DroneInspection({
    item,
    state,
    following,
    onFollow,
    onFocus,
}: DetailProps) {
    return (
        <div className="drone-detail-layout">
            <div className="drone-video panel">
                <div className="drone-video-heading">
                    <span>无人机实时画面</span>
                </div>
                <video src="/video/drone.mp4" controls autoPlay playsInline aria-label="无人机实时画面" />
            </div>
            <section className="detail panel">
                <div className="detail-eyebrow">
                    <span>当前巡检设备</span>
                    <span className="online">
                        <i />
                        在线
                    </span>
                </div>
                <div className="detail-name">
                    <div className="target-icon drone">
                        <Plane size={24} />
                    </div>
                    <div>
                        <h2>{item.name.split(' · ')[0]}</h2>
                        <p>四旋翼无人机 · 空中巡检</p>
                    </div>
                    <ArrowUpRight size={20} />
                </div>
                <div className="detail-metrics">
                    <div>
                        <span>飞行速度</span>
                        <strong>
                            {state.speed.toFixed(2)}
                            <small>km/h</small>
                        </strong>
                    </div>
                    <div>
                        <span>累计航程</span>
                        <strong>
                            {(state.distance / 1000).toFixed(3)}
                            <small>km</small>
                        </strong>
                    </div>
                </div>
                <dl>
                    <dt>{item.operatorLabel}</dt>
                    <dd>{item.operator}</dd>
                    <dt>巡检区域</dt>
                    <dd>{state.stage}</dd>
                    <dt>飞行高度</dt>
                    <dd>
                        {state.height.toFixed(0)} m <small>航线地形最高点以上</small>
                    </dd>
                    <dt>定位终端</dt>
                    <dd>
                        BD-{item.id.replace('-', '')} <span className="signal">▂▄▆█</span>
                    </dd>
                </dl>
                <div className="detail-actions">
                    <button
                        className={following ? 'primary following' : 'primary'}
                        onClick={onFollow}
                    >
                        <LocateFixed size={16} />
                        {following ? '退出跟随' : '跟随目标'}
                    </button>
                    <button title="近距离查看无人机" onClick={onFocus}>
                        <Maximize size={16} />
                        近景
                    </button>
                </div>
                <p className="detail-note">
                    <Route size={12} />
                    巡检航迹保留最近 110 秒
                </p>
            </section>
        </div>
    );
}
