import { createContext, useContext } from 'react';
import type { TrackedTarget, TrackingSceneController, TrajectoryState } from '../../tracking';
import type { TrackingMode } from './TrackingModeDock';
import type { siteConfig } from '../../siteConfig';

export interface ModelDataBindings {
    config: typeof siteConfig;
    mode: TrackingMode;
    time: number;
    duration: number;
    playing: boolean;
    speed: number;
    clockText(seconds: number): string;
    onReady(controller: TrackingSceneController): void;
    onTick(seconds: number): void;
    onSelect(id: string): void;
    onTelemetry(state: TrajectoryState): void;
    onLoading(value: boolean): void;
    onError(message: string): void;
    onModeChange(value: TrackingMode): void;
    onPlaying(value: boolean): void;
    onSeek(seconds: number): void;
    onSpeed(value: number): void;
    onData(targets: TrackedTarget[]): void;
}

export const ModelDataContext = createContext<ModelDataBindings | null>(null);

export function useModelData(): ModelDataBindings {
    const context = useContext(ModelDataContext);
    if (!context) throw new Error('useModelData 必须在 ModelData 内使用');
    return context;
}
