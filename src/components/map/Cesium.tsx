import { useEffect, useRef } from 'react';
import { createTrackingScene } from '../../tracking';
import type { TrackingSceneConfig, TrackingSceneController, TrajectoryState } from '../../tracking';

interface CesiumProps {
    config: TrackingSceneConfig;
    onReady(controller: TrackingSceneController): void;
    onTick(seconds: number): void;
    onSelect(id: string): void;
    onTelemetry(state: TrajectoryState): void;
    onLoading?(loading: boolean): void;
    onError?(message: string): void;
}

/**
 * Cesium React 容器。
 * 统一管理 DOM、场景初始化和销毁，页面只接收 TrackingSceneController。
 */
export default function Cesium({
    config,
    onReady,
    onTick,
    onSelect,
    onTelemetry,
    onLoading,
    onError,
}: CesiumProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const callbacksRef = useRef({ onReady, onTick, onSelect, onTelemetry, onLoading, onError });

    // 单独更新回调引用，避免父组件重渲染时销毁并重建 Cesium Viewer。
    useEffect(() => {
        callbacksRef.current = { onReady, onTick, onSelect, onTelemetry, onLoading, onError };
    }, [onReady, onTick, onSelect, onTelemetry, onLoading, onError]);

    useEffect(() => {
        let cancelled = false;
        let controller: TrackingSceneController | undefined;
        callbacksRef.current.onLoading?.(true);
        callbacksRef.current.onError?.('');

        createTrackingScene(
            containerRef.current!,
            (seconds) => callbacksRef.current.onTick(seconds),
            (id) => callbacksRef.current.onSelect(id),
            (message) => callbacksRef.current.onError?.(message),
            {
                historyActive: false,
                onTelemetry: (state) => callbacksRef.current.onTelemetry(state),
            },
            config
        )
            .then((sceneController) => {
                if (cancelled) {
                    sceneController.destroy();
                    return;
                }
                controller = sceneController;
                callbacksRef.current.onReady(sceneController);
                callbacksRef.current.onLoading?.(false);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                callbacksRef.current.onLoading?.(false);
                callbacksRef.current.onError?.(
                    error instanceof Error ? error.message : String(error)
                );
            });

        return () => {
            cancelled = true;
            controller?.destroy();
        };
    }, [config]);

    return <div className="scene" ref={containerRef} />;
}
