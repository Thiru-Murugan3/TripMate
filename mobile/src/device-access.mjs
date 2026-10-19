// Permission requests only follow a traveller's camera/location action.
export function createDeviceAccess({camera, location, confirmAction, readPhoto, makeFile, preferences}) {
  const denied = feature => new Error(`${feature} access is off. Open Android Settings > Apps > Suttru > Permissions to allow it, or continue without it.`);
  async function allow(plugin, permission, reason, explain=true) {
    let state = await plugin.checkPermissions();
    const granted = () => state[permission] === 'granted' || (permission === 'location' && state.coarseLocation === 'granted');
    if (granted()) return true;
    if (state[permission] === 'denied') throw denied(permission === 'camera' ? 'Camera' : 'Location');
    if (explain && !confirmAction(reason)) return false;
    state = await plugin.requestPermissions({permissions:[permission]});
    if (!granted()) throw denied(permission === 'camera' ? 'Camera' : 'Location');
    return true;
  }
  async function photoFrom(source) {
    let photo;
    try {
      photo=await camera.getPhoto({source,resultType:'uri',quality:90,width:2000,height:2000,saveToGallery:false,allowEditing:false});
    }catch(error){
      if(/cancelled|canceled/i.test(error?.message || ''))return null;
      throw new Error(source==='CAMERA'?'Unable to open the camera. Check camera access in Android Settings, or choose an existing file.':'Unable to open photos. Please try again, or choose a document file.');
    }
    const blob=await readPhoto(photo);
    if(!blob.size || blob.size>10*1024*1024)throw new Error('The photo must be under 10 MB. Retake it or choose a smaller file.');
    return makeFile(blob,`trip-document-${Date.now()}.jpg`);
  }
  return {
    async permissionSetup() {
      const [done,photos,cameraState,locationState]=await Promise.all([
        preferences.get({key:'permission-setup-v1'}),preferences.get({key:'photo-selection-v1'}),
        camera.checkPermissions().catch(()=>({camera:'unavailable'})),location.checkPermissions().catch(()=>({location:'unavailable'}))
      ]);
      return {completed:done.value==='done',photoSelection:photos.value==='allowed',camera:cameraState.camera,location:locationState.location==='granted'||locationState.coarseLocation==='granted'?'granted':locationState.location};
    },
    async requestPermission(feature) {
      if(feature==='photos'){await preferences.set({key:'photo-selection-v1',value:'allowed'});return true;}
      if(feature==='camera')return allow(camera,'camera','',false);
      if(feature==='location')return allow(location,'location','',false);
      throw new Error('Unknown permission.');
    },
    async completePermissionSetup(){await preferences.set({key:'permission-setup-v1',value:'done'});},
    async resetPhotoSelection(){await preferences.remove({key:'photo-selection-v1'});},
    async pickDocumentPhoto(){
      const consent=await preferences.get({key:'photo-selection-v1'});
      if(consent.value!=='allowed'){
        if(!confirmAction('Allow Suttru to open the photo picker? Only photos you select can be added. This choice will be remembered on this phone.'))return null;
        await preferences.set({key:'photo-selection-v1',value:'allowed'});
      }
      return photoFrom('PHOTOS');
    },
    async takeDocumentPhoto() {
      if (!await allow(camera, 'camera', 'Allow Suttru to use the camera to photograph this trip document? You can review it before uploading, or choose an existing file instead.')) return null;
      return photoFrom('CAMERA');
    },
    async currentPosition() {
      try {
        if (!await allow(location, 'location', 'Allow Suttru to use your current location for nearby places and route starting points? Your location is requested only when you use this action.')) throw new Error('Location request cancelled. Enter a place or select a saved stay instead.');
        return await location.getCurrentPosition({enableHighAccuracy:false,timeout:10000,maximumAge:300000});
      } catch (error) {
        if (/access is off|cancelled/.test(error?.message || '')) throw error;
        throw new Error('Location is unavailable. Check Android location permissions and turn on Location, or choose a place manually.');
      }
    }
  };
}
