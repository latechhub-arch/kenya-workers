import { defineConfig } from 'vite';

const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim();
if (!apiBaseUrl || !apiBaseUrl.startsWith('https://')) {
  throw new Error(
    'Set VITE_API_BASE_URL to the HTTPS URL of the deployed Kenya Workers API before building the Android app.',
  );
}

export default defineConfig({
  root: 'mobile',
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
