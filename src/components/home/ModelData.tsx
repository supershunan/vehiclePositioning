import { useRef, useState, type ReactNode } from 'react';
import type { TrackedTarget, TrackingSceneController, TrajectoryState } from '../../tracking';
import { siteConfig } from '../../siteConfig';
import TargetPanel from './TargetPanel';
import SceneToolbar from './SceneToolbar';
import type { TrackingMode } from './TrackingModeDock';
import { ModelDataContext } from './modelDataContext';
import VehiclePersonnel, { VehiclePersonnelList } from '../../pages/VehiclePersonnel/VehiclePersonnel';
import DroneInspection, { DroneInspectionList } from '../../pages/DroneInspection/DroneInspection';

const initialState: TrajectoryState = {
    longitude: 0,
    latitude: 0,
    height: 0,
    speed: 0,
    distance: 0,
    heading: 0,
    stage: '等待轨迹',
    duration: 0,
};
const clockText = (seconds: number) => {
    const total = 9 * 3600 + 30 * 60 + Math.floor(seconds);
    return [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60]
        .map((value) => String(value).padStart(2, '0'))
        .join(':');
};

/** 统一接收两种目标数据，并管理模型、列表和详情的业务状态。 */
export default function ModelData({ children }: { children: ReactNode }) {
    const scene = useRef<TrackingSceneController | null>(null);
    const [mode, setMode] = useState<TrackingMode>('realtime');
    const historyActive = mode === 'history';
    const [sceneConfig] = useState(() => ({ ...siteConfig, targets: [] }));
    const [fleet, setFleet] = useState<TrackedTarget[]>([]);
    const pendingData = useRef<TrackedTarget[] | null>(null);
    const requestId = useRef(0);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [selected, setSelected] = useState('');
    const [telemetry, setTelemetry] = useState<TrajectoryState>(initialState);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [trails, setTrails] = useState(true);
    const [labels, setLabels] = useState(true);
    const [following, setFollowing] = useState(false);
    const [orbiting, setOrbiting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [collapsed, setCollapsed] = useState(false);

    const selectedItem = fleet.find((item) => item.id === selected) ?? fleet[0];
    const filteredTargets = fleet.filter(
        (item) =>
            (filter === 'all' || item.kind === filter) &&
            `${item.name}${item.id}`.toLowerCase().includes(query.toLowerCase())
    );
    const tabs = [
        { value: 'all', label: '全部', count: fleet.length },
        ...Array.from(new Map(fleet.map((item) => [item.kind, item.kindLabel])).entries()).map(
            ([value, label]) => ({
                value,
                label,
                count: fleet.filter((item) => item.kind === value).length,
            })
        ),
    ];

    const stopCameraModes = () => {
        setFollowing(false);
        setOrbiting(false);
    };
    const selectTarget = (id: string) => scene.current?.select(id);
    const changeMode = (value: TrackingMode) => {
        ++requestId.current;
        pendingData.current = null;
        setMode(value);
        scene.current?.setHistoryActive(value === 'history');
        scene.current?.setPlaying(false);
        setPlaying(false);
        setFleet([]);
        setTime(0);
        setDuration(0);
        setSelected('');
        setTelemetry(initialState);
        if (scene.current) void scene.current.loadTargets([], true);
        stopCameraModes();
    };

    const loadData = async (
        controller: TrackingSceneController,
        targets: TrackedTarget[],
        realtime: boolean,
        id: number
    ) => {
        try {
            const result = realtime
                ? await controller.updateRealtimeTargets(targets)
                : await controller.loadTargets(targets);
            if (id !== requestId.current) return;
            setFleet(targets);
            setDuration(realtime ? 0 : result);
        } catch (cause) {
            if (id === requestId.current)
                setError(cause instanceof Error ? cause.message : String(cause));
        }
    };

    const receiveData = (targets: TrackedTarget[]) => {
        const id = ++requestId.current;
        const realtime = mode === 'realtime';
        if (!realtime) {
            setPlaying(false);
            setTime(0);
            setDuration(0);
            setTelemetry(initialState);
            setFilter('all');
        }
        if (!realtime || !fleet.length)
            setSelected(siteConfig.initialTargetId ?? targets[0]?.id ?? '');
        if (scene.current) void loadData(scene.current, targets, realtime, id);
        else pendingData.current = targets;
    };

    return (
        <ModelDataContext.Provider value={{
                config: sceneConfig,
                mode,
                time,
                duration,
                playing,
                speed,
                clockText,
                onReady: (controller) => {
                    scene.current = controller;
                    setDuration(controller.duration);
                    controller.setHistoryActive(historyActive);
                    controller.setPlaying(historyActive && playing);
                    if (pendingData.current) {
                        const targets = pendingData.current;
                        pendingData.current = null;
                        void loadData(controller, targets, mode === 'realtime', requestId.current);
                    }
                },
                onTick: setTime,
                onSelect: setSelected,
                onTelemetry: setTelemetry,
                onLoading: setLoading,
                onError: setError,
                onModeChange: changeMode,
                onPlaying: (value) => {
                    setPlaying(value);
                    scene.current?.setPlaying(value);
                },
                onSeek: (seconds) => scene.current?.seek(seconds),
                onSpeed: (value) => {
                    setSpeed(value);
                    scene.current?.setSpeed(value);
                },
                onData: receiveData,
            }}>
        <main className={collapsed ? 'collapsed' : ''}>
            {children}

            {/* 左侧运行目标 */}
            <TargetPanel
                    collapsed={collapsed}
                    query={query}
                    filter={filter}
                    total={fleet.length}
                    vehicleCount={fleet.filter((item) => item.kind === 'vehicle').length}
                    personCount={fleet.filter((item) => item.kind === 'person').length}
                    tabs={tabs}
                    hasResults={filteredTargets.length > 0}
                    onCollapsed={setCollapsed}
                    onQuery={setQuery}
                    onFilter={(kind) => {
                        setFilter(kind);
                        scene.current?.setFilter(kind);
                    }}
                >
                    <VehiclePersonnelList
                        targets={filteredTargets.filter((item) => item.kind !== 'drone')}
                        selectedId={selected}
                        state={telemetry}
                        onSelect={selectTarget}
                    />
                    <DroneInspectionList
                        targets={filteredTargets.filter((item) => item.kind === 'drone')}
                        selectedId={selected}
                        state={telemetry}
                        onSelect={selectTarget}
                    />
            </TargetPanel>

            {/* 右侧菜单 */}
            <SceneToolbar
                trails={trails}
                labels={labels}
                orbiting={orbiting}
                onHome={() => {
                    scene.current?.home();
                    stopCameraModes();
                }}
                onTop={() => {
                    scene.current?.home(true);
                    stopCameraModes();
                }}
                onTrails={() => {
                    const value = !trails;
                    setTrails(value);
                    scene.current?.setTrails(value);
                }}
                onLabels={() => {
                    const value = !labels;
                    setLabels(value);
                    scene.current?.setLabels(value);
                }}
                onOrbit={() => {
                    setOrbiting(scene.current?.orbit() ?? false);
                    setFollowing(false);
                }}
            />

            {selectedItem &&
                (selectedItem.kind === 'drone' ? (
                    <DroneInspection
                        item={selectedItem}
                        state={telemetry}
                        following={following}
                        onFollow={() => {
                            setFollowing(scene.current?.follow() ?? false);
                            setOrbiting(false);
                        }}
                        onFocus={() => {
                            scene.current?.focus();
                            stopCameraModes();
                        }}
                    />
                ) : (
                    <VehiclePersonnel
                        item={selectedItem}
                        state={telemetry}
                        following={following}
                        onFollow={() => {
                            setFollowing(scene.current?.follow() ?? false);
                            setOrbiting(false);
                        }}
                        onFocus={() => {
                            scene.current?.focus();
                            stopCameraModes();
                        }}
                    />
                ))}

            {loading && !error && <div className="loading">正在构建三维矿区…</div>}
            {error && (
                <div className="error">
                    <h2>三维场景加载失败</h2>
                    <p>{error}</p>
                    <button onClick={() => location.reload()}>重新加载</button>
                </div>
            )}
        </main>
        </ModelDataContext.Provider>
    );
}
