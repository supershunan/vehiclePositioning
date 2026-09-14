import { CesiumBase, type CesiumBaseOptions } from './CesiumBase';

/** 按容器管理 Viewer，避免 React 重复挂载时创建多个 WebGL 上下文。 */
export default class CesiumInstance {
    private static readonly instances = new Map<Element | string, CesiumBase>();

    static async getInstance(
        container: Element | string,
        options: CesiumBaseOptions
    ): Promise<CesiumBase> {
        const existing = this.instances.get(container);
        if (existing && !existing.isDestroyed()) return existing;
        const viewer = await CesiumBase.create(container, options);
        this.instances.set(container, viewer);
        return viewer;
    }

    static resetInstance(container: Element | string, expected?: CesiumBase): void {
        const current = this.instances.get(container);
        if (!expected || current === expected) this.instances.delete(container);
    }
}
