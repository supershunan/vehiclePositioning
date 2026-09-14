import ModelData from '../../components/home/ModelData';
import { useModelData } from '../../components/home/modelDataContext';
import Cesium from '../../components/map/Cesium';
import DashboardHeader from '../../components/home/DashboardHeader';
import Real from '../../components/home/Real';
import TrackingModeDock from '../../components/home/TrackingModeDock';

/** 首页组合地图、数据源、顶部信息和定位模式控件。 */
export default function Home() {
    return (
        <ModelData>
            <HomeContent />
        </ModelData>
    );
}

function HomeContent() {
    const model = useModelData();
    return (
        <>
            <Cesium
                config={model.config}
                onReady={model.onReady}
                onTick={model.onTick}
                onSelect={model.onSelect}
                onTelemetry={model.onTelemetry}
                onLoading={model.onLoading}
                onError={model.onError}
            />
            <DashboardHeader timeText={model.clockText(model.time)} />
            {model.mode === 'realtime' && <Real onData={model.onData} />}
            <TrackingModeDock
                mode={model.mode}
                onModeChange={model.onModeChange}
                time={model.time}
                duration={model.duration}
                playing={model.playing}
                speed={model.speed}
                formatTime={model.clockText}
                onPlaying={model.onPlaying}
                onSeek={model.onSeek}
                onSpeed={model.onSpeed}
                onHistoryData={model.onData}
            />
        </>
    );
}
