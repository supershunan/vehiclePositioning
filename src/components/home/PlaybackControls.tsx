import type React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { DateRangePicker } from 'rsuite';
import { useState } from 'react';
import { siteConfig } from '../../siteConfig';
import type { TrackedTarget } from '../../tracking';

interface Props {
    time: number;
    duration: number;
    playing: boolean;
    speed: number;
    formatTime(seconds: number): string;
    onPlaying(value: boolean): void;
    onSeek(seconds: number): void;
    onSpeed(value: number): void;
    onData(targets: TrackedTarget[]): void;
}

const {
    afterToday,
} = DateRangePicker;

export default function PlaybackControls(props: Props) {
    const progress = props.duration > 0 ? (props.time / props.duration) * 100 : 0;

    const [dateRange, setDateRange] = useState<[Date, Date] | null>([new Date(), new Date()]);

    function changeDateRange(value: [Date, Date] | null) {
        setDateRange(value);
    }

    function handleOk(value: [Date, Date] | null) {
        if (value) props.onData(siteConfig.targets);
    }

    return (
        <section className="playback">
            <DateRangePicker value={dateRange} onChange={changeDateRange} placement="topStart" cleanable={false} onOk={handleOk} shouldDisableDate={afterToday()} />
            <div className="playback-head">
                <div>
                    <span className="playback-tag">历史轨迹</span>
                    <b>2026年09月10日</b>
                    <span className="playback-range">
                        09:30 — {props.formatTime(props.duration).slice(0, 5)}
                    </span>
                </div>
                <span className="sync">
                    <i />
                    人车动作同步回放
                </span>
            </div>
            <div className="playback-main">
                <button
                    className="play"
                    title={props.playing ? '暂停' : '播放'}
                    onClick={() => props.onPlaying(!props.playing)}
                >
                    {props.playing ? (
                        <Pause size={20} fill="currentColor" />
                    ) : (
                        <Play size={20} fill="currentColor" />
                    )}
                </button>
                <button className="restart" title="从头播放" onClick={() => props.onSeek(0)}>
                    <RotateCcw size={18} />
                </button>
                <strong className="time">{props.formatTime(props.time)}</strong>
                <div className="scrubber">
                    <input
                        aria-label="回放时间"
                        type="range"
                        min="0"
                        max={props.duration}
                        step=".1"
                        value={props.time}
                        style={{ '--progress': `${progress}%` } as React.CSSProperties}
                        onChange={(event) => props.onSeek(+event.target.value)}
                    />
                    <div className="ticks">
                        {Array.from({ length: 6 }, (_, index) =>
                            props.formatTime((props.duration * index) / 5).slice(0, 5)
                        ).map((text, index) => (
                            <span key={`${text}-${index}`}>{text}</span>
                        ))}
                    </div>
                </div>
                <select
                    aria-label="播放倍速"
                    value={props.speed}
                    onChange={(event) => props.onSpeed(+event.target.value)}
                >
                    {[0.25, 0.5, 1, 2, 4, 8, 16].map((value) => (
                        <option value={value} key={value}>
                            {value}× 倍速
                        </option>
                    ))}
                </select>
            </div>
        </section>
    );
}
