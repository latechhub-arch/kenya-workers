import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import '../public/styles.css';

window.KWMS_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
window.KWMS_IS_MOBILE_APP = Capacitor.isNativePlatform();
const DeviceLocation = registerPlugin('DeviceLocation');

window.KWMS_GET_LOCATION = async () => {
  let permissions = await Geolocation.checkPermissions();
  if (permissions.location !== 'granted') {
    permissions = await Geolocation.requestPermissions();
  }
  if (permissions.location !== 'granted') {
    throw new Error('Precise location permission is needed to mark attendance.');
  }

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return DeviceLocation.getCurrentPosition();
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Math.ceil(position.coords.accuracy * 100) / 100,
    locationCapturedAt: position.timestamp,
    mockLocationDetected: null,
  };
};

await import('../public/app.js');
