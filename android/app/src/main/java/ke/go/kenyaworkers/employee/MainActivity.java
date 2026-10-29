package ke.go.kenyaworkers.employee;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DeviceLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
