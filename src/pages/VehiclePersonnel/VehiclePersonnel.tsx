import { ArrowUpRight, LocateFixed, Maximize, Route, Truck, Users } from 'lucide-react';
import type { TrackedTarget, TrajectoryState } from '../../tracking';

interface ListProps {
    targets: TrackedTarget[];
    selectedId: string;
    state: TrajectoryState;
    onSelect(id: string): void;
}

/** 车辆和人员业务列表。 */
export function VehiclePersonnelList({ targets, selectedId, state, onSelect }: ListProps) {
    return (
        <>
            {targets.map((item) => (
                <button
                    className={`target ${selectedId === item.id ? 'selected' : ''}`}
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                >
                    <span className={`target-icon ${item.kind}`}>
                        {item.kind === 'vehicle' ? <Truck size={19} /> : <Users size={18} />}
                    </span>
                    <span className="target-copy">
                        <b>{item.kind === 'vehicle' ? item.id : item.name.split(' · ')[0]}</b>
                        <small>
                            {item.kind === 'vehicle' ? item.name : `${item.id} · ${item.area}`}
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

/** 当前车辆或人员的业务详情和操作。 */
export default function VehiclePersonnel({
    item,
    state,
    following,
    onFollow,
    onFocus,
}: DetailProps) {
    return (
        <section className="detail panel">
            <div className="detail-eyebrow">
                <span>当前选中目标</span>
                <span className="online">
                    <i />
                    在线
                </span>
            </div>
            <div className="detail-name">
                <div className={`target-icon ${item.kind}`}>
                    {item.kind === 'vehicle' ? <Truck size={24} /> : <Users size={24} />}
                </div>
                <div>
                    <h2>{item.kind === 'vehicle' ? item.id : item.name.split(' · ')[0]}</h2>
                    <p>
                        {item.kind === 'vehicle'
                            ? '宽体自卸矿卡 · 运输作业'
                            : '安全作业人员 · 步行巡检'}
                    </p>
                </div>
                <ArrowUpRight size={20} />
            </div>
            <div className="detail-metrics">
                <div>
                    <span>当前速度</span>
                    <strong>
                        {state.speed.toFixed(2)}
                        <small>km/h</small>
                    </strong>
                </div>
                <div>
                    <span>累计移动</span>
                    <strong>
                        {(state.distance / 1000).toFixed(3)}
                        <small>km</small>
                    </strong>
                </div>
            </div>
            <dl>
                <dt>{item.operatorLabel}</dt>
                <dd>{item.operator}</dd>
                <dt>当前区域</dt>
                <dd>{state.stage}</dd>
                <dt>平台标高</dt>
                <dd>
                    贴合地形 <small>局部基准</small>
                </dd>
                <dt>定位终端</dt>
                <dd>
                    BD-{item.id.replace('-', '')} <span className="signal">▂▄▆█</span>
                </dd>
            </dl>
            <div className="detail-actions">
                <button className={following ? 'primary following' : 'primary'} onClick={onFollow}>
                    <LocateFixed size={16} />
                    {following ? '退出跟随' : '跟随目标'}
                </button>
                <button title="近距离查看模型动作" onClick={onFocus}>
                    <Maximize size={16} />
                    近景
                </button>
            </div>
            <p className="detail-note">
                <Route size={12} />
                轨迹保留最近 110 秒的移动路径
            </p>
        </section>
    );
}
