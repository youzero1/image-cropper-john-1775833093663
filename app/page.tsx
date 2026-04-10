import ImageCropper from '@/components/ImageCropper';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Image Cropper
      </h1>
      <p style={{ color: '#aaa', marginBottom: '32px', fontSize: '1rem' }}>
        Upload an image, crop it, and download the result
      </p>
      <ImageCropper />
    </main>
  );
}
