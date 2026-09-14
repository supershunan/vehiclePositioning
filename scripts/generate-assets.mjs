import fs from 'node:fs';
fs.mkdirSync('public/models', { recursive: true });
function builder() {
    const chunks = [],
        views = [],
        accessors = [],
        meshes = [],
        nodes = [],
        materials = [];
    let length = 0;
    function acc(values, size) {
        const data = new Float32Array(values);
        const b = Buffer.from(data.buffer);
        views.push({ buffer: 0, byteOffset: length, byteLength: b.length });
        chunks.push(b);
        length += b.length;
        const min = Array(size).fill(Infinity),
            max = Array(size).fill(-Infinity);
        values.forEach((v, i) => {
            min[i % size] = Math.min(min[i % size], v);
            max[i % size] = Math.max(max[i % size], v);
        });
        accessors.push({
            bufferView: views.length - 1,
            componentType: 5126,
            count: values.length / size,
            type: { 1: 'SCALAR', 3: 'VEC3', 4: 'VEC4' }[size],
            min,
            max,
        });
        return accessors.length - 1;
    }
    function mat(color) {
        materials.push({
            pbrMetallicRoughness: {
                baseColorFactor: [...color, 1],
                metallicFactor: 0.05,
                roughnessFactor: 0.88,
            },
            doubleSided: true,
        });
        return materials.length - 1;
    }
    function mesh(positions, material) {
        const normals = [];
        for (let i = 0; i < positions.length; i += 9) {
            let a = positions.slice(i, i + 3),
                b = positions.slice(i + 3, i + 6),
                c = positions.slice(i + 6, i + 9),
                u = b.map((v, j) => v - a[j]),
                v = c.map((v, j) => v - a[j]),
                n = [
                    u[1] * v[2] - u[2] * v[1],
                    u[2] * v[0] - u[0] * v[2],
                    u[0] * v[1] - u[1] * v[0],
                ],
                l = Math.hypot(...n) || 1;
            n = n.map((v) => v / l);
            normals.push(...n, ...n, ...n);
        }
        meshes.push({
            primitives: [
                {
                    attributes: { POSITION: acc(positions, 3), NORMAL: acc(normals, 3) },
                    material,
                },
            ],
        });
        return meshes.length - 1;
    }
    function box(name, pos, scale, m, parent) {
        const v = [
                [-0.5, -0.5, -0.5],
                [0.5, -0.5, -0.5],
                [0.5, 0.5, -0.5],
                [-0.5, 0.5, -0.5],
                [-0.5, -0.5, 0.5],
                [0.5, -0.5, 0.5],
                [0.5, 0.5, 0.5],
                [-0.5, 0.5, 0.5],
            ],
            ids = [
                0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0,
                7, 3, 1, 2, 6, 1, 6, 5,
            ];
        return node(
            name,
            mesh(
                ids.flatMap((i) => v[i]),
                m
            ),
            pos,
            scale,
            parent
        );
    }
    function node(name, mesh, pos = [0, 0, 0], scale = [1, 1, 1], parent) {
        nodes.push({ name, mesh, translation: pos, scale });
        let id = nodes.length - 1;
        if (parent !== undefined) (nodes[parent].children ??= []).push(id);
        return id;
    }
    function wheel(name, x, y, z, m) {
        const p = [];
        for (let j = 0; j < 20; j++) {
            let a = (j * Math.PI) / 10,
                b = ((j + 1) * Math.PI) / 10;
            const q = (x, t) => [x, Math.cos(t), Math.sin(t)];
            p.push(
                ...q(-0.5, a),
                ...q(0.5, a),
                ...q(0.5, b),
                ...q(-0.5, a),
                ...q(0.5, b),
                ...q(-0.5, b),
                -0.5,
                0,
                0,
                ...q(-0.5, b),
                ...q(-0.5, a),
                0.5,
                0,
                0,
                ...q(0.5, a),
                ...q(0.5, b)
            );
        }
        const pivot = node('steer' + x + z, undefined, [x, y, z]);
        const id = node(name, mesh(p, m), [0, 0, 0], [0.65, 1, 1], pivot);
        const rim = mat([0.62, 0.65, 0.59]);
        box('spoke', [x > 0 ? 0.52 : -0.52, 0, 0], [0.06, 1.25, 0.14], rim, id);
        box('spoke2', [x > 0 ? 0.52 : -0.52, 0, 0], [0.06, 0.14, 1.25], rim, id);
        return id;
    }
    function save(name) {
        let children = new Set(nodes.flatMap((n) => n.children || []));
        fs.writeFileSync(
            `public/models/${name}.gltf`,
            JSON.stringify({
                asset: { version: '2.0', generator: 'Mine demo procedural assets' },
                scene: 0,
                scenes: [{ nodes: nodes.map((_, i) => i).filter((i) => !children.has(i)) }],
                nodes,
                meshes,
                materials,
                buffers: [
                    {
                        uri:
                            'data:application/octet-stream;base64,' +
                            Buffer.concat(chunks).toString('base64'),
                        byteLength: length,
                    },
                ],
                bufferViews: views,
                accessors,
            })
        );
    }
    return { mat, mesh, node, box, wheel, save };
}
{
    const b = builder(),
        yellow = b.mat([0.94, 0.58, 0.12]),
        dark = b.mat([0.08, 0.1, 0.12]),
        glass = b.mat([0.17, 0.31, 0.36]),
        metal = b.mat([0.48, 0.5, 0.48]),
        white = b.mat([0.85, 0.91, 0.87]);
    b.box('chassis', [0, 1.3, 0], [3.9, 0.65, 7.8], dark);
    b.box('cab', [0, 2.65, 2.5], [3.5, 2.3, 2.5], yellow);
    b.box('windscreen', [0, 2.95, 3.77], [2.9, 1.1, 0.07], glass);
    b.box('roof', [0, 3.95, 2.5], [3.9, 0.24, 2.9], yellow);
    b.box('bed', [0, 2.25, -1.7], [4.4, 0.4, 5.1], yellow);
    for (let x of [-2, 2]) b.box('side', [x, 3.15, -1.7], [0.35, 1.8, 5.1], yellow);
    b.box('tail', [0, 3.1, -4.1], [4.3, 1.6, 0.3], yellow);
    b.box('ore', [0, 2.8, -1.7], [3.5, 0.75, 4.3], metal);
    for (let x of [-1.4, 1.4]) b.box('light', [x, 1.8, 3.8], [0.5, 0.35, 0.15], white);
    for (let x of [-2.05, 2.05])
        for (let z of [-2.65, 2.55]) b.wheel(`wheel${x}${z}`, x, 1, z, dark);
    b.save('truck');
}
{
    const b = builder(),
        orange = b.mat([1, 0.38, 0.08]),
        navy = b.mat([0.12, 0.21, 0.28]),
        skin = b.mat([0.77, 0.55, 0.37]),
        yellow = b.mat([1, 0.78, 0.16]),
        reflect = b.mat([0.87, 0.97, 0.72]);
    b.box('torso', [0, 1.25, 0], [0.55, 0.65, 0.3], orange);
    b.box('stripe', [0, 1.28, 0.158], [0.56, 0.09, 0.02], reflect);
    b.box('head', [0, 1.78, 0], [0.31, 0.34, 0.3], skin);
    b.box('helmet', [0, 1.98, 0], [0.43, 0.16, 0.41], yellow);
    for (let side of [-1, 1]) {
        let leg = b.node('leg' + side, undefined, [side * 0.17, 0.98, 0]);
        b.box('trouser', [0, -0.36, 0], [0.23, 0.7, 0.24], navy, leg);
        b.box('boot', [0, -0.76, 0.08], [0.27, 0.18, 0.4], navy, leg);
        let arm = b.node('arm' + side, undefined, [side * 0.39, 1.52, 0]);
        b.box('sleeve', [0, -0.28, 0], [0.19, 0.57, 0.22], orange, arm);
        b.box('hand', [0, -0.61, 0], [0.17, 0.17, 0.18], skin, arm);
    }
    b.save('worker');
}
{
    const b = builder();
    const shell = b.mat([0.86, 0.9, 0.96]),
        dark = b.mat([0.08, 0.12, 0.2]),
        blue = b.mat([0.22, 0.52, 1]);
    b.box('body', [0, 0, 0], [1.1, 0.35, 1.5], shell);
    b.box('nose', [0, 0, 0.8], [0.6, 0.2, 0.12], blue);
    b.box('camera', [0, -0.4, 0.55], [0.3, 0.3, 0.3], dark);
    for (const x of [-1, 1])
        for (const z of [-1, 1]) {
            b.box('arm', [x * 0.7, 0, z * 0.6], [1.4, 0.13, 0.15], dark);
            b.box('motor', [x * 1.3, 0.15, z * 0.6], [0.22, 0.25, 0.22], blue);
            const rotor = b.node(`rotor${x}${z}`, undefined, [x * 1.3, 0.3, z * 0.6]);
            b.box('blade', [0, 0, 0], [1.05, 0.035, 0.12], dark, rotor);
            b.box('blade', [0, 0, 0], [0.12, 0.035, 1.05], dark, rotor);
        }
    for (const x of [-0.45, 0.45]) b.box('landingLeg', [x, -0.4, 0], [0.09, 0.65, 1.1], dark);
    b.save('drone');
}
console.log('Generated local truck, worker and drone glTF models.');
