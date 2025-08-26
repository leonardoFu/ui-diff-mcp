# Detecting Layout Shifts with OpenCV

This research note explains how OpenCV can be used to detect **global layout shifts** between two screenshots, which is useful for visual regression testing, UI automation, or stability checks.

---

## Why OpenCV for Layout Shifts?
Resemble.js can highlight movement visually but cannot quantify or extract structured data about shifts. OpenCV provides tools to measure **translation, scaling, and rotation** between two images, letting us report actual displacement vectors rather than just mismatched pixels.

---

## Approaches

### 1. Phase Correlation (Global Translation)
- Estimates a single `(dx, dy)` shift between two images.
- Robust to brightness differences.
- Very fast and accurate for pure translations.

```python
(dy, dx), response = cv2.phaseCorrelate(imgA, imgB)
```

- **dx, dy** → global layout shift in pixels
- **response** → confidence score (0–1)

---

### 2. ECC Image Registration (Affine Transform)
- Uses `cv2.findTransformECC` to align two images.
- Can capture **translation, rotation, scaling, and shear**.
- Provides an affine matrix that can be decomposed into dx, dy, scale, and rotation.

```python
cc, warp = cv2.findTransformECC(a_gray, b_gray, warp_matrix, cv2.MOTION_AFFINE)
```

Output warp matrix:
```
[ [a11 a12 tx],
  [a21 a22 ty] ]
```

From this, extract:
- **dx, dy**: translations
- **scale_x, scale_y**
- **rotation angle**

---

### 3. Feature Matching + RANSAC
- Uses ORB/SIFT to match keypoints between images.
- Robust if screenshots differ significantly (content changes, cropping).
- With RANSAC, estimates affine transform even under noisy matches.

```python
M, inliers = cv2.estimateAffinePartial2D(src_pts, dst_pts, method=cv2.RANSAC)
```

Provides dx, dy, scale, and rotation.

---

## Reporting Layout Shifts

After estimating the transformation:
- **dx, dy**: Pixel offset
- **scale deviation**: DPR/viewport changes
- **rotation_deg**: Unexpected rotations
- **residual error**: Indicates whether changes were global or local

Thresholding rules for CI:
- If |dx|, |dy| ≤ 2 px → negligible shift
- If scale deviation > 2% → viewport/DPR mismatch
- If residual error is high → likely local shifts (e.g., component moved independently)

---

## Practical Tips
- **Mask dynamic zones** (ads, timestamps) before alignment.
- **Pre-blur** to reduce noise from text antialiasing.
- **Downscale** large screenshots before correlation for speed.
- **Clip to overlapping regions** if screenshots have different scroll positions.

---

## When to Use Which
- **Phase correlation:** fast, when you expect only translation.  
- **ECC:** robust, captures affine transforms (translation, scale, rotation).  
- **Feature matching:** fallback for complex cases with partial overlaps or major content changes.

---

## Summary
OpenCV allows you to go beyond visual diffs by providing **structured metrics** for global layout shifts between screenshots. By combining phase correlation, ECC, and feature-based alignment, you can reliably measure displacement, detect viewport changes, and decide whether differences are global (layout shift) or local (component regressions).
