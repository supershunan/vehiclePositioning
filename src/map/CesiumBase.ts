import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export interface CesiumBaseOptions {
    terrainUrl: string;
    imageryUrl?: string;
}

export interface CesiumPointerEvent {
    screenPosition: Cesium.Cartesian2;
    cartesian?: Cesium.Cartesian3;
    longitude?: number;
    latitude?: number;
    height?: number;
    pickedObject?: unknown;
}

export type CesiumPointerCallback = (event: CesiumPointerEvent) => void;

/**
 * Cesium 初始化层。
 * 只负责 Viewer、地形、底图、基础渲染参数和鼠标事件，不包含任何车辆业务。
 */
export class CesiumBase extends Cesium.Viewer {
    readonly terrain: Cesium.CesiumTerrainProvider;
    private readonly pointerHandler: Cesium.ScreenSpaceEventHandler;
    private readonly leftClickCallbacks = new Set<CesiumPointerCallback>();

    private constructor(
        container: Element | string,
        terrain: Cesium.CesiumTerrainProvider,
        options: Cesium.Viewer.ConstructorOptions
    ) {
        super(container, options);
        this.terrain = terrain;
        this.screenSpaceEventHandler.removeInputAction(
            Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
        this.pointerHandler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.pointerHandler.setInputAction(
            (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) =>
                this.emitLeftClick(event.position),
            Cesium.ScreenSpaceEventType.LEFT_CLICK
        );
        this.configureScene();
    }

    static async create(
        container: Element | string,
        options: CesiumBaseOptions
    ): Promise<CesiumBase> {
        const terrain = await Cesium.CesiumTerrainProvider.fromUrl(options.terrainUrl, {
            requestVertexNormals: false,
            requestWaterMask: false,
        });
        return new CesiumBase(container, terrain, {
            terrainProvider: terrain,
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
                Cesium.ArcGisMapServerImageryProvider.fromUrl(
                    options.imageryUrl ??
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
                    { enablePickFeatures: false }
                )
            ),
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            infoBox: false,
            selectionIndicator: false,
            skyBox: false,
            skyAtmosphere: false,
            scene3DOnly: true,
            shadows: false,
            shouldAnimate: true,
            msaaSamples: 4,
        });
    }

    onLeftClick(callback: CesiumPointerCallback): () => void {
        this.leftClickCallbacks.add(callback);
        return () => this.leftClickCallbacks.delete(callback);
    }

    setClockRange(start: Cesium.JulianDate, durationSeconds: number, loop = true): void {
        this.clock.startTime = start.clone();
        this.clock.stopTime = Cesium.JulianDate.addSeconds(
            start,
            durationSeconds,
            new Cesium.JulianDate()
        );
        this.clock.currentTime = start.clone();
        this.clock.clockRange = loop ? Cesium.ClockRange.LOOP_STOP : Cesium.ClockRange.CLAMPED;
    }

    setPlayback(playing: boolean, multiplier = this.clock.multiplier): void {
        this.clock.shouldAnimate = playing;
        this.clock.multiplier = multiplier;
        this.scene.requestRender();
    }

    override destroy(): void {
        if (this.isDestroyed()) return;
        this.leftClickCallbacks.clear();
        if (!this.pointerHandler.isDestroyed()) this.pointerHandler.destroy();
        super.destroy();
    }

    private configureScene(): void {
        this.scene.backgroundColor = Cesium.Color.fromCssColorString('#d5dfdc');
        this.scene.fog.enabled = false;
        this.scene.highDynamicRange = false;
        this.scene.globe.baseColor = Cesium.Color.fromCssColorString('#8b927f');
        this.scene.globe.depthTestAgainstTerrain = true;
        this.scene.globe.maximumScreenSpaceError = 1.5;
        this.scene.globe.tileCacheSize = 180;
        this.scene.globe.showGroundAtmosphere = false;
    }

    private emitLeftClick(screenPosition: Cesium.Cartesian2): void {
        let cartesian: Cesium.Cartesian3 | undefined;
        if (this.scene.pickPositionSupported) cartesian = this.scene.pickPosition(screenPosition);
        if (!cartesian) {
            const ray = this.camera.getPickRay(screenPosition);
            cartesian = ray ? this.scene.globe.pick(ray, this.scene) : undefined;
        }
        const payload: CesiumPointerEvent = {
            screenPosition,
            pickedObject: this.scene.pick(screenPosition),
            cartesian,
        };
        if (cartesian) {
            const point = this.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
            payload.longitude = Cesium.Math.toDegrees(point.longitude);
            payload.latitude = Cesium.Math.toDegrees(point.latitude);
            payload.height = point.height;
            console.log({
                longitude: Cesium.Math.toDegrees(point.longitude),
                latitude: Cesium.Math.toDegrees(point.latitude),
            });
        }
        this.leftClickCallbacks.forEach((callback) => callback(payload));
    }
}
