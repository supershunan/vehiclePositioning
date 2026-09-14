import { History, Radio, X } from 'lucide-react';
import PlaybackControls from './PlaybackControls';
import type { TrackedTarget } from '../../tracking';

interface Props {
    mode: TrackingMode;
    onModeChange(mode: TrackingMode): void;
    time: number;
    duration: number;
    playing: boolean;
    speed: number;
    formatTime(seconds: number): string;
    onPlaying(value: boolean): void;
    onSeek(seconds: number): void;
    onSpeed(value: number): void;
    onHistoryData(targets: TrackedTarget[]): void;
}

export type TrackingMode = 'realtime' | 'history';

export default function TrackingModeDock(props: Props) {
    const { mode, onModeChange: setMode } = props;

    return (
        <div className={`tracking-dock ${mode === 'history' ? 'history-open' : ''}`}>
            {mode === 'history' && (
                <section className="history-console panel" aria-label="历史轨迹控制台">
                    <PlaybackControls
                        time={props.time}
                        duration={props.duration}
                        playing={props.playing}
                        speed={props.speed}
                        formatTime={props.formatTime}
                        onPlaying={props.onPlaying}
                        onSeek={props.onSeek}
                        onSpeed={props.onSpeed}
                        onData={props.onHistoryData}
                    />
                    <button
                        className="history-close"
                        title="收起历史轨迹"
                        onClick={() => setMode('realtime')}
                    >
                        <X size={16} />
                    </button>
                </section>
            )}
            <nav className="tracking-mode-menu panel" aria-label="定位模式">
                <button
                    className={mode === 'realtime' ? 'active' : ''}
                    aria-pressed={mode === 'realtime'}
                    onClick={() => setMode('realtime')}
                >
                    <Radio size={16} />
                    实时定位
                </button>
                <button
                    className={mode === 'history' ? 'active' : ''}
                    aria-pressed={mode === 'history'}
                    onClick={() => setMode('history')}
                >
                    <History size={16} />
                    历史轨迹
                </button>
            </nav>
        </div>
    );
}
