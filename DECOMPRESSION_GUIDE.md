# 🔄 Image Decompression Feature Guide

## Overview

The Advanced Image Compression Tool now includes **intelligent decompression** capabilities that can reverse or enhance compressed images. This feature uses advanced algorithms to recover image quality and expand compressed data.

---

## 🎯 Key Features

### 1. **Dual Mode Interface**
- **Compress Mode**: Standard compression with 11 algorithms
- **Decompress Mode**: Reverse compression effects and enhance images
- Easy toggle between modes with visual feedback

### 2. **Decompression Algorithms**

#### Auto-Detect Decompression
- Automatically identifies compression type from metadata
- Applies appropriate decompression algorithm
- Falls back to generic enhancement if type unknown

#### RLE Decompression
- Reverses Run-Length Encoding compression
- Adds controlled noise to break up uniform blocks
- Restores natural texture to flat areas
- **Use Case**: Images compressed with RLE

#### K-means Decompression
- Expands limited color palettes
- Applies gradient smoothing between color clusters
- Reconstructs intermediate colors
- **Use Case**: Images compressed with K-means clustering

#### Color Dequantization
- Reverses color quantization effects
- Uses bilateral filtering for edge-preserving smoothing
- Reduces color banding artifacts
- **Use Case**: Images with posterization or color banding

#### Generic Enhancement
- Applies unsharp masking for sharpening
- Enhances edges and details
- Reduces compression artifacts
- **Use Case**: JPEG, WebP, or unknown compression types

---

## 📊 Decompression Metrics

### New Metrics in Decompress Mode:

1. **Recovery Rate** (NEW)
   - Measures similarity to original image
   - Range: 0-100%
   - Higher = better recovery
   - Formula: `100 - (avgPixelDifference / 255 * 100)`

2. **Size Increase**
   - Shows file size expansion after decompression
   - Indicates data restoration level

3. **PSNR Quality**
   - Peak Signal-to-Noise Ratio
   - Measures decompression quality
   - Higher dB = better quality

4. **Processing Time**
   - Decompression algorithm execution time
   - Helps compare algorithm efficiency

---

## 🚀 How to Use

### Basic Workflow

1. **Upload Compressed Image**
   ```
   - Drag & drop or click to upload
   - Supports JPEG, PNG, WebP, AVIF
   - Max size: 50MB
   ```

2. **Switch to Decompress Mode**
   ```
   - Click "Decompress" button in control panel
   - UI updates to show decompression options
   ```

3. **Select Decompression Type**
   ```
   - Auto-Detect (recommended)
   - RLE Decompress
   - K-means Decompress
   - Dequantize Colors
   ```

4. **Apply Decompression**
   ```
   - Click "Apply Decompression"
   - View side-by-side comparison
   - Check recovery metrics
   ```

5. **Download Result**
   ```
   - Click "Download Compressed Image"
   - Saves decompressed version
   ```

---

## 🔬 Technical Details

### Decompression Algorithms Explained

#### 1. RLE Decompression
```javascript
// Reverses quantization and adds texture
for each pixel:
    add controlled noise (-4 to +4)
    clamp to valid range (0-255)
```

**Best For**: Images with large uniform areas, flat colors

#### 2. K-means Decompression
```javascript
// Expands color palette with gradient smoothing
for each pixel:
    average with 4 neighbors
    blend 70% averaged + 30% original
    creates smooth color transitions
```

**Best For**: Posterized images, limited color palettes

#### 3. Color Dequantization
```javascript
// Bilateral filter (edge-preserving smoothing)
for each pixel in radius:
    calculate spatial distance weight
    calculate color similarity weight
    weighted average of neighbors
```

**Best For**: Color banding, quantization artifacts

#### 4. Generic Enhancement
```javascript
// Unsharp mask sharpening
kernel = [-1, -1, -1,
          -1,  9, -1,
          -1, -1, -1]
apply convolution to sharpen edges
```

**Best For**: Blurry images, JPEG artifacts

---

## 📈 Performance Characteristics

| Algorithm | Speed | Quality | Best Use Case |
|-----------|-------|---------|---------------|
| Auto-Detect | Fast | High | General purpose |
| RLE Decompress | Very Fast | Medium | Uniform areas |
| K-means Decompress | Medium | High | Color expansion |
| Dequantize | Slow | Very High | Artifact removal |
| Enhancement | Fast | Medium | Sharpening |

---

## 🎨 Use Cases & Examples

### Use Case 1: Recover Over-Compressed JPEG
```
1. Upload blurry JPEG
2. Switch to Decompress mode
3. Select "Auto-Detect"
4. Apply decompression
5. Result: Sharpened image with reduced artifacts
```

### Use Case 2: Expand Color Palette
```
1. Upload posterized image (K-means compressed)
2. Switch to Decompress mode
3. Select "K-means Decompress"
4. Apply decompression
5. Result: Smooth gradients, expanded colors
```

### Use Case 3: Remove Color Banding
```
1. Upload image with banding
2. Switch to Decompress mode
3. Select "Dequantize Colors"
4. Apply decompression
5. Result: Smooth color transitions
```

### Use Case 4: Restore Texture
```
1. Upload RLE compressed image
2. Switch to Decompress mode
3. Select "RLE Decompress"
4. Apply decompression
5. Result: Natural texture restored
```

---

## 🔧 Advanced Features

### Metadata Storage
- Compression metadata stored during compression
- Enables intelligent auto-detection
- Includes: type, parameters, dimensions, timestamp

### Recovery Rate Calculation
```javascript
recoveryRate = 100 - (avgPixelDifference / 255 * 100)

where:
  avgPixelDifference = sum of absolute differences / total pixels
```

### Undo/Redo Support
- Works in both compress and decompress modes
- Stores last 10 states
- Preserves settings and quality

---

## 💡 Tips & Best Practices

### For Best Results:

1. **Use Auto-Detect First**
   - Automatically selects best algorithm
   - Fallback to enhancement if needed

2. **Match Compression Type**
   - If you know compression type, select it manually
   - Better results than auto-detect

3. **Iterate Multiple Times**
   - Some images benefit from multiple passes
   - Try different algorithms in sequence

4. **Check Recovery Rate**
   - >95%: Excellent recovery
   - 85-95%: Good recovery
   - <85%: Limited recovery (try different algorithm)

5. **Compare PSNR Values**
   - Higher PSNR = better quality
   - >40 dB: Good quality
   - >50 dB: Excellent quality

---

## 🔍 Comparison: Compress vs Decompress

| Feature | Compress Mode | Decompress Mode |
|---------|---------------|-----------------|
| Purpose | Reduce file size | Restore quality |
| Algorithms | 11 compression types | 4 decompression types |
| Metrics | Size reduction, ratio | Recovery rate, enhancement |
| Output | Smaller file | Larger, enhanced file |
| Use Case | Web optimization | Quality recovery |

---

## 🐛 Troubleshooting

### Issue: Low Recovery Rate
**Solution**: 
- Try different decompression algorithm
- Use "Dequantize Colors" for best quality
- Some compression is irreversible (lossy)

### Issue: Image Looks Worse
**Solution**:
- Use Undo button to revert
- Try "Auto-Detect" instead
- Original may already be optimal

### Issue: Slow Processing
**Solution**:
- "Dequantize Colors" is slowest (bilateral filter)
- Use "RLE Decompress" for speed
- Large images take longer

### Issue: No Visible Improvement
**Solution**:
- Image may not be compressed
- Try "Enhancement" for sharpening
- Check original image quality

---

## 📚 API Reference

### Console Commands

```javascript
// Switch to decompress mode programmatically
switchMode('decompress');

// Switch back to compress mode
switchMode('compress');

// Get current compression metadata
console.log(compressionMetadata);

// Calculate recovery rate manually
const rate = calculateRecoveryRate();
console.log('Recovery Rate:', rate + '%');
```

---

## 🔮 Future Enhancements

Planned features for decompression:

- [ ] AI-based super-resolution
- [ ] Deep learning artifact removal
- [ ] Texture synthesis for lost details
- [ ] Multi-pass iterative enhancement
- [ ] Custom decompression profiles
- [ ] Batch decompression
- [ ] Before/after slider comparison
- [ ] Decompression presets
- [ ] Export decompression report
- [ ] Metadata embedding in images

---

## 📖 Technical Background

### Why Decompression?

Lossy compression permanently removes data, but decompression can:
1. **Reduce artifacts**: Smooth out compression artifacts
2. **Enhance edges**: Sharpen blurred details
3. **Expand colors**: Interpolate missing colors
4. **Restore texture**: Add natural variation

### Limitations

- **Cannot recover lost data**: Lossy compression is irreversible
- **Approximation only**: Decompression estimates original
- **Quality depends on compression**: Heavily compressed images recover less
- **Processing intensive**: Some algorithms are slow

### Algorithm Selection Guide

```
Input Image Type → Recommended Algorithm
─────────────────────────────────────────
Flat colors, uniform areas → RLE Decompress
Limited color palette → K-means Decompress
Color banding, posterization → Dequantize Colors
Blurry, JPEG artifacts → Enhancement
Unknown/Mixed → Auto-Detect
```

---

## 🎓 Learning Resources

### Understanding Decompression

1. **Bilateral Filtering**: Edge-preserving smoothing
2. **Unsharp Masking**: Sharpening technique
3. **Gradient Smoothing**: Color interpolation
4. **Noise Addition**: Texture restoration

### Related Concepts

- Image enhancement
- Artifact removal
- Super-resolution
- Denoising
- Edge detection
- Color space conversion

---

## 📞 Support

For issues or questions:
1. Check console for error messages
2. Review troubleshooting section
3. Try different decompression algorithms
4. Use Undo/Redo to experiment safely

---

## 📄 License

Educational project for understanding image compression and decompression techniques.

---

**Version**: 2.0.0 (with Decompression)  
**Last Updated**: 2024  
**Author**: Advanced Image Compression Tool Team
