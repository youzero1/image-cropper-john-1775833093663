import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Image Cropper',
  description: 'A simple and powerful image cropper application',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
