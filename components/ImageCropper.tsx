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
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCrop = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const url = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedImageUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCropping(false);
    }
  }, [imageSrc, croppedAreaPixels]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const selectedAspect = ASPECT_OPTIONS[aspectIndex];
  const aspectValue = selectedAspect.value === 0 ? undefined : selectedAspect.value;

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
            <div className={styles.cropContainer}>
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
