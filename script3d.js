// ============================================================
// 3D Compression Module
// Handles: OBJ, STL, PLY — Mesh Simplification, Point Cloud
// Decimation, Depth Map Compression
// ============================================================

let current3DData = null;      // { type, vertices, faces, colors, normals, raw }
let compressed3DData = null;   // same shape after compression
let original3DFileSize = 0;
let original3DFileName = '';
let current3DCompressionPreset = 'quality'; // Current preset mode
let original3DMesh = null;     // Store original for metrics calculation

// ─── Phase 1 Improvements: 3D Compression Presets ────────────
const COMPRESSION_PRESETS_3D = {
    web: { strength: 70, algorithm: 'qem', preserveNormals: true, name: '📱 Web' },
    mobile: { strength: 50, algorithm: 'qem', preserveNormals: true, name: '📲 Mobile' },
    highQuality: { strength: 10, algorithm: 'qem', preserveNormals: true, name: '⭐ High Quality' },
    thumbnail: { strength: 85, algorithm: 'clustering', preserveNormals: false, name: '📷 Thumbnail' },
    quality: { strength: 20, algorithm: 'qem', preserveNormals: true, name: '✨ Quality' }
};

// DOM refs (set after DOMContentLoaded)
let threedBtn, threedStrength, threedStrengthValue, threedType;

document.addEventListener('DOMContentLoaded', () => {
    threedBtn          = document.getElementById('threedBtn');
    threedStrength     = document.getElementById('threedStrength');
    threedStrengthValue = document.getElementById('threedStrengthValue');
    threedType         = document.getElementById('threedType');

    if (threedBtn)      threedBtn.addEventListener('click', apply3DCompression);
    if (threedStrength) threedStrength.addEventListener('input', () => {
        threedStrengthValue.textContent = threedStrength.value;
    });
});

// ─── Auto-detect & load 3D file ──────────────────────────────

function handle3DFile(file) {
    if (!file || !file.name) {
        showError('Invalid file provided.');
        return;
    }
    original3DFileSize = file.size;
    original3DFileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    // Depth maps: PNG is a standard image — route directly to image pipeline (no re-entry risk)
    // EXR is not browser-decodable, so we reject it with a clear message
    if (ext === 'exr') {
        showError('EXR format is not supported in browsers. Convert to PNG depth map first.');
        return;
    }
    if (ext === 'png') {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                if (typeof originalFileSize !== 'undefined') originalFileSize = file.size;
                originalImage = img;
                switchMode('compress');
                const comparisonSection = document.getElementById('comparisonSection');
                const uploadArea = document.getElementById('uploadArea');
                const imgComp = document.getElementById('imageComparison');
                if (comparisonSection) comparisonSection.style.display = 'block';
                if (uploadArea) uploadArea.style.display = 'none';
                if (imgComp) imgComp.style.display = 'grid';
                if (typeof displayOriginalImage === 'function') displayOriginalImage();
                hideLoading();
                showSuccess('Depth map loaded as grayscale image.');
            };
            img.onerror = () => {
                hideLoading();
                showError('Failed to load depth map image.');
            };
            // Validate data URL before assigning to img.src (XSS fix)
            const dataURL = e.target.result;
            if (typeof dataURL === 'string' && dataURL.startsWith('data:image/')) {
                img.src = dataURL;
            } else {
                showError('Invalid depth map image data.');
            }
        };
        reader.onerror = () => showError('Failed to read depth map file.');
        reader.readAsDataURL(file);
        return;
    }

    showLoading('Parsing 3D file...');

    const reader = new FileReader();

    if (ext === 'stl') {
        reader.onload = e => {
            try {
                // Magic byte check: binary STL has no required header, but OBJ/PLY text won't be ArrayBuffer here
                const data = parseSTL(e.target.result);
                if (data.vertices.length === 0) throw new Error('No geometry found in STL file.');
                on3DLoaded(data, file);
            } catch (err) {
                hideLoading();
                showError('STL parse error: ' + sanitize3DError(err.message));
            }
        };
        reader.onerror = () => {
            hideLoading();
            showError('Failed to read STL file.');
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = e => {
            try {
                const text = e.target.result;
                // Magic byte / format validation
                if (ext === 'obj') {
                    if (!/^\s*(v|#|mtllib|o|g)/m.test(text)) throw new Error('File does not appear to be a valid OBJ.');
                } else if (ext === 'ply') {
                    if (!text.trimStart().startsWith('ply')) throw new Error('File does not appear to be a valid PLY.');
                }
                let data;
                if (ext === 'obj') data = parseOBJ(text);
                else if (ext === 'ply') data = parsePLY(text);
                else { showError('Unsupported 3D format'); return; }
                if (data.vertices.length === 0) throw new Error('No geometry found in file.');
                on3DLoaded(data, file);
            } catch (err) {
                hideLoading();
                showError('3D parse error: ' + sanitize3DError(err.message));
            }
        };
        reader.onerror = () => {
            hideLoading();
            showError('Failed to read 3D file.');
        };
        reader.readAsText(file);
    }
}

// Sanitize error messages before inserting into DOM (XSS fix)
function sanitize3DError(message) {
    if (!message) return 'Unknown error';
    return String(message).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

function on3DLoaded(data, file) {
    current3DData = data;
    compressed3DData = null;
    // Sync shared originalFileSize so metrics helpers work correctly
    if (typeof originalFileSize !== 'undefined') originalFileSize = original3DFileSize;

    if (threedType) {
        if (data.type === 'pointcloud') threedType.value = 'pointcloud';
        else threedType.value = 'mesh';
    }

    const comparisonSection = document.getElementById('comparisonSection');
    const uploadArea = document.getElementById('uploadArea');
    const imageComparison = document.getElementById('imageComparison');
    if (comparisonSection) comparisonSection.style.display = 'block';
    if (uploadArea) uploadArea.style.display = 'none';
    if (imageComparison) imageComparison.style.display = 'none';

    update3DStats('original', data);
    render3D(document.getElementById('originalCanvas3D'), data);
    hideLoading();
    // Sanitize file name to prevent XSS
    const safeName = sanitize3DError(file.name);
    showSuccess(`3D file loaded (${safeName}): ${data.vertices.length.toLocaleString()} vertices, ${data.faces.length.toLocaleString()} faces`);
}

// ─── Parsers ─────────────────────────────────────────────────

function parseOBJ(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid OBJ data');
    }
    const vertices = [], faces = [], normals = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v' && parts.length >= 4) {
            const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) vertices.push([x, y, z]);
        } else if (parts[0] === 'vn' && parts.length >= 4) {
            normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'f' && parts.length >= 4) {
            const idx = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
            if (idx.some(i => i < 0 || i >= vertices.length)) continue;
            for (let i = 1; i < idx.length - 1; i++) {
                faces.push([idx[0], idx[i], idx[i + 1]]);
            }
        }
    }

    return { type: 'mesh', vertices, faces, normals, colors: [], raw: text, format: 'obj' };
}

function parseSTL(buffer) {
    if (!buffer || buffer.byteLength < 84) {
        throw new Error('Invalid STL file: too small');
    }
    const view = new DataView(buffer);
    const vertices = [], faces = [];

    // Reliable binary vs ASCII detection:
    // A valid binary STL has exactly 84 + triCount * 50 bytes.
    // If the size matches, treat as binary regardless of header text.
    const triCount = view.getUint32(80, true);
    const expectedBinarySize = 84 + triCount * 50;
    const isBinary = buffer.byteLength === expectedBinarySize && triCount > 0 && triCount < 10000000;

    if (!isBinary) {
        const text = new TextDecoder().decode(buffer);
        return parseSTLAscii(text);
    }

    // Binary STL: 80 header + 4 count + (50 bytes * count)
    let offset = 84;
    for (let i = 0; i < triCount; i++) {
        offset += 12; // skip normal
        const vBase = vertices.length;
        for (let v = 0; v < 3; v++) {
            vertices.push([
                view.getFloat32(offset, true),
                view.getFloat32(offset + 4, true),
                view.getFloat32(offset + 8, true)
            ]);
            offset += 12;
        }
        faces.push([vBase, vBase + 1, vBase + 2]);
        offset += 2; // attribute byte count
    }

    return { type: 'mesh', vertices, faces, normals: [], colors: [], raw: buffer, format: 'stl' };
}

function parseSTLAscii(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid ASCII STL data');
    }
    const vertices = [], faces = [];
    const vertRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
    let match;
    while ((match = vertRe.exec(text)) !== null) {
        vertices.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    }
    for (let i = 0; i < vertices.length; i += 3) {
        faces.push([i, i + 1, i + 2]);
    }
    return { type: 'mesh', vertices, faces, normals: [], colors: [], raw: text, format: 'stl' };
}

function parsePLY(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid PLY data');
    }
    const lines = text.split('\n');
    let vertexCount = 0, faceCount = 0;
    let headerEnd = 0;
    let hasColor = false, hasNormal = false;
    const vertexProps = [];
    let currentElement = '';

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (l.startsWith('element vertex')) {
            vertexCount = parseInt(l.split(' ')[2]);
            currentElement = 'vertex';
        } else if (l.startsWith('element face')) {
            faceCount = parseInt(l.split(' ')[2]);
            currentElement = 'face';
        } else if (l.startsWith('property') && currentElement === 'vertex') {
            const prop = l.split(' ')[2];
            vertexProps.push(prop);
            if (['red', 'green', 'blue'].includes(prop)) hasColor = true;
            if (['nx', 'ny', 'nz'].includes(prop)) hasNormal = true;
        } else if (l === 'end_header') { headerEnd = i + 1; break; }
    }

    const vertices = [], faces = [], colors = [], normals = [];

    for (let i = headerEnd; i < headerEnd + vertexCount; i++) {
        if (i >= lines.length) break;
        const parts = lines[i].trim().split(/\s+/).map(Number);
        const xi = vertexProps.indexOf('x'), yi = vertexProps.indexOf('y'), zi = vertexProps.indexOf('z');
        vertices.push([parts[xi] || 0, parts[yi] || 0, parts[zi] || 0]);
        if (hasColor) {
            const ri = vertexProps.indexOf('red'), gi = vertexProps.indexOf('green'), bi = vertexProps.indexOf('blue');
            colors.push([parts[ri] || 0, parts[gi] || 0, parts[bi] || 0]);
        }
        if (hasNormal) {
            const nxi = vertexProps.indexOf('nx'), nyi = vertexProps.indexOf('ny'), nzi = vertexProps.indexOf('nz');
            normals.push([parts[nxi] || 0, parts[nyi] || 0, parts[nzi] || 0]);
        }
    }

    for (let i = headerEnd + vertexCount; i < headerEnd + vertexCount + faceCount; i++) {
        if (i >= lines.length) break;
        const parts = lines[i].trim().split(/\s+/).map(Number);
        const count = parts[0];
        // Fan triangulation: triangle fan from parts[1]
        for (let j = 1; j < count - 1; j++) {
            faces.push([parts[1], parts[j + 1], parts[j + 2]]);
        }
    }

    const type = faces.length === 0 ? 'pointcloud' : 'mesh';
    return { type, vertices, faces, normals, colors, raw: text, format: 'ply' };
}

// ─── Compression Algorithms ───────────────────────────────────

function apply3DCompression() {
    // PHASE 1 UPDATE: Delegate to enhanced compression function
    return apply3DCompressionEnhanced();
}

// ── Mesh Simplification: Vertex Clustering ───────────────────
// Divides bounding box into a grid; merges all vertices in each
// cell to their centroid, then rebuilds faces.

function meshSimplify(data, strength) {
    if (!data || !data.vertices) {
        throw new Error('Invalid mesh data');
    }
    const { vertices, faces, colors, normals } = data;
    if (vertices.length === 0) return data;

    // Grid resolution: higher strength = coarser grid = more reduction
    // strength is 0-100, normalize to 0-1
    const strengthNorm = strength > 1 ? strength / 100 : strength;
    const gridRes = Math.max(4, Math.round(64 * (1 - strengthNorm)));

    // Compute bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of vertices) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const rx = (maxX - minX) || 1, ry = (maxY - minY) || 1, rz = (maxZ - minZ) || 1;

    // Map each vertex to a grid cell
    const cellMap = new Map(); // cellKey -> { sum, count, newIdx }
    const vertexToNew = new Uint32Array(vertices.length);

    for (let i = 0; i < vertices.length; i++) {
        const [x, y, z] = vertices[i];
        const cx = Math.min(gridRes - 1, Math.floor(((x - minX) / rx) * gridRes));
        const cy = Math.min(gridRes - 1, Math.floor(((y - minY) / ry) * gridRes));
        const cz = Math.min(gridRes - 1, Math.floor(((z - minZ) / rz) * gridRes));
        const key = cx * gridRes * gridRes + cy * gridRes + cz;

        if (!cellMap.has(key)) {
            cellMap.set(key, { sum: [0, 0, 0], count: 0, newIdx: -1 });
        }
        const cell = cellMap.get(key);
        cell.sum[0] += x; cell.sum[1] += y; cell.sum[2] += z;
        cell.count++;
        vertexToNew[i] = key;
    }

    // Build new vertex list (centroids)
    const newVertices = [];
    for (const [key, cell] of cellMap) {
        cell.newIdx = newVertices.length;
        newVertices.push([
            cell.sum[0] / cell.count,
            cell.sum[1] / cell.count,
            cell.sum[2] / cell.count
        ]);
    }

    // Remap vertex indices
    const keyToNewIdx = new Map();
    for (const [key, cell] of cellMap) keyToNewIdx.set(key, cell.newIdx);

    // Rebuild faces, discard degenerate and out-of-bounds ones
    const newFaces = [];
    for (const [a, b, c] of faces) {
        if (a >= vertices.length || b >= vertices.length || c >= vertices.length) continue;
        const na = keyToNewIdx.get(vertexToNew[a]);
        const nb = keyToNewIdx.get(vertexToNew[b]);
        const nc = keyToNewIdx.get(vertexToNew[c]);
        if (na !== undefined && nb !== undefined && nc !== undefined &&
            na !== nb && nb !== nc && na !== nc) {
            newFaces.push([na, nb, nc]);
        }
    }

    return { ...data, vertices: newVertices, faces: newFaces, colors: [], normals: [] };
}

// ── Point Cloud Decimation: Voxel Grid ───────────────────────
// Groups points into voxel cells, keeps centroid of each cell.

function voxelDecimate(data, strength) {
    if (!data || !data.vertices) {
        throw new Error('Invalid point cloud data');
    }
    const { vertices, colors } = data;
    if (vertices.length === 0) return data;

    // strength is 0-100, normalize to 0-1
    const strengthNorm = strength > 1 ? strength / 100 : strength;
    const gridRes = Math.max(4, Math.round(128 * (1 - strengthNorm)));

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of vertices) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const rx = (maxX - minX) || 1, ry = (maxY - minY) || 1, rz = (maxZ - minZ) || 1;
    const cellMap = new Map();

    for (let i = 0; i < vertices.length; i++) {
        const [x, y, z] = vertices[i];
        const cx = Math.min(gridRes - 1, Math.floor(((x - minX) / rx) * gridRes));
        const cy = Math.min(gridRes - 1, Math.floor(((y - minY) / ry) * gridRes));
        const cz = Math.min(gridRes - 1, Math.floor(((z - minZ) / rz) * gridRes));
        const key = cx * gridRes * gridRes + cy * gridRes + cz;

        if (!cellMap.has(key)) {
            cellMap.set(key, { sum: [0, 0, 0], csum: [0, 0, 0], count: 0 });
        }
        const cell = cellMap.get(key);
        cell.sum[0] += x; cell.sum[1] += y; cell.sum[2] += z;
        if (colors[i]) {
            cell.csum[0] += colors[i][0];
            cell.csum[1] += colors[i][1];
            cell.csum[2] += colors[i][2];
        }
        cell.count++;
    }

    const newVertices = [], newColors = [];
    for (const cell of cellMap.values()) {
        newVertices.push([
            cell.sum[0] / cell.count,
            cell.sum[1] / cell.count,
            cell.sum[2] / cell.count
        ]);
        if (colors.length > 0) {
            newColors.push([
                Math.round(cell.csum[0] / cell.count),
                Math.round(cell.csum[1] / cell.count),
                Math.round(cell.csum[2] / cell.count)
            ]);
        }
    }

    return { ...data, vertices: newVertices, faces: [], colors: newColors, normals: [] };
}

// ─── Wireframe / Point Cloud Renderer ────────────────────────
// Simple orthographic projection with auto-fit and rotation.

function render3D(canvas, data) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Dark background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (!data || data.vertices.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data', W / 2, H / 2);
        return;
    }

    const { vertices, faces, colors } = data;

    // Compute bounding box for auto-fit
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of vertices) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const scale = (Math.min(W, H) * 0.75) / span;

    // 30° isometric-style rotation
    const cosA = Math.cos(0.5), sinA = Math.sin(0.5);
    const cosB = Math.cos(0.3), sinB = Math.sin(0.3);

    function project(v) {
        let x = v[0] - cx, y = v[1] - cy, z = v[2] - cz;
        // Rotate Y
        let x1 = x * cosA + z * sinA;
        let z1 = -x * sinA + z * cosA;
        // Rotate X
        let y2 = y * cosB - z1 * sinB;
        let z2 = y * sinB + z1 * cosB;
        return [W / 2 + x1 * scale, H / 2 - y2 * scale, z2];
    }

    const projected = vertices.map(project);

    if (faces.length > 0) {
        // Wireframe — sort faces by avg Z (painter's algorithm)
        const sorted = faces.map(f => {
            const z = (projected[f[0]][2] + projected[f[1]][2] + projected[f[2]][2]) / 3;
            return { f, z };
        }).sort((a, b) => a.z - b.z);

        ctx.strokeStyle = 'rgba(99,102,241,0.6)';
        ctx.lineWidth = 0.5;

        for (const { f } of sorted) {
            const [a, b, c] = f;
            if (!projected[a] || !projected[b] || !projected[c]) continue;
            ctx.beginPath();
            ctx.moveTo(projected[a][0], projected[a][1]);
            ctx.lineTo(projected[b][0], projected[b][1]);
            ctx.lineTo(projected[c][0], projected[c][1]);
            ctx.closePath();
            ctx.stroke();
        }
    } else {
        // Point cloud — render as dots
        const maxPoints = 50000;
        const step = Math.max(1, Math.floor(vertices.length / maxPoints));

        for (let i = 0; i < vertices.length; i += step) {
            const [px, py] = projected[i];
            if (colors[i]) {
                ctx.fillStyle = `rgb(${colors[i][0]},${colors[i][1]},${colors[i][2]})`;
            } else {
                ctx.fillStyle = 'rgba(99,102,241,0.8)';
            }
            ctx.fillRect(px, py, 1.5, 1.5);
        }
    }

    // Stats overlay
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`V: ${vertices.length.toLocaleString()}  F: ${faces.length.toLocaleString()}`, 8, 16);
}

// ─── UI Helpers ───────────────────────────────────────────────

function update3DStats(which, data) {
    const prefix = which === 'original' ? 'original' : 'compressed';
    const vEl = document.getElementById(prefix + 'Vertices');
    const fEl = document.getElementById(prefix + 'Faces');
    const sEl = document.getElementById(prefix + '3DSize');

    if (vEl) vEl.textContent = `Vertices: ${data.vertices.length.toLocaleString()}`;
    if (fEl) fEl.textContent = `Faces: ${data.faces.length.toLocaleString()}`;
    if (sEl) {
        const bytes = estimateSize(data);
        if (sEl) sEl.textContent = `Size: ${formatBytes(bytes)}`;
    }
}

function calculate3DMetrics(original, compressed, elapsed) {
    const origSize = original3DFileSize || estimateSize(original);
    const compSize = estimateSize(compressed);
    if (!origSize || !compSize) return;
    const reduction = ((origSize - compSize) / origSize * 100).toFixed(1);
    const ratio = (origSize / compSize).toFixed(2);

    const vReduction = original.vertices.length > 0
        ? ((original.vertices.length - compressed.vertices.length) / original.vertices.length * 100).toFixed(1)
        : '0.0';
    const fReduction = original.faces.length > 0
        ? ((original.faces.length - compressed.faces.length) / original.faces.length * 100).toFixed(1)
        : '0.0';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sizeReduction', reduction + '%');
    set('compressionRatio', ratio + ':1');
    set('originalSizeMetric', formatBytes(origSize));
    set('compressedSizeMetric', formatBytes(compSize));
    set('processingTime', elapsed.toFixed(2) + 'ms');
    set('psnr', 'N/A');
    set('bitsPerPixel', 'N/A');
    set('vertexReduction', vReduction + '%');
    set('faceReduction', fReduction + '%');
}

// Estimate exported file size more accurately based on format
function estimateSize(data) {
    const fmt = data.format || 'obj';
    if (fmt === 'ply' || data.type === 'pointcloud') {
        // PLY ASCII: ~30 chars/vertex line + ~12 chars/face line
        const hasColor = data.colors && data.colors.length > 0;
        const bytesPerVertex = hasColor ? 38 : 26;
        return data.vertices.length * bytesPerVertex + data.faces.length * 12 + 200; // 200 = header
    }
    // OBJ ASCII: ~28 chars per vertex line + ~16 chars per face line
    return data.vertices.length * 28 + data.faces.length * 16 + 50;
}

// ─── Download compressed 3D file ─────────────────────────────

function download3DResult() {
    if (!compressed3DData) {
        showError('No compressed 3D data. Apply 3D compression first.');
        return;
    }

    const fmt = compressed3DData.format || 'obj';
    let content, mime, ext;

    if (fmt === 'ply' || compressed3DData.type === 'pointcloud') {
        content = exportPLY(compressed3DData);
        mime = 'text/plain';
        ext = 'ply';
    } else {
        content = exportOBJ(compressed3DData);
        mime = 'text/plain';
        ext = 'obj';
    }

    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `compressed-${Date.now()}.${ext}`;
    link.click();
    showSuccess('3D file download started!');
}

function exportOBJ(data) {
    const lines = ['# Compressed by Compress & Compare'];
    for (const [x, y, z] of data.vertices) {
        lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
    }
    for (const [a, b, c] of data.faces) {
        lines.push(`f ${a + 1} ${b + 1} ${c + 1}`);
    }
    return lines.join('\n');
}

function exportPLY(data) {
    const hasColor = data.colors.length > 0;
    const lines = [
        'ply', 'format ascii 1.0',
        `element vertex ${data.vertices.length}`,
        'property float x', 'property float y', 'property float z'
    ];
    if (hasColor) {
        lines.push('property uchar red', 'property uchar green', 'property uchar blue');
    }
    if (data.faces.length > 0) {
        lines.push(`element face ${data.faces.length}`);
        lines.push('property list uchar int vertex_indices');
    }
    lines.push('end_header');

    for (let i = 0; i < data.vertices.length; i++) {
        const [x, y, z] = data.vertices[i];
        let row = `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`;
        if (hasColor && data.colors[i]) {
            row += ` ${data.colors[i][0]} ${data.colors[i][1]} ${data.colors[i][2]}`;
        }
        lines.push(row);
    }
    for (const [a, b, c] of data.faces) {
        lines.push(`3 ${a} ${b} ${c}`);
    }
    return lines.join('\n');
}

// ─── Hook into existing download button ──────────────────────
// Download is handled by downloadCompressedImage() in script.js
// which checks currentMode === '3d' and calls download3DResult().
// No duplicate listener needed here.
// ============================================================
// PHASE 1 IMPROVEMENTS: QEM Algorithm & 3D Quality Metrics
// Added: Quadric Error Metrics, Hausdorff Distance, Presets
// ============================================================

// ─── Compression Presets Helper ─────────────────────────────
function apply3DPreset(presetName) {
    const preset = COMPRESSION_PRESETS_3D[presetName];
    if (!preset) {
        showError('Invalid preset: ' + presetName);
        return;
    }
    
    current3DCompressionPreset = presetName;
    
    if (threedStrength) {
        threedStrength.value = preset.strength;
        if (threedStrengthValue) {
            threedStrengthValue.textContent = preset.strength;
        }
    }
    
    showSuccess(`3D Preset Applied: ${preset.name}`);
}

// ─── QEM Algorithm: Quadric Error Metrics ───────────────────
// Industry-standard mesh simplification algorithm
// Preserves geometry better than vertex clustering

function meshSimplifyQEM(data, strength) {
    if (!data || !data.vertices) {
        throw new Error('Invalid mesh data for QEM');
    }
    const { vertices, faces, colors, normals } = data;
    
    if (vertices.length === 0) return data;
    
    // Store original for later calculations
    original3DMesh = JSON.parse(JSON.stringify({ vertices, faces, colors, normals }));
    
    // Target vertex count based on strength (0-100%)
    const strengthNorm = strength > 1 ? strength / 100 : strength;
    const targetVertices = Math.max(4, Math.ceil(vertices.length * (1 - strengthNorm)));
    
    // Use QEM if available, fall back to clustering for large meshes
    if (vertices.length > 100000) {
        console.log('Mesh > 100K vertices: Using fast clustering instead of QEM');
        return meshSimplify(data, strength);
    }
    
    try {
        return qemSimplification(data, targetVertices);
    } catch (err) {
        console.warn('QEM failed, falling back to clustering:', err.message);
        return meshSimplify(data, strength);
    }
}

// QEM Simplification Implementation
function qemSimplification(data, targetVertexCount) {
    if (!data || !data.vertices || !data.faces) {
        throw new Error('Invalid data for QEM simplification');
    }
    let { vertices, faces, colors, normals } = data;
    
    if (vertices.length <= targetVertexCount) {
        return { ...data, vertices, faces, colors, normals };
    }
    
    if (targetVertexCount < 4) {
        throw new Error('Target vertex count too low (minimum 4)');
    }
    
    // Build vertex-to-faces map
    const vertexFaces = Array(vertices.length).fill(null).map(() => []);
    for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
        const [a, b, c] = faces[faceIdx];
        if (a >= 0 && a < vertices.length) vertexFaces[a].push(faceIdx);
        if (b >= 0 && b < vertices.length) vertexFaces[b].push(faceIdx);
        if (c >= 0 && c < vertices.length) vertexFaces[c].push(faceIdx);
    }
    
    // Compute initial quadric for each vertex
    const quadrics = vertices.map((v, i) => computeQuadricMatrix(i, vertexFaces, vertices, faces));
    
    // Create edge collapse list
    const edges = new Set();
    for (const [a, b, c] of faces) {
        edges.add([Math.min(a, b), Math.max(a, b)].join(','));
        edges.add([Math.min(b, c), Math.max(b, c)].join(','));
        edges.add([Math.min(c, a), Math.max(c, a)].join(','));
    }
    
    const edgeList = Array.from(edges).map(e => e.split(',').map(Number));
    
    // Track remaining vertices
    const remaining = new Set(Array(vertices.length).fill(0).map((_, i) => i));
    const remapped = new Map();
    
    // Collapse edges until target reached
    let iterations = 0;
    const maxIterations = vertices.length * 2;
    while (remaining.size > targetVertexCount && edgeList.length > 0 && iterations < maxIterations) {
        iterations++;
        let bestError = Infinity;
        let bestEdgeIdx = -1;
        let bestPos = null;
        
        // Find edge with minimum error
        for (let i = 0; i < Math.min(100, edgeList.length); i++) {
            const [u, v] = edgeList[i];
            
            if (!remaining.has(u) || !remaining.has(v)) continue;
            
            const qu = quadrics[u];
            const qv = quadrics[v];
            const qSum = addQuadricMatrices(qu, qv);
            
            // Find optimal position
            const pos = findOptimalPosition(vertices[u], vertices[v], qSum);
            const error = evaluateQuadricError(pos, qSum);
            
            if (error < bestError) {
                bestError = error;
                bestEdgeIdx = i;
                bestPos = pos;
            }
        }
        
        if (bestEdgeIdx === -1) break;
        
        const [u, v] = edgeList[bestEdgeIdx];
        
        // Collapse edge: merge v into u
        vertices[u] = bestPos;
        remaining.delete(v);
        remapped.set(v, u);
        
        // Update quadric
        quadrics[u] = addQuadricMatrices(quadrics[u], quadrics[v]);
        
        // Remove edge
        edgeList.splice(bestEdgeIdx, 1);
    }
    
    // Remap vertices and faces
    const vertexMap = new Map();
    let newIdx = 0;
    for (const v of remaining) {
        vertexMap.set(v, newIdx++);
    }
    
    const newVertices = [];
    const newColors = [];
    const newNormals = [];
    
    for (const oldIdx of remaining) {
        newVertices.push(vertices[oldIdx]);
        if (colors[oldIdx]) newColors.push(colors[oldIdx]);
        if (normals[oldIdx]) newNormals.push(recomputeNormal(oldIdx, faces, newVertices));
    }
    
    // Remap faces
    const newFaces = [];
    for (const [a, b, c] of faces) {
        // Use nullish coalescing to correctly handle index 0
        const ua = remapped.has(a) ? remapped.get(a) : a;
        const ub = remapped.has(b) ? remapped.get(b) : b;
        const uc = remapped.has(c) ? remapped.get(c) : c;
        
        const na = vertexMap.get(ua);
        const nb = vertexMap.get(ub);
        const nc = vertexMap.get(uc);
        
        if (na !== undefined && nb !== undefined && nc !== undefined &&
            na !== nb && nb !== nc && na !== nc) {
            newFaces.push([na, nb, nc]);
        }
    }
    
    return {
        ...data,
        vertices: newVertices,
        faces: newFaces,
        colors: newColors.length > 0 ? newColors : [],
        normals: newNormals.length > 0 ? newNormals : []
    };
}

// Compute quadric matrix for a vertex
function computeQuadricMatrix(vertexIdx, vertexFaces, vertices, faces) {
    let Q = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];
    
    const faceIndices = vertexFaces[vertexIdx];
    
    for (const faceIdx of faceIndices) {
        const [a, b, c] = faces[faceIdx];
        const plane = getPlaneEquation(vertices[a], vertices[b], vertices[c]);
        const Qp = planeToQuadric(plane);
        Q = addQuadricMatrices(Q, Qp);
    }
    
    return Q;
}

// Get plane equation from triangle
function getPlaneEquation(p1, p2, p3) {
    const v1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
    const v2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
    
    // Cross product for normal
    const n = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ];
    
    const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
    if (len > 0) {
        n[0] /= len; n[1] /= len; n[2] /= len;
    }
    
    const d = -(n[0] * p1[0] + n[1] * p1[1] + n[2] * p1[2]);
    return [n[0], n[1], n[2], d];
}

// Convert plane equation to quadric matrix
function planeToQuadric(plane) {
    const [a, b, c, d] = plane;
    return [
        [a*a, a*b, a*c, a*d],
        [a*b, b*b, b*c, b*d],
        [a*c, b*c, c*c, c*d],
        [a*d, b*d, c*d, d*d]
    ];
}

// Add two quadric matrices
function addQuadricMatrices(Q1, Q2) {
    const result = [];
    for (let i = 0; i < 4; i++) {
        result[i] = [];
        for (let j = 0; j < 4; j++) {
            result[i][j] = (Q1[i] ? Q1[i][j] || 0 : 0) + (Q2[i] ? Q2[i][j] || 0 : 0);
        }
    }
    return result;
}

// Find optimal vertex position given quadric
function findOptimalPosition(p1, p2, Q) {
    // Try original vertices and midpoint
    const candidates = [
        p1,
        p2,
        [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2]
    ];
    
    let bestPos = p1;
    let bestError = Infinity;
    
    for (const pos of candidates) {
        const error = evaluateQuadricError(pos, Q);
        if (error < bestError) {
            bestError = error;
            bestPos = pos;
        }
    }
    
    return bestPos;
}

// Evaluate quadric error at position
function evaluateQuadricError(pos, Q) {
    const p = [pos[0], pos[1], pos[2], 1];
    let error = 0;
    
    for (let i = 0; i < 4; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
            sum += (Q[i] ? Q[i][j] || 0 : 0) * p[j];
        }
        error += sum * p[i];
    }
    
    return Math.abs(error);
}

// Recompute normal for a vertex
function recomputeNormal(vertexIdx, faces, vertices) {
    const n = [0, 0, 0];
    let count = 0;
    
    for (const [a, b, c] of faces) {
        if (a === vertexIdx || b === vertexIdx || c === vertexIdx) {
            const plane = getPlaneEquation(vertices[a] || [0,0,0], 
                                          vertices[b] || [0,0,0], 
                                          vertices[c] || [0,0,0]);
            n[0] += plane[0];
            n[1] += plane[1];
            n[2] += plane[2];
            count++;
        }
    }
    
    if (count > 0) {
        const len = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]);
        if (len > 0) {
            return [n[0]/len, n[1]/len, n[2]/len];
        }
    }
    
    return [0, 0, 1];
}

// ─── Quality Metrics: Hausdorff Distance ────────────────────
// Measure geometric fidelity after compression

function calculateHausdorffDistance(original, compressed) {
    if (!original || !compressed || !original.vertices || !compressed.vertices) {
        return 0;
    }
    
    if (!Array.isArray(original.vertices) || !Array.isArray(compressed.vertices)) {
        return 0;
    }
    
    const origVerts = original.vertices;
    const compVerts = compressed.vertices;
    
    if (origVerts.length === 0 || compVerts.length === 0) {
        return 0;
    }
    
    let maxDist = 0;
    
    // Sample: every 10th vertex to speed up
    const step = Math.max(1, Math.floor(origVerts.length / 1000));
    
    for (let i = 0; i < origVerts.length; i += step) {
        const origV = origVerts[i];
        let minDist = Infinity;
        
        for (const compV of compVerts) {
            const dx = origV[0] - compV[0];
            const dy = origV[1] - compV[1];
            const dz = origV[2] - compV[2];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < minDist) {
                minDist = dist;
            }
        }
        
        if (minDist > maxDist) {
            maxDist = minDist;
        }
    }
    
    return maxDist;
}

// ─── Quality Metrics: RMS Position Error ────────────────────
function calculateRMSError(original, compressed) {
    if (!original || !compressed || !original.vertices || !compressed.vertices) {
        return 0;
    }
    
    if (!Array.isArray(original.vertices) || !Array.isArray(compressed.vertices)) {
        return 0;
    }
    
    const origVerts = original.vertices;
    const compVerts = compressed.vertices;
    
    if (origVerts.length === 0) {
        return 0;
    }
    
    let sumSquaredErrors = 0;
    let count = 0;
    
    for (let i = 0; i < origVerts.length; i++) {
        const origV = origVerts[i];
        let minDist = Infinity;
        
        for (const compV of compVerts) {
            const dx = origV[0] - compV[0];
            const dy = origV[1] - compV[1];
            const dz = origV[2] - compV[2];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < minDist) {
                minDist = dist;
            }
        }
        
        sumSquaredErrors += minDist * minDist;
        count++;
    }
    
    return Math.sqrt(sumSquaredErrors / Math.max(1, count));
}

// ─── Quality Metrics: Normal Deviation ──────────────────────
function calculateNormalDeviation(original, compressed) {
    if (!original || !compressed || !original.normals || original.normals.length === 0) {
        return 0;
    }
    
    if (!Array.isArray(original.normals)) {
        return 0;
    }
    
    const origNormals = original.normals;
    const compNormals = compressed.normals || [];
    
    if (origNormals.length === 0 || compNormals.length === 0) {
        return 0;
    }
    
    let totalAngle = 0;
    let count = 0;
    
    const step = Math.max(1, Math.floor(origNormals.length / 1000));
    
    for (let i = 0; i < origNormals.length; i += step) {
        const n1 = origNormals[i];
        if (!n1 || compNormals[i % compNormals.length] === undefined) continue;
        
        const n2 = compNormals[i % compNormals.length];
        
        const dot = (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        
        totalAngle += angle;
        count++;
    }
    
    return count > 0 ? totalAngle / count : 0;
}

// ─── Quality Metrics: Bounding Box & Volume ────────────────
function calculateBoundingBox(vertices) {
    if (!vertices || !Array.isArray(vertices) || vertices.length === 0) {
        return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
    }
    
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    
    for (const v of vertices) {
        for (let i = 0; i < 3; i++) {
            if (v[i] < min[i]) min[i] = v[i];
            if (v[i] > max[i]) max[i] = v[i];
        }
    }
    
    return {
        min,
        max,
        size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
    };
}

function calculateMeshVolume(vertices, faces) {
    if (!vertices || !Array.isArray(vertices) || !faces || !Array.isArray(faces) || faces.length === 0) {
        return 0;
    }
    
    let volume = 0;
    
    for (const [a, b, c] of faces) {
        const v0 = vertices[a] || [0, 0, 0];
        const v1 = vertices[b] || [0, 0, 0];
        const v2 = vertices[c] || [0, 0, 0];
        
        // Signed volume of tetrahedron with origin
        const v = (v0[0] * (v1[1] * v2[2] - v1[2] * v2[1]) -
                   v0[1] * (v1[0] * v2[2] - v1[2] * v2[0]) +
                   v0[2] * (v1[0] * v2[1] - v1[1] * v2[0])) / 6;
        volume += v;
    }
    
    return Math.abs(volume);
}

// ─── Enhanced 3D Metrics Display ────────────────────────────
function calculate3DMetricsEnhanced(original, compressed, elapsed) {
    if (!original || !compressed) {
        console.warn('Invalid data for metrics calculation');
        return;
    }
    
    const origSize = original3DFileSize || estimateSize(original);
    const compSize = estimateSize(compressed);
    
    if (!origSize || !compSize) return;
    
    // Basic metrics
    const sizeReduction = ((origSize - compSize) / origSize * 100).toFixed(1);
    const ratio = (origSize / compSize).toFixed(2);
    
    const vReduction = original.vertices.length > 0
        ? ((original.vertices.length - compressed.vertices.length) / original.vertices.length * 100).toFixed(1)
        : '0.0';
    
    const fReduction = original.faces.length > 0
        ? ((original.faces.length - compressed.faces.length) / original.faces.length * 100).toFixed(1)
        : '0.0';
    
    // Quality metrics (PHASE 1 NEW)
    const bbox = calculateBoundingBox(original.vertices);
    const bboxDiag = Math.sqrt(bbox.size[0]*bbox.size[0] + bbox.size[1]*bbox.size[1] + bbox.size[2]*bbox.size[2]) || 1;
    
    const hausdorff = calculateHausdorffDistance(original, compressed);
    const hausdorffPercent = ((hausdorff / bboxDiag) * 100).toFixed(2);
    
    const rmsError = calculateRMSError(original, compressed);
    const rmsPercent = ((rmsError / bboxDiag) * 100).toFixed(2);
    
    const normalDev = calculateNormalDeviation(original, compressed);
    
    const origVolume = calculateMeshVolume(original.vertices, original.faces);
    const compVolume = calculateMeshVolume(compressed.vertices, compressed.faces);
    const volumeChange = origVolume > 0 ? ((Math.abs(origVolume - compVolume) / origVolume) * 100).toFixed(2) : '0.0';
    
    // Set all metrics
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    // Basic metrics
    set('sizeReduction', sizeReduction + '%');
    set('compressionRatio', ratio + ':1');
    set('originalSizeMetric', formatBytes(origSize));
    set('compressedSizeMetric', formatBytes(compSize));
    set('processingTime', elapsed.toFixed(2) + 'ms');
    set('vertexReduction', vReduction + '%');
    set('faceReduction', fReduction + '%');
    
    // Quality metrics (PHASE 1 NEW)
    set('hausdorffDistance', hausdorffPercent + '% (BBox)');
    set('rmsError', rmsPercent + '% (BBox)');
    set('normalDeviation', normalDev.toFixed(1) + '°');
    set('volumeChange', volumeChange + '%');
    
    // Quality rating
    const qualityScore = calculateQualityScore(hausdorffPercent, rmsPercent, normalDev, volumeChange);
    set('qualityScore', qualityScore);
}

// Calculate overall quality score
function calculateQualityScore(hausdorff, rms, normalDev, volumeChange) {
    // Validate inputs
    if (typeof hausdorff !== 'string' && typeof hausdorff !== 'number') hausdorff = 0;
    if (typeof rms !== 'string' && typeof rms !== 'number') rms = 0;
    if (typeof normalDev !== 'number') normalDev = 0;
    if (typeof volumeChange !== 'string' && typeof volumeChange !== 'number') volumeChange = 0;
    
    // Score based on metrics (0-100, higher is better)
    let score = 100;
    
    // Deduct for Hausdorff distance
    const hScore = Math.max(0, 100 - (parseFloat(hausdorff) * 5));
    
    // Deduct for RMS error
    const rScore = Math.max(0, 100 - (parseFloat(rms) * 5));
    
    // Deduct for normal deviation
    const nScore = Math.max(0, 100 - (normalDev * 2));
    
    // Deduct for volume change
    const vScore = Math.max(0, 100 - (parseFloat(volumeChange) * 5));
    
    score = (hScore + rScore + nScore + vScore) / 4;
    
    // Determine rating
    if (score >= 90) return '⭐ Excellent (' + score.toFixed(0) + ')';
    if (score >= 75) return '✅ Good (' + score.toFixed(0) + ')';
    if (score >= 60) return '⚠️ Acceptable (' + score.toFixed(0) + ')';
    return '❌ Poor (' + score.toFixed(0) + ')';
}

// ─── Update apply3DCompression to use QEM ───────────────────
// Override the old meshSimplify call
function apply3DCompressionEnhanced() {
    if (!current3DData) {
        showError('No 3D file loaded.');
        return;
    }
    
    if (!current3DData.vertices || current3DData.vertices.length === 0) {
        showError('Invalid 3D data: no vertices found.');
        return;
    }

    const preset = COMPRESSION_PRESETS_3D[current3DCompressionPreset] || COMPRESSION_PRESETS_3D.quality;
    const type = threedType ? threedType.value : 'mesh';
    const startTime = performance.now();

    showLoading(`Compressing 3D data using ${preset.algorithm.toUpperCase()}...`);

    setTimeout(() => {
        try {
            let result;
            
            if (type === 'pointcloud') {
                result = voxelDecimate(current3DData, preset.strength);
            } else if (preset.algorithm === 'qem') {
                result = meshSimplifyQEM(current3DData, preset.strength);
            } else {
                result = meshSimplify(current3DData, preset.strength);
            }
            
            // Preserve normals if requested
            if (preset.preserveNormals && result.normals.length === 0) {
                result.normals = current3DData.normals || [];
            }

            compressed3DData = result;
            const elapsed = performance.now() - startTime;

            update3DStats('original', current3DData);
            update3DStats('compressed', result);
            render3D(document.getElementById('originalCanvas3D'), current3DData);
            render3D(document.getElementById('compressedCanvas3D'), result);
            
            // Use enhanced metrics
            calculate3DMetricsEnhanced(current3DData, result, elapsed);
            
            hideLoading();
            showSuccess(`3D compression complete using ${preset.algorithm.toUpperCase()}! (${elapsed.toFixed(1)}ms)`);
        } catch (err) {
            hideLoading();
            showError('3D compression failed: ' + sanitize3DError(err.message));
        }
    }, 50);
}
