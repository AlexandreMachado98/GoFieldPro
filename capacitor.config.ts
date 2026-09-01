import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gofield.pro',
  appName: 'GoField Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#020617',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    StatusBar: {
      backgroundColor: '#020617',
      style: 'DARK',
    },
  },
};

export default config;
