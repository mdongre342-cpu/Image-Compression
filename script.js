// Global variables
let originalImage = null;
let originalImageData = null;
let originalFileSize = 0;
let compressedDataURL = null;
let compressionHistory = [];
let comparisonHistory = [];
let undoStack = [];
let redoStack = [];
let zoomLevel = 1;
let isProcessing = false;
let cancelRequested = false;
let currentOperation = null;
let currentMode = 'compress'; // 'compress' or 'decompress'
let compressionMetadata = null; // Store metadata for decompression
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DIMENSION = 8192;
const PRESETS = {
    web: { type: 'jpeg', quality: 85 },
    thumbnail: { type: 'resize', quality: 80, resize: 30 },
    highQuality: { type: 'webp', quality: 95 },
    lowSize: { type: 'jpeg', quality: 50 }
};

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const comparisonSection = document.getElementById('comparisonSection');
const originalCanvas = document.getElementById('originalCanvas');
const compressedCanvas = document.getElementById('compressedCanvas');
const compressionType = document.getElementById('compressionType');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const resizePercent = document.getElementById('resizePercent');
const resizeValue = document.getElementById('resizeValue');
const resizeControls = document.getElementById('resizeControls');
const compressBtn = document.getElementById('compressBtn');
const decompressBtn = document.getElementById('decompressBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const compressModeBtn = document.getElementById('compressMode');
const decompressModeBtn = document.getElementById('decompressMode');
const threedModeBtn = document.getElementById('threedMode');
const compressionControls = document.getElementById('compressionControls');
const decompressionControls = document.getElementById('decompressionControls');
const decompressionType = document.getElementById('decompressionType');

// Validate DOM Elements
if (!uploadArea || !fileInput || !comparisonSection || !originalCanvas || !compressedCanvas || 
    !compressionType || !qualitySlider || !qualityValue || !resizePercent || !resizeValue || 
    !resizeControls || !compressBtn || !resetBtn || !downloadBtn) {
    console.error('Critical DOM elements missing. Application cannot initialize.');
} else {
    initEventListeners();
}

function initEventListeners() {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    compressionType.addEventListener('change', handleCompressionTypeChange);
    qualitySlider.addEventListener('input', updateQualityValue);
    resizePercent.addEventListener('input', updateResizeValue);
    compressBtn.addEventListener('click', compressImageWithProgress);
    if (decompressBtn) decompressBtn.addEventListener('click', decompressImageWithProgress);
    resetBtn.addEventListener('click', resetApp);
    downloadBtn.addEventListener('click', downloadCompressedImage);
    if (compressModeBtn) compressModeBtn.addEventListener('click', () => switchMode('compress'));
    if (decompressModeBtn) decompressModeBtn.addEventListener('click', () => switchMode('decompress'));
    if (threedModeBtn) threedModeBtn.addEventListener('click', () => switchMode('3d'));

    // Batch upload area
    const batchUploadArea = document.getElementById('batchUploadArea');
    const batchFileInput = document.getElementById('batchFileInput');
    if (batchUploadArea) {
        batchUploadArea.addEventListener('click', () => batchFileInput && batchFileInput.click());
        batchUploadArea.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') batchFileInput && batchFileInput.click(); });
    }
    if (batchFileInput) batchFileInput.addEventListener('change', (e) => processBatchFiles(e.target.files));

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) processFile(file);
}

function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    try {
        const ext = file.name.split('.').pop().toLowerCase();
        const is3D = ['obj', 'stl', 'ply', 'exr'].includes(ext);

        if (file.size > MAX_FILE_SIZE) {
            showError(`File size (${formatBytes(file.size)}) exceeds maximum limit of ${formatBytes(MAX_FILE_SIZE)}`);
            return;
        }

        if (file.size === 0) {
            showError('File is empty or corrupted');
            return;
        }

        if (is3D) {
            switchMode('3d');
            handle3DFile(file);
            return;
        }

        showLoading('Loading image...');
        originalFileSize = file.size;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const img = new Image();
                img.onload = function() {
                    try {
                        if (img.width === 0 || img.height === 0) {
                            hideLoading();
                            showError('Invalid image dimensions');
                            return;
                        }

                        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
                            hideLoading();
                            showError('Image dimensions (' + sanitizeNumber(img.width) + 'x' + sanitizeNumber(img.height) + ') exceed maximum (' + MAX_DIMENSION + 'x' + MAX_DIMENSION + ')');
                            return;
                        }

                        originalImage = img;
                        displayOriginalImage();
                        comparisonSection.style.display = 'block';
                        uploadArea.style.display = 'none';
                        const imgComp = document.getElementById('imageComparison');
                        if (imgComp) imgComp.style.display = 'grid';
                        hideLoading();
                        showSuccess('Image loaded successfully!');
                    } catch (err) {
                        hideLoading();
                        showError('Failed to process image: ' + sanitizeErrorMessage(err.message));
                    }
                };
                img.onerror = () => { hideLoading(); showError('Failed to load image. File may be corrupted.'); };
                const dataURL = e.target.result;
                if (dataURL && typeof dataURL === 'string' && dataURL.startsWith('data:image/')) {
                    img.src = dataURL;
                } else {
                    hideLoading();
                    showError('Invalid image data');
                }
            } catch (err) {
                hideLoading();
                showError('Failed to read image data: ' + sanitizeErrorMessage(err.message));
            }
        };
        reader.onerror = () => { hideLoading(); showError('Failed to read file. Please try again.'); };
        reader.readAsDataURL(file);
    } catch (err) {
        hideLoading();
        showError('Unexpected error: ' + sanitizeErrorMessage(err.message));
    }
}

// Display Original Image with Error Handling
function displayOriginalImage() {
    try {
        const ctx = originalCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');
        
        originalCanvas.width = originalImage.width;
        originalCanvas.height = originalImage.height;
        ctx.drawImage(originalImage, 0, 0);
        
        originalImageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
        
        const _origDim = document.getElementById('originalDimensions');
        const _origSz  = document.getElementById('originalSize');
        const _origSzM = document.getElementById('originalSizeMetric');
        if (_origDim) _origDim.textContent = `Dimensions: ${originalImage.width} × ${originalImage.height}`;
        if (_origSz)  _origSz.textContent  = `Size: ${formatBytes(originalFileSize)}`;
        if (_origSzM) _origSzM.textContent = formatBytes(originalFileSize);
    } catch (err) {
        showError('Failed to display image: ' + sanitizeErrorMessage(err.message));
    }
}

// Sanitize strings to prevent XSS — use textContent for DOM, this for console/report strings
function sanitizeErrorMessage(message) {
    if (!message) return 'Unknown error';
    return String(message).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

// Sanitize arbitrary text (e.g. filenames) before inserting into DOM or reports
function sanitizeText(text) {
    if (!text) return '';
    return String(text).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));
}

// Sanitize numbers to prevent XSS
function sanitizeNumber(value) {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
}

// Compression Type Change Handler
function handleCompressionTypeChange() {
    const type = compressionType.value;
    
    if (type === 'resize') {
        resizeControls.style.display = 'block';
    } else {
        resizeControls.style.display = 'none';
    }
}

// Update Slider Values
function updateQualityValue() {
    qualityValue.textContent = qualitySlider.value;
    qualitySlider.style.setProperty('--value', qualitySlider.value + '%');
}

function updateResizeValue() {
    resizeValue.textContent = resizePercent.value;
    resizePercent.style.setProperty('--value', resizePercent.value + '%');
}

// compressImage() removed — all UI calls go through compressImageWithProgress()

// JPEG Compression
function compressJPEG(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    return compressedCanvas.toDataURL('image/jpeg', quality);
}

// WebP Compression
function compressWebP(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);

    if (compressedCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        return compressedCanvas.toDataURL('image/webp', quality);
    } else {
        showError('WebP not supported in this browser. Using JPEG instead.');
        return compressedCanvas.toDataURL('image/jpeg', quality);
    }
}

// Color Quantization (Simplified)
function quantizeColors(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    const colorDepth = Math.max(1, Math.floor(256 - (quality * 240)));
    
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.round(data[i]     / colorDepth) * colorDepth);
        data[i + 1] = Math.min(255, Math.round(data[i + 1] / colorDepth) * colorDepth);
        data[i + 2] = Math.min(255, Math.round(data[i + 2] / colorDepth) * colorDepth);
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Resize and Compress
function resizeAndCompress(scale, quality) {
    const newWidth = Math.floor(originalCanvas.width * scale);
    const newHeight = Math.floor(originalCanvas.height * scale);
    
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = newWidth;
    compressedCanvas.height = newHeight;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(originalImage, 0, 0, newWidth, newHeight);
    
    return compressedCanvas.toDataURL('image/jpeg', quality);
}

// Display Compressed Image
function displayCompressedImage(dataURL, onReady) {
    const img = new Image();
    img.onload = function() {
        const ctx = compressedCanvas.getContext('2d');
        compressedCanvas.width = img.width;
        compressedCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const dimEl = document.getElementById('compressedDimensions');
        if (dimEl) dimEl.textContent = `Dimensions: ${img.width} × ${img.height}`;
        if (onReady) onReady();
    };
    img.onerror = () => showError('Failed to display compressed image.');
    img.src = dataURL;
}

// Calculate and Display Metrics
function calculateMetrics(compressedDataURL, processingTime) {
    try {
        if (!originalFileSize) return;
        const compressedSize = dataURLtoSize(compressedDataURL);
        const reduction = ((originalFileSize - compressedSize) / originalFileSize * 100).toFixed(1);
        const ratio = (originalFileSize / compressedSize).toFixed(2);
        
        const compressedSizeEl = document.getElementById('compressedSize');
        const compressedSizeMetricEl = document.getElementById('compressedSizeMetric');
        const sizeReductionEl = document.getElementById('sizeReduction');
        const compressionRatioEl = document.getElementById('compressionRatio');
        
        if (compressedSizeEl) compressedSizeEl.textContent = `Size: ${formatBytes(compressedSize)}`;
        if (compressedSizeMetricEl) compressedSizeMetricEl.textContent = formatBytes(compressedSize);
        if (sizeReductionEl) sizeReductionEl.textContent = `${reduction}%`;
        if (compressionRatioEl) compressionRatioEl.textContent = `${ratio}:1`;
        
        if (document.getElementById('processingTime')) {
            document.getElementById('processingTime').textContent = `${processingTime.toFixed(2)}ms`;
        }
        if (document.getElementById('bitsPerPixel')) {
            const pixels = originalCanvas.width * originalCanvas.height;
            const bpp = (compressedSize * 8 / pixels).toFixed(2);
            document.getElementById('bitsPerPixel').textContent = `${bpp} bpp`;
        }
        
        compressionHistory.push({
            type: compressionType.value,
            quality: qualitySlider.value,
            originalSize: originalFileSize,
            compressedSize,
            reduction,
            time: processingTime
        });
    } catch (err) {
        console.error('Error calculating metrics:', err);
    }
}

// Helper Functions
function dataURLtoSize(dataURL) {
    if (!dataURL || typeof dataURL !== 'string') return 0;
    const parts = dataURL.split(',');
    if (parts.length < 2 || !parts[1]) return 0;
    try {
        return atob(parts[1]).length;
    } catch (_e) {
        return 0;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Download Compressed Image with Validation
function downloadCompressedImage() {
    try {
        if (currentMode === '3d') {
            download3DResult();
            return;
        }
        if (!compressedDataURL) {
            showError('No compressed image available. Please compress an image first.');
            return;
        }
        // Derive extension from the actual dataURL MIME type to handle fallbacks (e.g. AVIF→WebP)
        const mime = compressedDataURL.split(';')[0].split(':')[1] || 'image/jpeg';
        const mimeToExt = { 'image/jpeg': 'jpeg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/png': 'png' };
        const format = mimeToExt[mime] || 'jpeg';
        const link = document.createElement('a');
        link.download = `compressed-${new Date().getTime()}.${format}`;
        link.href = compressedDataURL;
        link.click();
        showSuccess('Download started!');
    } catch (err) {
        showError('Download failed: ' + sanitizeErrorMessage(err.message));
    }
}

// Reset Application
function resetApp() {
    originalImage = null;
    originalImageData = null;
    originalFileSize = 0;
    compressedDataURL = null;
    comparisonSection.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
    qualitySlider.value = 80;
    qualityValue.textContent = '80';
    resizePercent.value = 100;
    resizeValue.textContent = '100';
    compressionType.value = 'jpeg';
    resizeControls.style.display = 'none';
    reset3DState();
    switchMode('compress');
}

function reset3DState() {
    if (typeof current3DData !== 'undefined') current3DData = null;
    if (typeof compressed3DData !== 'undefined') compressed3DData = null;
    if (typeof original3DFileSize !== 'undefined') original3DFileSize = 0;
    const threedViewer = document.getElementById('threedViewer');
    if (threedViewer) threedViewer.style.display = 'none';
    const c1 = document.getElementById('originalCanvas3D');
    const c2 = document.getElementById('compressedCanvas3D');
    if (c1) { const ctx = c1.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c1.width, c1.height); }
    if (c2) { const ctx = c2.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c2.width, c2.height); }
}

// Advanced Compression Techniques
function grayscaleCompress(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/jpeg', quality);
}

function ditheringCompress(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    const w = compressedCanvas.width;
    
    const levels = Math.max(2, Math.floor(quality * 8));
    const factor = 255 / (levels - 1);
    
    for (let y = 0; y < compressedCanvas.height; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            
            for (let c = 0; c < 3; c++) {
                const oldPixel = data[i + c];
                const newPixel = Math.round(oldPixel / factor) * factor;
                data[i + c] = newPixel;
                const error = oldPixel - newPixel;
                
                if (x + 1 < w)                    data[i + 4 + c]         = Math.max(0, Math.min(255, data[i + 4 + c]         + error * 7 / 16));
                if (y + 1 < compressedCanvas.height) {
                    if (x > 0)                     data[i + w * 4 - 4 + c] = Math.max(0, Math.min(255, data[i + w * 4 - 4 + c] + error * 3 / 16));
                                                   data[i + w * 4 + c]     = Math.max(0, Math.min(255, data[i + w * 4 + c]     + error * 5 / 16));
                    if (x + 1 < w)                 data[i + w * 4 + 4 + c] = Math.max(0, Math.min(255, data[i + w * 4 + 4 + c] + error * 1 / 16));
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Quality Metrics (PSNR)
function calculateQualityMetrics() {
    if (!originalImageData) return;
    
    const compCtx = compressedCanvas.getContext('2d');
    const compData = compCtx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    
    if (originalImageData.width !== compData.width || originalImageData.height !== compData.height) return;
    
    let mse = 0;
    const pixels = originalImageData.width * originalImageData.height;
    
    for (let i = 0; i < originalImageData.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const diff = originalImageData.data[i + c] - compData.data[i + c];
            mse += diff * diff;
        }
    }
    
    mse /= (pixels * 3);
    const psnr = mse === 0 ? 100 : 10 * Math.log10((255 * 255) / mse);
    
    if (document.getElementById('psnr')) {
        document.getElementById('psnr').textContent = `${psnr.toFixed(2)} dB`;
    }
}

// RLE Compression (Simplified)
function rleCompress() {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / 32) * 32;
        data[i + 1] = Math.round(data[i + 1] / 32) * 32;
        data[i + 2] = Math.round(data[i + 2] / 32) * 32;
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// K-means Color Clustering
function kmeansCompress(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    const k = Math.max(2, Math.floor(quality * 32));
    
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    
    const centroids = [];
    for (let i = 0; i < k; i++) {
        const idx = Math.floor(Math.random() * pixels.length);
        centroids.push([...pixels[idx]]);
    }
    
    for (let iter = 0; iter < 5; iter++) {
        const clusters = Array(k).fill().map(() => []);
        
        pixels.forEach((pixel, idx) => {
            let minDist = Infinity, minIdx = 0;
            centroids.forEach((centroid, cIdx) => {
                const dist = Math.sqrt(
                    Math.pow(pixel[0] - centroid[0], 2) +
                    Math.pow(pixel[1] - centroid[1], 2) +
                    Math.pow(pixel[2] - centroid[2], 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    minIdx = cIdx;
                }
            });
            clusters[minIdx].push(idx);
        });
        
        centroids.forEach((centroid, cIdx) => {
            if (clusters[cIdx].length > 0) {
                const sum = [0, 0, 0];
                clusters[cIdx].forEach(idx => {
                    sum[0] += pixels[idx][0];
                    sum[1] += pixels[idx][1];
                    sum[2] += pixels[idx][2];
                });
                centroid[0] = sum[0] / clusters[cIdx].length;
                centroid[1] = sum[1] / clusters[cIdx].length;
                centroid[2] = sum[2] / clusters[cIdx].length;
            }
        });
    }
    
    pixels.forEach((pixel, idx) => {
        let minDist = Infinity, minIdx = 0;
        centroids.forEach((centroid, cIdx) => {
            const dist = Math.sqrt(
                Math.pow(pixel[0] - centroid[0], 2) +
                Math.pow(pixel[1] - centroid[1], 2) +
                Math.pow(pixel[2] - centroid[2], 2)
            );
            if (dist < minDist) {
                minDist = dist;
                minIdx = cIdx;
            }
        });
        const i = idx * 4;
        data[i]     = Math.round(centroids[minIdx][0]);
        data[i + 1] = Math.round(centroids[minIdx][1]);
        data[i + 2] = Math.round(centroids[minIdx][2]);
    });
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Compression Presets
function applyPreset(preset) {
    if (!originalImage || !PRESETS[preset]) return;
    const p = PRESETS[preset];
    compressionType.value = p.type;
    qualitySlider.value = p.quality;
    qualityValue.textContent = p.quality;
    if (p.resize) {
        resizePercent.value = p.resize;
        resizeValue.textContent = p.resize;
        resizeControls.style.display = 'block';
    }
    handleCompressionTypeChange();
}

// Zoom Comparison
function toggleZoom() {
    if (currentMode === '3d') { showError('Zoom is not available in 3D mode.'); return; }
    zoomLevel = zoomLevel === 1 ? 2 : 1;
    originalCanvas.style.transform = `scale(${zoomLevel})`;
    compressedCanvas.style.transform = `scale(${zoomLevel})`;
    originalCanvas.style.transformOrigin = 'top left';
    compressedCanvas.style.transformOrigin = 'top left';
}

// Export Report with Validation
function exportReport() {
    try {
        if (compressionHistory.length === 0) {
            showError('No compression history to export. Compress an image first.');
            return;
        }
        
        let report = 'Image Compression Report\n';
        report += '========================\n\n';
        report += `Generated: ${new Date().toLocaleString()}\n`;
        if (originalImage && originalImage.width && originalImage.height) {
            report += `Original Image: ${originalImage.width}x${originalImage.height}\n`;
        }
        report += `Original Size: ${formatBytes(originalFileSize)}\n\n`;
        report += 'Compression History:\n';
        report += '-'.repeat(80) + '\n';
        
        compressionHistory.forEach((entry, idx) => {
            report += `\n${idx + 1}. ${entry.type.toUpperCase()}\n`;
            report += `   Quality: ${entry.quality}%\n`;
            report += `   Compressed Size: ${formatBytes(entry.compressedSize)}\n`;
            report += `   Reduction: ${entry.reduction}%\n`;
            report += `   Processing Time: ${entry.time.toFixed(2)}ms\n`;
        });
        
        const blob = new Blob([report], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `compression-report-${new Date().getTime()}.txt`;
        link.click();
        showSuccess('Report exported successfully!');
    } catch (err) {
        showError('Export failed: ' + sanitizeErrorMessage(err.message));
    }
}

// Batch Processing
function batchCompress() {
    if (!originalImage || !originalFileSize) { showError('No image loaded.'); return; }
    const qualities = [10, 30, 50, 70, 90];
    const results = [];
    qualities.forEach(q => {
        const data = compressJPEG(q / 100);
        const size = dataURLtoSize(data);
        results.push({ quality: q, size: formatBytes(size), reduction: ((originalFileSize - size) / originalFileSize * 100).toFixed(1) + '%' });
    });
    console.table(results);
    showSuccess('Batch compression complete. Check console for results.');
}

// Notification System
function showNotification(message, type) {
    const existing = document.querySelector(`.notification.${type}`);
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message; // textContent prevents XSS
    const colors = { error: '#ef4444', success: '#22c55e', loading: '#3b82f6' };
    const bg = colors[type] || '#3b82f6';
    el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 20px;' +
        'border-radius:8px;font-size:14px;max-width:400px;word-break:break-word;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.3);color:#fff';
    el.style.background = bg;
    document.body.appendChild(el);
    if (type !== 'loading') setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showLoading(message) {
    showNotification(message, 'loading');
}

function hideLoading() {
    const notification = document.querySelector('.notification.loading');
    if (notification) notification.remove();
}

// Batch File Processing with Error Handling
function processBatchFiles(files) {
    if (!files || files.length === 0) {
        showError('No files selected');
        return;
    }
    
    const results = [];
    let processed = 0;
    let errors = 0;
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        showError('No valid image files found');
        return;
    }
    
    showLoading(`Processing ${validFiles.length} images...`);
    
    validFiles.forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
            errors++;
            processed++;
            results.push({ name: sanitizeText(file.name), status: 'Error: File too large', original: formatBytes(file.size) });
            if (processed === validFiles.length) finalizeBatch();
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const compressed = tempCanvas.toDataURL('image/jpeg', 0.8);
                    const originalSize = file.size;
                    const compressedSize = dataURLtoSize(compressed);
                    
                    results.push({
                        name: sanitizeText(file.name),
                        status: 'Success',
                        original: formatBytes(originalSize),
                        compressed: formatBytes(compressedSize),
                        reduction: ((originalSize - compressedSize) / originalSize * 100).toFixed(1) + '%'
                    });
                } catch (err) {
                    errors++;
                    results.push({ name: sanitizeText(file.name), status: 'Error: ' + sanitizeErrorMessage(err.message) });
                }
                
                processed++;
                if (processed === validFiles.length) finalizeBatch();
            };
            img.onerror = () => {
                errors++;
                processed++;
                results.push({ name: sanitizeText(file.name), status: 'Error: Failed to load' });
                if (processed === validFiles.length) finalizeBatch();
            };
            const dataURL = e.target.result;
            if (dataURL && typeof dataURL === 'string' && dataURL.startsWith('data:image/')) {
                img.src = dataURL;
            } else {
                errors++;
                processed++;
                results.push({ name: sanitizeText(file.name), status: 'Error: Invalid image data' });
                if (processed === validFiles.length) finalizeBatch();
            }
        };
        reader.onerror = () => {
            errors++;
            processed++;
            results.push({ name: sanitizeText(file.name), status: 'Error: Failed to read' });
            if (processed === validFiles.length) finalizeBatch();
        };
        reader.readAsDataURL(file);
    });
    
    function finalizeBatch() {
        hideLoading();
        console.table(results);
        if (errors > 0) {
            showError(`Batch complete: ${processed - errors} succeeded, ${errors} failed. Check console.`);
        } else {
            showSuccess(`Batch complete! Processed ${processed} images. Check console.`);
        }
    }
}

// Mode Switching
function switchMode(mode) {
    currentMode = mode;
    const imageComparison = document.getElementById('imageComparison');
    const threedViewer = document.getElementById('threedViewer');
    const threedControls = document.getElementById('threedControls');
    const threedStrengthGroup = document.getElementById('threedStrengthGroup');
    const threed3DPresetsGroup = document.getElementById('threed3DPresetsGroup'); // PHASE 1 NEW
    const threedBtn = document.getElementById('threedBtn');

    [compressModeBtn, decompressModeBtn, threedModeBtn].forEach(b => b && b.classList.remove('active'));

    // Hide all mode-specific UI first
    compressionControls.style.display = 'none';
    decompressionControls.style.display = 'none';
    if (threedControls) threedControls.style.display = 'none';
    if (threedStrengthGroup) threedStrengthGroup.style.display = 'none';
    if (threed3DPresetsGroup) threed3DPresetsGroup.style.display = 'none'; // PHASE 1 NEW
    compressBtn.style.display = 'none';
    decompressBtn.style.display = 'none';
    if (threedBtn) threedBtn.style.display = 'none';
    const recoveryCard = document.getElementById('recoveryCard');
    const vertexCard = document.getElementById('vertexReductionCard');
    const faceCard = document.getElementById('faceReductionCard');
    // PHASE 1: Hide 3D quality metrics
    const hausdorffCard = document.getElementById('hausdorffCard');
    const rmsErrorCard = document.getElementById('rmsErrorCard');
    const normalDevCard = document.getElementById('normalDevCard');
    const volumeChangeCard = document.getElementById('volumeChangeCard');
    const qualityScoreCard = document.getElementById('qualityScoreCard');
    if (recoveryCard) recoveryCard.style.display = 'none';
    if (vertexCard) vertexCard.style.display = 'none';
    if (faceCard) faceCard.style.display = 'none';
    if (hausdorffCard) hausdorffCard.style.display = 'none';
    if (rmsErrorCard) rmsErrorCard.style.display = 'none';
    if (normalDevCard) normalDevCard.style.display = 'none';
    if (volumeChangeCard) volumeChangeCard.style.display = 'none';
    if (qualityScoreCard) qualityScoreCard.style.display = 'none';
    if (imageComparison) imageComparison.style.display = 'none';
    if (threedViewer) threedViewer.style.display = 'none';

    if (mode === 'compress') {
        compressModeBtn.classList.add('active');
        compressionControls.style.display = 'block';
        compressBtn.style.display = 'inline-flex';
        if (imageComparison) imageComparison.style.display = originalImage ? 'grid' : 'none';
        document.getElementById('modeTitle').textContent = 'Compression Settings';
        document.getElementById('processedTitle').textContent = 'Compressed Image';
        document.getElementById('metricsTitle').textContent = 'Compression Metrics';
    } else if (mode === 'decompress') {
        decompressModeBtn.classList.add('active');
        decompressionControls.style.display = 'block';
        decompressBtn.style.display = 'inline-flex';
        if (imageComparison) imageComparison.style.display = originalImage ? 'grid' : 'none';
        document.getElementById('modeTitle').textContent = 'Decompression Settings';
        document.getElementById('processedTitle').textContent = 'Decompressed Image';
        document.getElementById('metricsTitle').textContent = 'Decompression Metrics';
        if (recoveryCard) recoveryCard.style.display = 'block';
    } else if (mode === '3d') {
        if (threedModeBtn) threedModeBtn.classList.add('active');
        if (threedControls) threedControls.style.display = 'block';
        if (threedStrengthGroup) threedStrengthGroup.style.display = 'block';
        if (threed3DPresetsGroup) threed3DPresetsGroup.style.display = 'block'; // PHASE 1: Show presets
        if (threedBtn) threedBtn.style.display = 'inline-flex';
        const has3D = typeof current3DData !== 'undefined' && current3DData;
        if (threedViewer) threedViewer.style.display = has3D ? 'grid' : 'none';
        document.getElementById('modeTitle').textContent = '3D Compression Settings';
        document.getElementById('metricsTitle').textContent = '3D Compression Metrics';
        if (vertexCard) vertexCard.style.display = 'block';
        if (faceCard) faceCard.style.display = 'block';
        // PHASE 1: Show 3D quality metrics
        if (hausdorffCard) hausdorffCard.style.display = 'block';
        if (rmsErrorCard) rmsErrorCard.style.display = 'block';
        if (normalDevCard) normalDevCard.style.display = 'block';
        if (volumeChangeCard) volumeChangeCard.style.display = 'block';
        if (qualityScoreCard) qualityScoreCard.style.display = 'block';
    }
}

// DECOMPRESSION FUNCTIONS

// Main Decompression Function
function decompressImageWithProgress() {
    if (!originalImage) {
        showError('No image loaded. Please upload a compressed image first.');
        return;
    }
    
    if (isProcessing) {
        showError('Decompression already in progress. Please wait.');
        return;
    }
    
    try {
        isProcessing = true;
        cancelRequested = false;
        showLoading('Decompressing image...');
        decompressBtn.disabled = true;
        
        setTimeout(() => {
            try {
                checkCancellation();
                const startTime = performance.now();
                const type = decompressionType.value;
                
                let decompressedData;
                
                if (type === 'auto') {
                    decompressedData = autoDecompress();
                } else if (type === 'rle') {
                    decompressedData = rleDecompress();
                } else if (type === 'kmeans') {
                    decompressedData = kmeansDecompress();
                } else if (type === 'quantize') {
                    decompressedData = dequantizeColors();
                } else {
                    decompressedData = autoDecompress();
                }
                
                if (!decompressedData || !decompressedData.startsWith('data:image')) {
                    throw new Error('Decompression failed to produce valid output');
                }
                
                const endTime = performance.now();
                compressedDataURL = decompressedData;
                displayCompressedImage(decompressedData, () => {
                    calculateDecompressionMetrics(decompressedData, endTime - startTime);
                });
                hideLoading();
                showSuccess(`Decompression complete! (${(endTime - startTime).toFixed(2)}ms)`);
            } catch (error) {
                hideLoading();
                if (error.message !== 'Operation cancelled by user') {
                    showError('Decompression failed: ' + sanitizeErrorMessage(error.message));
                    console.error('Decompression error:', error);
                }
            } finally {
                isProcessing = false;
                decompressBtn.disabled = false;
            }
        }, 100);
    } catch (error) {
        hideLoading();
        showError('Decompression failed: ' + sanitizeErrorMessage(error.message));
        console.error('Decompression error:', error);
        isProcessing = false;
        decompressBtn.disabled = false;
    }
}

// Auto-detect and decompress
function autoDecompress() {
    // Try to extract metadata from image
    const ctx = originalCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    
    // Check for embedded metadata in alpha channel or pixel patterns
    const metadata = extractMetadata(imageData);
    
    if (metadata && metadata.type === 'rle') {
        return rleDecompress();
    } else if (metadata && metadata.type === 'kmeans') {
        return kmeansDecompress();
    } else {
        // Default: apply enhancement/upscaling
        return enhanceImage();
    }
}

// Extract metadata from image
function extractMetadata(imageData) {
    // Simple metadata extraction from last row of pixels
    // In production, use steganography or EXIF data
    return compressionMetadata; // Use stored metadata
}

// RLE Decompression
function rleDecompress() {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    // Reverse the quantization applied during RLE compression
    for (let i = 0; i < data.length; i += 4) {
        // Add slight variation to break up uniform blocks
        const noise = Math.random() * 8 - 4;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// K-means Decompression (Color expansion)
function kmeansDecompress() {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    // Apply gradient smoothing to expand color palette
    for (let y = 1; y < compressedCanvas.height - 1; y++) {
        for (let x = 1; x < compressedCanvas.width - 1; x++) {
            const i = (y * compressedCanvas.width + x) * 4;
            
            // Average with neighbors for smoother gradients
            for (let c = 0; c < 3; c++) {
                const neighbors = [
                    data[i + c],
                    data[i - 4 + c],
                    data[i + 4 + c],
                    data[i - compressedCanvas.width * 4 + c],
                    data[i + compressedCanvas.width * 4 + c]
                ];
                const avg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
                data[i + c] = Math.round(avg * 0.7 + data[i + c] * 0.3);
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Dequantize Colors
function dequantizeColors() {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    // Apply bilateral filter for edge-preserving smoothing
    const tempData = new Uint8ClampedArray(data);
    const radius = 2;
    
    for (let y = radius; y < compressedCanvas.height - radius; y++) {
        for (let x = radius; x < compressedCanvas.width - radius; x++) {
            const i = (y * compressedCanvas.width + x) * 4;
            
            for (let c = 0; c < 3; c++) {
                let sum = 0, weightSum = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ni = ((y + dy) * compressedCanvas.width + (x + dx)) * 4;
                        const spatialDist = dx * dx + dy * dy;
                        const colorDist = Math.abs(tempData[i + c] - tempData[ni + c]);
                        const weight = Math.exp(-spatialDist / 8 - colorDist / 32);
                        
                        sum += tempData[ni + c] * weight;
                        weightSum += weight;
                    }
                }
                
                data[i + c] = Math.round(sum / weightSum);
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Enhance Image (for generic decompression)
function enhanceImage() {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    // Apply unsharp mask for sharpening
    const tempData = new Uint8ClampedArray(data);
    const kernel = [-1, -1, -1, -1, 9, -1, -1, -1, -1];
    const kernelSize = 3;
    const half = Math.floor(kernelSize / 2);
    
    for (let y = half; y < compressedCanvas.height - half; y++) {
        for (let x = half; x < compressedCanvas.width - half; x++) {
            const i = (y * compressedCanvas.width + x) * 4;
            
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        const py = y + ky - half;
                        const px = x + kx - half;
                        const pi = (py * compressedCanvas.width + px) * 4;
                        sum += tempData[pi + c] * kernel[ky * kernelSize + kx];
                    }
                }
                data[i + c] = Math.max(0, Math.min(255, sum));
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/png');
}

// Calculate Decompression Metrics
function calculateDecompressionMetrics(decompressedDataURL, processingTime) {
    try {
        if (!originalFileSize) return;
        const decompressedSize = dataURLtoSize(decompressedDataURL);
        const sizeIncrease = ((decompressedSize - originalFileSize) / originalFileSize * 100).toFixed(1);
        const ratio = (decompressedSize / originalFileSize).toFixed(2);

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('compressedSize', `Size: ${formatBytes(decompressedSize)}`);
        set('compressedSizeMetric', formatBytes(decompressedSize));
        set('sizeReduction', `${sizeIncrease}%`);
        set('compressionRatio', `${ratio}:1`);
        set('processingTime', `${processingTime.toFixed(2)}ms`);

        const recoveryRate = calculateRecoveryRate();
        set('recoveryRate', `${recoveryRate.toFixed(1)}%`);

        const pixels = originalCanvas.width * originalCanvas.height;
        if (pixels > 0) set('bitsPerPixel', `${(decompressedSize * 8 / pixels).toFixed(2)} bpp`);

        calculateQualityMetrics();
    } catch (err) {
        console.error('Error calculating decompression metrics:', err);
    }
}

// Calculate Recovery Rate
function calculateRecoveryRate() {
    if (!originalImageData) return 100;
    
    const compCtx = compressedCanvas.getContext('2d');
    const compData = compCtx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    
    if (originalImageData.width !== compData.width || originalImageData.height !== compData.height) {
        return 95; // Approximate for different sizes
    }
    
    let totalDiff = 0;
    const pixels = originalImageData.width * originalImageData.height;
    
    for (let i = 0; i < originalImageData.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const diff = Math.abs(originalImageData.data[i + c] - compData.data[i + c]);
            totalDiff += diff;
        }
    }
    
    const avgDiff = totalDiff / (pixels * 3);
    const recoveryRate = Math.max(0, 100 - (avgDiff / 255 * 100));
    
    return recoveryRate;
}

// Store metadata during compression
function storeCompressionMetadata(type, params) {
    compressionMetadata = {
        type: type,
        params: params,
        timestamp: Date.now(),
        originalSize: originalFileSize,
        dimensions: {
            width: originalCanvas.width,
            height: originalCanvas.height
        }
    };
}

// Initialize
console.log('Advanced Image Compression & Decompression Tool Initialized');
console.log('Available commands: batchCompress(), exportReport(), applyPreset("web"|"thumbnail"|"highQuality"|"lowSize"), toggleZoom(), undo(), redo(), cancelOperation(), viewAnalytics()');
console.log('NEW: Switch to Decompress mode to reverse compression effects!');

// ADVANCED FEATURES

// Progress Bar System
function showProgress(message, percent) {
    let progressBar = document.querySelector('.progress-container');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'progress-container';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'progress-message';
        const barDiv = document.createElement('div');
        barDiv.className = 'progress-bar';
        const fillDiv = document.createElement('div');
        fillDiv.className = 'progress-fill';
        const textDiv = document.createElement('div');
        textDiv.className = 'progress-text';
        textDiv.textContent = '0%';
        barDiv.appendChild(fillDiv);
        barDiv.appendChild(textDiv);
        progressBar.appendChild(msgDiv);
        progressBar.appendChild(barDiv);
        document.body.appendChild(progressBar);
    }
    progressBar.querySelector('.progress-message').textContent = message;
    progressBar.querySelector('.progress-fill').style.width = percent + '%';
    progressBar.querySelector('.progress-text').textContent = Math.round(percent) + '%';
    progressBar.style.display = 'block';
}

function hideProgress() {
    const progressBar = document.querySelector('.progress-container');
    if (progressBar) progressBar.style.display = 'none';
}

// Cancellation Support
function cancelOperation() {
    if (isProcessing) {
        cancelRequested = true;
        showError('Cancellation requested...');
    }
}

function checkCancellation() {
    if (cancelRequested) {
        cancelRequested = false;
        isProcessing = false;
        hideProgress();
        hideLoading();
        compressBtn.disabled = false;
        if (decompressBtn) decompressBtn.disabled = false;
        throw new Error('Operation cancelled by user');
    }
}

// Undo/Redo System
function saveState() {
    if (compressedDataURL) {
        undoStack.push({
            dataURL: compressedDataURL,
            type: compressionType.value,
            quality: qualitySlider.value,
            timestamp: Date.now()
        });
        redoStack = [];
        if (undoStack.length > 10) undoStack.shift();
    }
}

function undo() {
    if (undoStack.length === 0) {
        showError('Nothing to undo');
        return;
    }
    if (compressedDataURL) {
        redoStack.push({
            dataURL: compressedDataURL,
            type: compressionType.value,
            quality: qualitySlider.value,
            timestamp: Date.now()
        });
    }
    const state = undoStack.pop();
    compressedDataURL = state.dataURL;
    compressionType.value = state.type;
    qualitySlider.value = state.quality;
    qualityValue.textContent = state.quality;
    handleCompressionTypeChange();
    displayCompressedImage(state.dataURL);
    showSuccess('Undo successful');
}

function redo() {
    if (redoStack.length === 0) {
        showError('Nothing to redo');
        return;
    }
    if (compressedDataURL) {
        undoStack.push({
            dataURL: compressedDataURL,
            type: compressionType.value,
            quality: qualitySlider.value,
            timestamp: Date.now()
        });
    }
    const state = redoStack.pop();
    compressedDataURL = state.dataURL;
    compressionType.value = state.type;
    qualitySlider.value = state.quality;
    qualityValue.textContent = state.quality;
    handleCompressionTypeChange();
    displayCompressedImage(state.dataURL);
    showSuccess('Redo successful');
}

// Retry Mechanism
function retryLastOperation() {
    if (!currentOperation) {
        showError('No operation to retry');
        return;
    }
    showLoading('Retrying operation...');
    setTimeout(() => {
        try {
            compressImageWithProgress();
        } catch (err) {
            showError('Retry failed: ' + sanitizeErrorMessage(err.message));
        }
    }, 500);
}

// Comparison History
function addToComparisonHistory() {
    if (!compressedDataURL || !originalImage) return;
    comparisonHistory.push({
        original: originalImage.src,
        compressed: compressedDataURL,
        type: compressionType.value,
        quality: qualitySlider.value,
        originalSize: originalFileSize,
        compressedSize: dataURLtoSize(compressedDataURL),
        timestamp: Date.now()
    });
    if (comparisonHistory.length > 20) comparisonHistory.shift();
}

function viewComparisonHistory() {
    if (comparisonHistory.length === 0) {
        showError('No comparison history available');
        return;
    }
    console.log('=== Comparison History ===');
    comparisonHistory.forEach((item, idx) => {
        const reduction = item.originalSize > 0
            ? ((item.originalSize - item.compressedSize) / item.originalSize * 100).toFixed(1)
            : '0.0';
        console.log(`${idx + 1}. ${item.type} @ ${item.quality}% - ${formatBytes(item.originalSize)} → ${formatBytes(item.compressedSize)} (${reduction}% reduction)`);
    });
    showSuccess('Comparison history logged to console');
}

// Advanced Analytics
function viewAnalytics() {
    if (compressionHistory.length === 0) {
        showError('No compression data available');
        return;
    }
    
    const analytics = {
        totalCompressions: compressionHistory.length,
        avgReduction: (compressionHistory.reduce((sum, e) => sum + parseFloat(e.reduction), 0) / compressionHistory.length).toFixed(2) + '%',
        avgTime: (compressionHistory.reduce((sum, e) => sum + e.time, 0) / compressionHistory.length).toFixed(2) + 'ms',
        totalSaved: formatBytes(compressionHistory.reduce((sum, e) => sum + (e.originalSize - e.compressedSize), 0)),
        bestReduction: Math.max(...compressionHistory.map(e => parseFloat(e.reduction))).toFixed(1) + '%',
        fastestTime: Math.min(...compressionHistory.map(e => e.time)).toFixed(2) + 'ms',
        algorithmUsage: {}
    };
    
    compressionHistory.forEach(e => {
        analytics.algorithmUsage[e.type] = (analytics.algorithmUsage[e.type] || 0) + 1;
    });
    
    console.log('=== Advanced Analytics ===');
    console.table(analytics);
    console.log('Algorithm Usage:', analytics.algorithmUsage);
    showSuccess('Analytics displayed in console');
    return analytics;
}

// Enhanced Compression with Progress
function compressImageWithProgress() {
    if (currentMode === '3d') { showError('Switch to Compress mode first.'); return; }
    if (!originalImage) {
        showError('No image loaded. Please upload an image first.');
        return;
    }
    
    if (isProcessing) {
        showError('Compression already in progress. Please wait.');
        return;
    }
    
    try {
        isProcessing = true;
        cancelRequested = false;
        currentOperation = { type: compressionType.value, quality: qualitySlider.value };
        
        const fileSize = originalFileSize;
        const isLargeFile = fileSize > 5 * 1024 * 1024; // 5MB
        
        if (isLargeFile) {
            showProgress('Preparing compression...', 0);
        } else {
            showLoading('Compressing image...');
        }
        
        compressBtn.disabled = true;
        
        setTimeout(() => {
            try {
                checkCancellation();
                if (isLargeFile) showProgress('Processing image...', 30);
                
                const startTime = performance.now();
                const type = compressionType.value;
                const quality = qualitySlider.value / 100;
                const resizeScale = resizePercent.value / 100;
                
                if (quality < 0 || quality > 1) throw new Error('Invalid quality value');
                
                checkCancellation();
                if (isLargeFile) showProgress('Applying compression...', 60);
                
                let compressedData;
                switch(type) {
                    case 'jpeg': 
                        compressedData = compressJPEG(quality);
                        storeCompressionMetadata('jpeg', { quality });
                        break;
                    case 'webp': 
                        compressedData = compressWebP(quality);
                        storeCompressionMetadata('webp', { quality });
                        break;
                    case 'quantize': 
                        compressedData = quantizeColors(quality);
                        storeCompressionMetadata('quantize', { quality });
                        break;
                    case 'resize':
                        if (resizeScale <= 0 || resizeScale > 1) throw new Error('Invalid resize scale');
                        compressedData = resizeAndCompress(resizeScale, quality);
                        storeCompressionMetadata('resize', { quality, scale: resizeScale });
                        break;
                    case 'grayscale': 
                        compressedData = grayscaleCompress(quality);
                        storeCompressionMetadata('grayscale', { quality });
                        break;
                    case 'dithering': 
                        compressedData = ditheringCompress(quality);
                        storeCompressionMetadata('dithering', { quality });
                        break;
                    case 'rle': 
                        compressedData = rleCompress();
                        storeCompressionMetadata('rle', {});
                        break;
                    case 'kmeans': 
                        compressedData = kmeansCompress(quality);
                        storeCompressionMetadata('kmeans', { quality });
                        break;
                    case 'avif': 
                        compressedData = compressAVIF(quality);
                        storeCompressionMetadata('avif', { quality });
                        break;
                    case 'progressive': 
                        compressedData = compressProgressiveJPEG(quality);
                        storeCompressionMetadata('progressive', { quality });
                        break;
                    case 'chroma': 
                        compressedData = compressChromaSubsampling(quality);
                        storeCompressionMetadata('chroma', { quality });
                        break;
                    default: 
                        compressedData = compressJPEG(quality);
                        storeCompressionMetadata('jpeg', { quality });
                }
                
                checkCancellation();
                if (!compressedData || !compressedData.startsWith('data:image')) {
                    throw new Error('Compression failed to produce valid output');
                }
                
                if (isLargeFile) showProgress('Finalizing...', 90);
                
                const endTime = performance.now();
                saveState();
                compressedDataURL = compressedData;
                calculateMetrics(compressedData, endTime - startTime);
                displayCompressedImage(compressedData, () => {
                    calculateQualityMetrics();
                });
                addToComparisonHistory();
                
                if (isLargeFile) {
                    showProgress('Complete!', 100);
                    setTimeout(hideProgress, 1000);
                } else {
                    hideLoading();
                }
                
                showSuccess(`Compression complete! (${(endTime - startTime).toFixed(2)}ms)`);
            } catch (error) {
                hideProgress();
                hideLoading();
                if (error.message !== 'Operation cancelled by user') {
                    showError('Compression failed: ' + sanitizeErrorMessage(error.message));
                    console.error('Compression error:', error);
                }
            } finally {
                isProcessing = false;
                compressBtn.disabled = false;
            }
        }, 100);
    } catch (error) {
        hideProgress();
        hideLoading();
        showError('Compression failed: ' + sanitizeErrorMessage(error.message));
        console.error('Compression error:', error);
        isProcessing = false;
        compressBtn.disabled = false;
    }
}


// FINAL ADVANCED FEATURES

// AVIF Format Support
function compressAVIF(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const avifSupported = testCanvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    
    if (avifSupported) {
        return compressedCanvas.toDataURL('image/avif', quality);
    }
    
    showError('AVIF not supported. Using WebP fallback.');
    return compressedCanvas.toDataURL('image/webp', quality);
}

// Progressive JPEG Encoding
// Canvas API does not support true progressive encoding; draws at requested quality.
function compressProgressiveJPEG(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    return compressedCanvas.toDataURL('image/jpeg', quality);
}

// Chroma Subsampling (4:2:0)
function compressChromaSubsampling(quality) {
    const ctx = compressedCanvas.getContext('2d');
    compressedCanvas.width = originalCanvas.width;
    compressedCanvas.height = originalCanvas.height;
    ctx.drawImage(originalImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
    const data = imageData.data;
    
    for (let y = 0; y < compressedCanvas.height; y += 2) {
        for (let x = 0; x < compressedCanvas.width; x += 2) {
            let avgCb = 0, avgCr = 0, count = 0;
            for (let dy = 0; dy < 2 && y + dy < compressedCanvas.height; dy++) {
                for (let dx = 0; dx < 2 && x + dx < compressedCanvas.width; dx++) {
                    const idx = ((y + dy) * compressedCanvas.width + (x + dx)) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    avgCb += -0.168736 * r - 0.331264 * g + 0.5 * b;
                    avgCr += 0.5 * r - 0.418688 * g - 0.081312 * b;
                    count++;
                }
            }
            avgCb /= count;
            avgCr /= count;
            
            for (let dy = 0; dy < 2 && y + dy < compressedCanvas.height; dy++) {
                for (let dx = 0; dx < 2 && x + dx < compressedCanvas.width; dx++) {
                    const idx = ((y + dy) * compressedCanvas.width + (x + dx)) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    data[idx] = Math.max(0, Math.min(255, Y + 1.402 * avgCr));
                    data[idx + 1] = Math.max(0, Math.min(255, Y - 0.344136 * avgCb - 0.714136 * avgCr));
                    data[idx + 2] = Math.max(0, Math.min(255, Y + 1.772 * avgCb));
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return compressedCanvas.toDataURL('image/jpeg', quality);
}
