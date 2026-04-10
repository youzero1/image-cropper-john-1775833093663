'use client';

import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import styles from './ImageCropper.module.css';
import { Area, Point } from 'react-easy-crop';

type AspectOption = { label: string; value: number };

const ASPECT_OPTIONS: AspectOption[] = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: 'Free', value: 0 },
];

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas is empty')); return; }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

// Resize handle positions
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = typeof HANDLES[number];

interface FreeBox {
  x: number; // percent of container
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function ImageCropper() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('cropped-image');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [aspectIndex, setAspectIndex] = useState<number>(0);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Free mode state
  const [freeBox, setFreeBox] = useState<FreeBox>({ x: 10, y: 10, w: 80, h: 80 });
  const freeDragRef = useRef<{ type: 'move' | Handle; startX: number; startY: number; box: FreeBox } | null>(null);
  const freeContainerRef = useRef<HTMLDivElement>(null);

  const isFreeMode = ASPECT_OPTIONS[aspectIndex].value === 0;

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    setFileName(name);
    setCroppedImageUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFreeBox({ x: 10, y: 10, w: 80, h: 80 });
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCrop = useCallback(async () => {
    if (!imageSrc) return;

    if (isFreeMode) {
      // Use freeBox to crop
      const container = freeContainerRef.current;
      if (!container) return;
      setIsCropping(true);
      try {
        const img = new window.Image();
        img.src = imageSrc;
        await new Promise<void>((res) => { img.onload = () => res(); });
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        // Box in pixel coords of container
        const bx = (freeBox.x / 100) * cw;
        const by = (freeBox.y / 100) * ch;
        const bw = (freeBox.w / 100) * cw;
        const bh = (freeBox.h / 100) * ch;
        // Map to image coords
        const scaleX = img.naturalWidth / cw;
        const scaleY = img.naturalHeight / ch;
        const area: Area = {
          x: bx * scaleX,
          y: by * scaleY,
          width: bw * scaleX,
          height: bh * scaleY,
        };
        const url = await getCroppedImg(imageSrc, area);
        setCroppedImageUrl(url);
      } catch (err) {
        console.error(err);
      } finally {
        setIsCropping(false);
      }
      return;
    }

    if (!croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const url = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedImageUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCropping(false);
    }
  }, [imageSrc, croppedAreaPixels, isFreeMode, freeBox]);

  const handleDownload = useCallback(() => {
    if (!croppedImageUrl) return;
    const a = document.createElement('a');
    a.href = croppedImageUrl;
    a.download = `${fileName}-cropped.png`;
    a.click();
  }, [croppedImageUrl, fileName]);

  const handleReset = useCallback(() => {
    setImageSrc(null);
    setCroppedImageUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFreeBox({ x: 10, y: 10, w: 80, h: 80 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Free mode mouse/touch handlers
  const onHandleMouseDown = useCallback((e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    freeDragRef.current = { type: handle, startX: e.clientX, startY: e.clientY, box: { ...freeBox } };

    const onMove = (ev: MouseEvent) => {
      if (!freeDragRef.current || !freeContainerRef.current) return;
      const container = freeContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dx = ((ev.clientX - freeDragRef.current.startX) / cw) * 100;
      const dy = ((ev.clientY - freeDragRef.current.startY) / ch) * 100;
      const orig = freeDragRef.current.box;
      let { x, y, w, h } = orig;
      const minSize = 5;

      const type = freeDragRef.current.type;
      if (type === 'move') {
        x = clamp(orig.x + dx, 0, 100 - orig.w);
        y = clamp(orig.y + dy, 0, 100 - orig.h);
      } else {
        if (type.includes('e')) {
          w = clamp(orig.w + dx, minSize, 100 - orig.x);
        }
        if (type.includes('w')) {
          const newW = clamp(orig.w - dx, minSize, orig.x + orig.w);
          x = orig.x + orig.w - newW;
          w = newW;
        }
        if (type.includes('s')) {
          h = clamp(orig.h + dy, minSize, 100 - orig.y);
        }
        if (type.includes('n')) {
          const newH = clamp(orig.h - dy, minSize, orig.y + orig.h);
          y = orig.y + orig.h - newH;
          h = newH;
        }
      }
      setFreeBox({ x, y, w, h });
    };

    const onUp = () => {
      freeDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [freeBox]);

  const onBoxMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    freeDragRef.current = { type: 'move', startX: e.clientX, startY: e.clientY, box: { ...freeBox } };

    const onMove = (ev: MouseEvent) => {
      if (!freeDragRef.current || !freeContainerRef.current) return;
      const container = freeContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dx = ((ev.clientX - freeDragRef.current.startX) / cw) * 100;
      const dy = ((ev.clientY - freeDragRef.current.startY) / ch) * 100;
      const orig = freeDragRef.current.box;
      setFreeBox({
        x: clamp(orig.x + dx, 0, 100 - orig.w),
        y: clamp(orig.y + dy, 0, 100 - orig.h),
        w: orig.w,
        h: orig.h,
      });
    };

    const onUp = () => {
      freeDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [freeBox]);

  // Touch handlers for free mode
  const onHandleTouchStart = useCallback((e: React.TouchEvent, handle: Handle) => {
    e.stopPropagation();
    const touch = e.touches[0];
    freeDragRef.current = { type: handle, startX: touch.clientX, startY: touch.clientY, box: { ...freeBox } };

    const onMove = (ev: TouchEvent) => {
      if (!freeDragRef.current || !freeContainerRef.current) return;
      const t = ev.touches[0];
      const container = freeContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dx = ((t.clientX - freeDragRef.current.startX) / cw) * 100;
      const dy = ((t.clientY - freeDragRef.current.startY) / ch) * 100;
      const orig = freeDragRef.current.box;
      let { x, y, w, h } = orig;
      const minSize = 5;
      const type = freeDragRef.current.type;
      if (type === 'move') {
        x = clamp(orig.x + dx, 0, 100 - orig.w);
        y = clamp(orig.y + dy, 0, 100 - orig.h);
      } else {
        if (type.includes('e')) w = clamp(orig.w + dx, minSize, 100 - orig.x);
        if (type.includes('w')) { const nw = clamp(orig.w - dx, minSize, orig.x + orig.w); x = orig.x + orig.w - nw; w = nw; }
        if (type.includes('s')) h = clamp(orig.h + dy, minSize, 100 - orig.y);
        if (type.includes('n')) { const nh = clamp(orig.h - dy, minSize, orig.y + orig.h); y = orig.y + orig.h - nh; h = nh; }
      }
      setFreeBox({ x, y, w, h });
    };
    const onEnd = () => {
      freeDragRef.current = null;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }, [freeBox]);

  const onBoxTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    freeDragRef.current = { type: 'move', startX: touch.clientX, startY: touch.clientY, box: { ...freeBox } };
    const onMove = (ev: TouchEvent) => {
      if (!freeDragRef.current || !freeContainerRef.current) return;
      const t = ev.touches[0];
      const container = freeContainerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dx = ((t.clientX - freeDragRef.current.startX) / cw) * 100;
      const dy = ((t.clientY - freeDragRef.current.startY) / ch) * 100;
      const orig = freeDragRef.current.box;
      setFreeBox({ x: clamp(orig.x + dx, 0, 100 - orig.w), y: clamp(orig.y + dy, 0, 100 - orig.h), w: orig.w, h: orig.h });
    };
    const onEnd = () => {
      freeDragRef.current = null;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }, [freeBox]);

  const selectedAspect = ASPECT_OPTIONS[aspectIndex];
  const aspectValue = selectedAspect.value === 0 ? undefined : selectedAspect.value;

  const getCursor = (handle: Handle): string => {
    const map: Record<Handle, string> = {
      nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
      e: 'e-resize', se: 'se-resize', s: 's-resize',
      sw: 'sw-resize', w: 'w-resize',
    };
    return map[handle];
  };

  return (
    <div className={styles.container}>
      {!imageSrc ? (
        <div className={styles.uploadArea} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
          <div className={styles.uploadIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className={styles.uploadText}>Click or drag an image to upload</p>
          <p className={styles.uploadSubText}>PNG, JPG, WEBP supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className={styles.editorWrapper}>
          <div className={styles.cropSection}>
            <div className={styles.cropContainer} ref={isFreeMode ? freeContainerRef : undefined}>
              {isFreeMode ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc} alt="source" className={styles.freeImage} draggable={false} />
                  {/* Dark overlay */}
                  <div className={styles.freeOverlay}>
                    {/* Top strip */}
                    <div className={styles.overlayTop} style={{ height: `${freeBox.y}%` }} />
                    {/* Middle row */}
                    <div className={styles.overlayMiddle} style={{ top: `${freeBox.y}%`, height: `${freeBox.h}%` }}>
                      <div className={styles.overlayLeft} style={{ width: `${freeBox.x}%` }} />
                      <div className={styles.overlayRight} style={{ left: `${freeBox.x + freeBox.w}%` }} />
                    </div>
                    {/* Bottom strip */}
                    <div className={styles.overlayBottom} style={{ top: `${freeBox.y + freeBox.h}%` }} />
                  </div>
                  {/* Crop box */}
                  <div
                    className={styles.freeBox}
                    style={{
                      left: `${freeBox.x}%`,
                      top: `${freeBox.y}%`,
                      width: `${freeBox.w}%`,
                      height: `${freeBox.h}%`,
                    }}
                    onMouseDown={onBoxMouseDown}
                    onTouchStart={onBoxTouchStart}
                  >
                    {/* Rule-of-thirds grid lines */}
                    <div className={styles.gridLine} style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px' }} />
                    <div className={styles.gridLine} style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px' }} />
                    <div className={styles.gridLine} style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px' }} />
                    <div className={styles.gridLine} style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px' }} />

                    {/* Resize handles */}
                    {HANDLES.map((handle) => (
                      <div
                        key={handle}
                        className={`${styles.handle} ${styles[`handle-${handle}`]}`}
                        style={{ cursor: getCursor(handle) }}
                        onMouseDown={(e) => onHandleMouseDown(e, handle)}
                        onTouchStart={(e) => onHandleTouchStart(e, handle)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspectValue}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>Aspect Ratio</label>
                <div className={styles.aspectButtons}>
                  {ASPECT_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.label}
                      className={`${styles.aspectBtn} ${idx === aspectIndex ? styles.aspectBtnActive : ''}`}
                      onClick={() => setAspectIndex(idx)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {!isFreeMode && (
                <>
                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>Zoom: {zoom.toFixed(1)}x</label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setZoom(Number(e.target.value))}
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <label className={styles.controlLabel}>Rotation: {rotation}°</label>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={rotation}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRotation(Number(e.target.value))}
                      className={styles.slider}
                    />
                  </div>
                </>
              )}

              {isFreeMode && (
                <div className={styles.freeHint}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Drag the box to move it. Drag any handle to resize freely.
                </div>
              )}

              <div className={styles.actionButtons}>
                <button className={styles.cropBtn} onClick={handleCrop} disabled={isCropping}>
                  {isCropping ? 'Cropping...' : 'Crop Image'}
                </button>
                <button className={styles.resetBtn} onClick={handleReset}>
                  Reset
                </button>
              </div>
            </div>
          </div>

          {croppedImageUrl && (
            <div className={styles.previewSection}>
              <h2 className={styles.previewTitle}>Cropped Result</h2>
              <div className={styles.previewImageWrapper}>
                <img src={croppedImageUrl} alt="Cropped" className={styles.previewImage} />
              </div>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PNG
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
