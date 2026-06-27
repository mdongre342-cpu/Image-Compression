# Advanced Image Compression Tool

A sophisticated web-based image compression **and decompression** tool with multiple algorithms and real-time quality metrics.

## Features

### 🔄 NEW: Decompression Mode

**Reverse compression effects and enhance images!**

1. **Auto-Detect Decompression**
   - Automatically identifies compression type
   - Applies optimal decompression algorithm
   - Falls back to generic enhancement

2. **RLE Decompression**
   - Reverses Run-Length Encoding
   - Adds texture to uniform areas
   - Restores natural variation

3. **K-means Decompression**
   - Expands limited color palettes
   - Gradient smoothing between colors
   - Reconstructs intermediate shades

4. **Color Dequantization**
   - Removes color banding artifacts
   - Bilateral filtering for smoothing
   - Edge-preserving enhancement

5. **Generic Enhancement**
   - Unsharp masking for sharpening
   - Reduces JPEG artifacts
   - Enhances edges and details

### Compression Algorithms

1. **JPEG Quality Compression**
   - Standard lossy compression
   - Adjustable quality from 1-100%
   - Best for photographs

2. **WebP Compression**
   - Modern format with superior compression
   - Better quality-to-size ratio than JPEG
   - Browser support detection

3. **Color Quantization**
   - Reduces color palette dynamically
   - Maintains visual quality
   - Outputs PNG format

4. **Grayscale Compression**
   - Converts to grayscale using luminance formula (0.299R + 0.587G + 0.114B)
   - Reduces file size by ~66%
   - Preserves brightness information

5. **Floyd-Steinberg Dithering**
   - Error diffusion algorithm
   - Creates illusion of depth with limited colors
   - Produces artistic posterization effect

6. **Run-Length Encoding (RLE)**
   - Compresses consecutive identical pixels
   - Effective for images with uniform areas
   - Lossless compression technique

7. **K-means Color Clustering**
   - Machine learning-based color reduction
   - Finds optimal color palette
   - Superior quality preservation

8. **Resize & Compress**
   - Dimension reduction (10-100%)
   - High-quality resampling
   - Combined with JPEG compression

### Advanced Metrics

- **File Size Reduction**: Percentage of size saved
- **Compression Ratio**: Original:Compressed ratio
- **Processing Time**: Algorithm execution time in milliseconds
- **PSNR (Peak Signal-to-Noise Ratio)**: Quality metric in dB (higher = better)
- **Bits Per Pixel**: Storage efficiency metric
- **Recovery Rate** (Decompress Mode): Similarity to original (0-100%)
- **Compression History**: Tracks all compression attempts

### Technical Features

- Drag & drop file upload
- Real-time preview comparison
- Side-by-side zoom comparison (2x)
- Compression presets (Web, Thumbnail, High Quality, Low Size)
- Batch file processing UI
- Export compression report
- Comprehensive error handling
- File size validation (max 50MB)
- Dimension validation (max 8192x8192)
- Image format detection
- Timestamp-based downloads
- Console batch processing
- Loading indicators
- Success/Error notifications
- Processing state management

## Usage

### Compression Mode

1. Open `index.html` in a modern browser
2. Upload an image (drag & drop or click)
3. Select compression type
4. Adjust quality slider
5. Click "Apply Compression"
6. Compare results and download

### Decompression Mode (NEW)

1. Upload a compressed image
2. Click "Decompress" button to switch modes
3. Select decompression type (or use Auto-Detect)
4. Click "Apply Decompression"
5. View recovery metrics and enhanced image
6. Download decompressed result

**See [DECOMPRESSION_GUIDE.md](DECOMPRESSION_GUIDE.md) for detailed documentation**

## Browser Console Commands

```javascript
// Batch test multiple quality levels
batchCompress();

// View compression history
console.table(compressionHistory);

// Apply compression presets
applyPreset('web');          // 85% JPEG for web
applyPreset('thumbnail');    // 30% resize + 80% quality
applyPreset('highQuality');  // 95% WebP
applyPreset('lowSize');      // 50% JPEG

// Toggle 2x zoom for comparison
toggleZoom();

// Export compression report
exportReport();

// Undo/Redo operations
undo();                      // Undo last compression
redo();                      // Redo last undone operation

// Retry last operation
retryLastOperation();

// Cancel current operation
cancelOperation();

// View comparison history
viewComparisonHistory();

// View advanced analytics
viewAnalytics();

// NEW: Switch between modes
switchMode('compress');      // Switch to compress mode
switchMode('decompress');    // Switch to decompress mode

// NEW: View compression metadata
console.log(compressionMetadata);

// NEW: Calculate recovery rate
const rate = calculateRecoveryRate();
console.log('Recovery Rate:', rate + '%');
```

## Technical Details

### PSNR Calculation
```
MSE = Σ(original - compressed)² / (pixels × channels)
PSNR = 10 × log₁₀(255² / MSE)
```

### Dithering Algorithm
Floyd-Steinberg error diffusion distributes quantization error:
```
       X   7/16
3/16  5/16  1/16
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (WebP may vary)
- IE11: Not supported

## Performance

- Processes images up to 50MB
- Real-time compression (<100ms for most operations)
- Efficient canvas-based processing
- No server-side processing required
- Maximum dimension support: 8192x8192 pixels

## Future Enhancements

- [x] Huffman coding implementation (RLE variant)
- [x] Run-length encoding
- [x] K-means color clustering
- [x] Batch file processing UI
- [x] Compression presets
- [x] Side-by-side zoom comparison
- [x] Export compression report
- [x] Progress bars for large files
- [x] Cancellation support
- [x] Retry mechanism
- [x] Undo/Redo functionality
- [x] Comparison history
- [x] Advanced analytics
- [x] AVIF format support
- [x] Progressive JPEG encoding
- [x] Chroma subsampling options

## License

Educational project for understanding image compression techniques.
