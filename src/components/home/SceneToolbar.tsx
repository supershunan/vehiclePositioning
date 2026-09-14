import { Eye, Layers, Mountain, Orbit, Route } from 'lucide-react';

interface Props {
    trails: boolean;
    labels: boolean;
    orbiting: boolean;
    onHome(): void;
    onTop(): void;
    onTrails(): void;
    onLabels(): void;
    onOrbit(): void;
}

export default function SceneToolbar(props: Props) {
    return (
        <div className="scene-tools">
            <button title="全矿视角" onClick={props.onHome}>
                <Mountain size={19} />
            </button>
            <button title="俯视矿区" onClick={props.onTop}>
                <Layers size={19} />
            </button>
            <span />
            <button
                className={props.trails ? 'active' : ''}
                title="显示或隐藏轨迹"
                aria-pressed={props.trails}
                onClick={props.onTrails}
            >
                <Route size={19} />
            </button>
            <button
                className={props.labels ? 'active' : ''}
                title="显示或隐藏标签"
                aria-pressed={props.labels}
                onClick={props.onLabels}
            >
                <Eye size={19} />
            </button>
            <span />
            <button
                className={props.orbiting ? 'active' : ''}
                title="环绕浏览"
                onClick={props.onOrbit}
            >
                <Orbit size={19} />
            </button>
        </div>
    );
}
