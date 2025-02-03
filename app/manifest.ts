import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BookVerse - Your Digital Reading Companion',
    short_name: 'BookVerse',
    description: 'A modern progressive web app for reading and managing your digital books',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
  {
    "src": "/icons/manifest-icon-192.maskable.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "/icons/manifest-icon-192.maskable.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "maskable"
  },
  {
    "src": "/icons/manifest-icon-512.maskable.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "/icons/manifest-icon-512.maskable.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "maskable"
  }
],
  };
}
