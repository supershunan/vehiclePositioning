import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
const base = 'node_modules/cesium/Build/Cesium';
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'cesium-assets',
            configureServer(server) {
                server.middlewares.use('/cesium', (req, res, next) => {
                    const p = path.resolve(base, '.' + decodeURIComponent(req.url.split('?')[0]));
                    if (
                        !p.startsWith(path.resolve(base) + path.sep) ||
                        !fs.existsSync(p) ||
                        fs.statSync(p).isDirectory()
                    )
                        return next();
                    const ext = path.extname(p);
                    res.setHeader(
                        'Content-Type',
                        {
                            '.js': 'application/javascript',
                            '.json': 'application/json',
                            '.wasm': 'application/wasm',
                            '.png': 'image/png',
                            '.css': 'text/css',
                        }[ext as '.js' | '.json' | '.wasm' | '.png' | '.css'] ||
                            'application/octet-stream'
                    );
                    fs.createReadStream(p).pipe(res);
                });
            },
            closeBundle() {
                for (const dir of ['Workers', 'Assets', 'Widgets', 'ThirdParty'])
                    fs.cpSync(`${base}/${dir}`, `dist/cesium/${dir}`, {
                        recursive: true,
                    });
            },
        },
    ],
    define: { CESIUM_BASE_URL: JSON.stringify('/cesium') },
    server: {
        proxy: {
            '/local-terrain': {
                target: 'http://127.0.0.1:7777',
                changeOrigin: true,
                rewrite: (url) => url.replace(/^\/local-terrain/, '/terrain'),
            },
        },
    },
    build: { chunkSizeWarningLimit: 1500 },
});
