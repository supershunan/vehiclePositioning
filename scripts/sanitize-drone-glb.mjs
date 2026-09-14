import fs from 'node:fs';

const input = 'public/models/drone.glb';
const output = 'public/models/drone-cesium.glb';
const source = fs.readFileSync(input);

if (source.toString('utf8', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
    throw new Error(`${input} 不是有效的 GLB 2.0 文件`);
}

const chunks = [];
let offset = 12;
while (offset < source.length) {
    const length = source.readUInt32LE(offset);
    const type = source.readUInt32LE(offset + 4);
    chunks.push({ type, data: source.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
}

const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
if (!jsonChunk) throw new Error('GLB 缺少 JSON 块');

const gltf = JSON.parse(jsonChunk.data.toString('utf8').trimEnd());
let removed = 0;
for (const material of gltf.materials ?? []) {
    if (material.extensions?.KHR_materials_anisotropy) {
        delete material.extensions.KHR_materials_anisotropy;
        removed += 1;
        if (Object.keys(material.extensions).length === 0) delete material.extensions;
    }
}

for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (!gltf[key]) continue;
    gltf[key] = gltf[key].filter((name) => name !== 'KHR_materials_anisotropy');
    if (gltf[key].length === 0) delete gltf[key];
}

const json = Buffer.from(JSON.stringify(gltf));
const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(paddedJson);
const rebuiltChunks = chunks.map((chunk) => ({
    type: chunk.type,
    data: chunk.type === 0x4e4f534a ? paddedJson : chunk.data,
}));
const totalLength = 12 + rebuiltChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const result = Buffer.alloc(totalLength);
result.write('glTF', 0);
result.writeUInt32LE(2, 4);
result.writeUInt32LE(totalLength, 8);
offset = 12;
for (const chunk of rebuiltChunks) {
    result.writeUInt32LE(chunk.data.length, offset);
    result.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(result, offset + 8);
    offset += 8 + chunk.data.length;
}

fs.writeFileSync(output, result);
console.log(`Generated ${output}; removed anisotropy from ${removed} materials.`);
