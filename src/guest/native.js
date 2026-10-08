// Guest builds never register or call Capacitor plugins.
export const isNativeApp = () => false;
export const nativePlugin = () => null;
export const ensureNotifPermission = async () => false;
export const notifyUser = async () => {};
export const addNotificationTapListener = () => () => {};
export const savePdfDoc = async () => false;
export const descargarBlob = async () => false;
export const descargarArchivo = async () => false;
