import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ke.go.kenyaworkers.employee',
  appName: 'Kenya Workers',
  webDir: 'mobile/dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
