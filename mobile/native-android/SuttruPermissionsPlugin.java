package in.suttru.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Android owns every permission dialog and the full/selected-photo choices. */
@CapacitorPlugin(name="SuttruPermissions", permissions={
    @Permission(alias="camera", strings={Manifest.permission.CAMERA}),
    @Permission(alias="location", strings={Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}),
    @Permission(alias="images", strings={Manifest.permission.READ_MEDIA_IMAGES}),
    @Permission(alias="selectedImages", strings={Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED}),
    @Permission(alias="legacyImages", strings={Manifest.permission.READ_EXTERNAL_STORAGE})
})
public class SuttruPermissionsPlugin extends Plugin {
    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission)==PackageManager.PERMISSION_GRANTED;
    }
    private String photoAccess() {
        if(Build.VERSION.SDK_INT>=33 && granted(Manifest.permission.READ_MEDIA_IMAGES))return "full";
        if(Build.VERSION.SDK_INT>=34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED))return "limited";
        if(Build.VERSION.SDK_INT<=32 && granted(Manifest.permission.READ_EXTERNAL_STORAGE))return "full";
        return "denied";
    }
    private JSObject state() {
        JSObject result=new JSObject();
        result.put("photos",photoAccess());
        result.put("camera",granted(Manifest.permission.CAMERA)?"granted":"denied");
        result.put("location",granted(Manifest.permission.ACCESS_COARSE_LOCATION)||granted(Manifest.permission.ACCESS_FINE_LOCATION)?"granted":"denied");
        return result;
    }
    @PluginMethod public void status(PluginCall call){call.resolve(state());}
    @PluginMethod public void requestPhotos(PluginCall call){
        if(!"denied".equals(photoAccess())){call.resolve(state());return;}
        if(Build.VERSION.SDK_INT>=34)requestPermissionForAliases(new String[]{"images","selectedImages"},call,"permissionResult");
        else requestPermissionForAlias(Build.VERSION.SDK_INT>=33?"images":"legacyImages",call,"permissionResult");
    }
    @PluginMethod public void requestCamera(PluginCall call){
        if(granted(Manifest.permission.CAMERA)){call.resolve(state());return;}
        requestPermissionForAlias("camera",call,"permissionResult");
    }
    @PluginMethod public void requestLocation(PluginCall call){
        if(granted(Manifest.permission.ACCESS_COARSE_LOCATION)||granted(Manifest.permission.ACCESS_FINE_LOCATION)){call.resolve(state());return;}
        requestPermissionForAlias("location",call,"permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call){call.resolve(state());}
    @PluginMethod public void openSettings(PluginCall call){
        getActivity().runOnUiThread(()->{try{
            Intent intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));
            getActivity().startActivity(intent);call.resolve();
        }catch(RuntimeException ex){call.reject("Unable to open Android Settings. Open Settings > Apps > Suttru > Permissions.");}});
    }
}
