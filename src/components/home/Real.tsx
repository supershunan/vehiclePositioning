import { useEffect, useRef } from 'react';
import { siteConfig } from '../../siteConfig';
import type { TrackedTarget } from '../../tracking';

interface Props {
    onData(targets: TrackedTarget[]): void;
}

/** 临时实时数据源：定时推送每个目标轨迹中的下一个位置。 */
export default function Real({ onData }: Props) {
    const callback = useRef(onData);
    useEffect(() => {
        callback.current = onData;
    }, [onData]);
    useEffect(() => {
        let index = 0;
        const publish = () => {
            callback.current(
                siteConfig.targets.map((target) => ({
                    ...target,
                    data: target.data.map((point, pointIndex) => ({
                        ...point,
                        longitude:
                            point.longitude +
                            Math.sin(index * 0.35 + pointIndex * 0.4) * 0.000002,
                    })),
                }))
            );
            index += 1;
        };
        publish();
        const timer = window.setInterval(publish, 5000);
        return () => window.clearInterval(timer);
    }, []);

    return null;
}
