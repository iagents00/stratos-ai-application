import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Deja el telefono listo para recibir llamadas a pantalla completa.
        //
        // Va ACA y no mas tarde por una razon concreta: iOS puede entregar una
        // llamada apenas arranca la app, incluso antes de que la persona vea
        // nada. Si el sistema de llamadas todavia no esta preparado en ese
        // momento, la llamada se pierde — y peor, iOS lo cuenta como que la app
        // no cumplio, que es lo que la hace perder el permiso.
        LlamadaEntrante.shared.arrancar()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Cada vez que la app queda a la vista se le vuelve a ofrecer al CRM la
        // identificacion para llamadas. Es el momento en que es MAS probable
        // que el CRM ya este cargado y escuchando — al arrancar casi nunca lo
        // esta, y esa era la razon por la que las llamadas no salian a pantalla
        // completa: la identificacion se emitia una sola vez, sin nadie del
        // otro lado, y se perdia para siempre.
        //
        // Reofrecerla de mas no cuesta nada: del otro lado se guarda siempre la
        // misma y no se duplica.
        LlamadaEntrante.shared.reenviarToken()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // ── EL IDENTIFICADOR QUE APPLE LE DA A ESTE TELEFONO ─────────────────────
    //
    // Estos dos metodos FALTABAN, y eran la causa de que las notificaciones no
    // llegaran nunca con la app cerrada. Lo que pasaba era esto:
    //
    //   1. la app pedia registrarse contra Apple  -> OK
    //   2. Apple generaba el identificador        -> OK
    //   3. iOS se lo entregaba al AppDelegate     -> y aca no habia nadie
    //   4. el identificador se perdia             -> en silencio, sin error
    //
    // Sin nadie que lo recoja, iOS simplemente lo descarta. El plugin se queda
    // esperando un evento que no va a llegar, y la app dice "el telefono acepto
    // pero todavia no dio su identificacion" — que es exactamente lo que veia
    // Angel el 27-ago-2026 despues de varias versiones.
    //
    // Capacitor NO los agrega solo: hay que ponerlos a mano en cada proyecto.
    // Por eso `cap sync` nunca lo arreglo, y por eso reinstalar tampoco servia:
    // el problema no estaba en la instalacion ni en los permisos, estaba en que
    // faltaba el buzon donde iOS deja el sobre.
    //
    // ⚠️ Si algun dia se regenera la carpeta de iOS desde cero, HAY QUE VOLVER
    // A AGREGARLOS. Es el archivo que mas facil se pierde en una regeneracion.
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications,
                                        object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Que el fallo llegue al JavaScript importa tanto como el exito: sin
        // esto, un rechazo de Apple seria indistinguible de "todavia no llego".
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications,
                                        object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
