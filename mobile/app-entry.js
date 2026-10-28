import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import '../public/styles.css';

window.KWMS_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
window.KWMS_IS_MOBILE_APP = Capacitor.isNativePlatform();

window.KWMS_GET_LOCATION = async () => {
  let permissions = await Geolocation.checkPermissions();
  if (permissions.location !== 'granted') {
    permissions = await Geolocation.requestPermissions();
  }
  if (permissions.location !== 'granted') {
    throw new Error('Precise location permission is needed to mark attendance.');
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    locationCapturedAt: position.timestamp,
  };
};

await import('../public/app.js');
