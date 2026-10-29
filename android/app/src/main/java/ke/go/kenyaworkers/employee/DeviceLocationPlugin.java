package ke.go.kenyaworkers.employee;

import android.Manifest;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "DeviceLocation")
public class DeviceLocationPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationListener listener;
    private Runnable timeout;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            call.reject("Precise location permission is needed to mark attendance.");
            return;
        }

        LocationManager manager = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
        AtomicBoolean completed = new AtomicBoolean(false);
        listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (!completed.compareAndSet(false, true)) return;
                cleanup(manager);
                JSObject result = new JSObject();
                result.put("latitude", location.getLatitude());
                result.put("longitude", location.getLongitude());
                result.put("accuracyMeters", Math.ceil(location.getAccuracy() * 100.0) / 100.0);
                result.put("locationCapturedAt", location.getTime());
                result.put("mockLocationDetected", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        ? location.isMock()
                        : location.isFromMockProvider());
                call.resolve(result);
            }

            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
        };

        timeout = () -> {
            if (!completed.compareAndSet(false, true)) return;
            cleanup(manager);
            call.reject("A fresh GPS fix could not be obtained. Turn on Location and try again outdoors.");
        };
        handler.postDelayed(timeout, 30000);

        String provider = manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                ? LocationManager.GPS_PROVIDER
                : (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                    ? LocationManager.NETWORK_PROVIDER
                    : null);
        try {
            if (provider != null) {
                manager.requestSingleUpdate(provider, listener, Looper.getMainLooper());
            } else if (completed.compareAndSet(false, true)) {
                cleanup(manager);
                call.reject("Location services are unavailable. Turn on Location and try again.");
            }
        } catch (SecurityException | IllegalArgumentException exception) {
            if (completed.compareAndSet(false, true)) {
                cleanup(manager);
                call.reject("A fresh GPS fix could not be obtained. Turn on Location and try again outdoors.");
            }
        }
    }

    private void cleanup(LocationManager manager) {
        handler.removeCallbacks(timeout);
        if (listener != null) {
            try { manager.removeUpdates(listener); } catch (SecurityException ignored) {}
            listener = null;
        }
        timeout = null;
    }
}
