//
//  LlamadaEntrante.swift
//  Stratos AI
//
//  QUE HACE: que una llamada del equipo ocupe la PANTALLA COMPLETA del iPhone
//  con la app cerrada — la misma pantalla que usa WhatsApp o una llamada normal,
//  con el nombre de quien llama y los botones de contestar y rechazar.
//
//  POR QUE HACE FALTA CODIGO PARA ESTO. Un aviso normal, por mas prioridad que
//  tenga, solo puede aparecer como una tira arriba de la pantalla. La pantalla
//  completa de llamada es un privilegio que iOS le da SOLO a las apps que usan
//  su sistema de llamadas (CallKit) y su canal de avisos de llamada (PushKit).
//  No hay atajo: es esto o una tira.
//
//  ⚠️ LA OBLIGACION QUE APPLE NO PERDONA
//
//  Cuando llega un aviso por el canal de llamadas, la app TIENE que avisarle al
//  sistema en ese mismo instante. Si no lo hace, iOS la cierra; si pasa varias
//  veces, le quita el permiso de recibir llamadas y no vuelve.
//
//  Por eso todo el codigo de abajo esta escrito con una sola regla: REPORTAR
//  SIEMPRE, pase lo que pase. Si el aviso viene sin nombre, se reporta igual con
//  un nombre generico. Si viene vacio, se reporta igual. Nunca hay un camino que
//  termine sin reportar — ni un `return` temprano, ni un `if` que se salte el
//  reporte. Es la diferencia entre una funcion que anda y una app que iOS mata.
//
//  ⚠️ ES UN CANAL SEPARADO, A PROPOSITO. Los avisos normales (recordatorios,
//  mensajes, leads) siguen viajando por el camino de siempre y no dependen de
//  nada de este archivo. Si esto fallara o Apple lo rechazara, lo unico que se
//  pierde es la pantalla completa: todo lo demas sigue llegando igual.
//
//  Creado el 27-ago-2026, a pedido de Angel: "cuando llamen con la app cerrada
//  quiero que salga en pantalla completa, asi como lo hace WhatsApp".
//

import Foundation
import UIKit
import PushKit
import CallKit
import AVFoundation
import Capacitor

final class LlamadaEntrante: NSObject {

    static let shared = LlamadaEntrante()

    private var proveedor: CXProvider?
    private var registroVoIP: PKPushRegistry?

    /// Se guarda para poder cerrar la pantalla cuando la persona cuelga o
    /// cuando la llamada se atiende desde otro lado.
    private var llamadaActual: UUID?

    /// A donde entra la persona al contestar. Lo manda el servidor en el aviso.
    private var enlaceReunion: String?

    // MARK: - Arranque

    /// Deja el telefono listo para recibir llamadas. Se llama una vez, al abrir.
    func arrancar() {
        // El proveedor es lo que dibuja la pantalla de llamada. La
        // configuracion decide como se ve y que puede hacer la persona.
        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        // Sin esto, iOS muestra el numero de telefono de quien llama. Nuestras
        // llamadas no tienen numero: tienen un nombre y un enlace de reunion.
        config.supportedHandleTypes = [.generic]
        if let icono = UIImage(named: "AppIcon60x60")?.pngData() {
            config.iconTemplateImageData = icono
        }

        let p = CXProvider(configuration: config)
        p.setDelegate(self, queue: nil)
        proveedor = p

        // El canal por el que llegan los avisos de llamada. Es distinto del de
        // los avisos normales y tiene su propia identificacion del telefono.
        let registro = PKPushRegistry(queue: .main)
        registro.delegate = self
        registro.desiredPushTypes = [.voIP]
        registroVoIP = registro
    }

    // MARK: - Mostrar y cerrar

    /// Muestra la pantalla de llamada entrante.
    ///
    /// `completion` es la promesa que le hicimos a iOS: se llama SIEMPRE, haya
    /// salido bien o mal. Dejarla sin llamar es lo que hace que iOS cierre la app.
    private func mostrar(nombre: String, motivo: String?, enlace: String?, completion: @escaping () -> Void) {
        let id = UUID()
        llamadaActual = id
        enlaceReunion = enlace

        let quien = CXHandle(type: .generic, value: nombre)
        let update = CXCallUpdate()
        update.remoteHandle = quien
        update.localizedCallerName = nombre
        update.hasVideo = false
        update.supportsDTMF = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false

        guard let proveedor = proveedor else {
            // Sin proveedor no hay pantalla que mostrar, pero la promesa a iOS
            // se cumple igual: es lo unico que impide que cierre la app.
            completion()
            return
        }

        proveedor.reportNewIncomingCall(with: id, update: update) { _ in
            // Se cumple pase lo que pase, incluso si iOS rechazo la llamada
            // (por ejemplo si la persona tiene el telefono en No Molestar).
            completion()
        }
    }

    /// Cierra la pantalla de llamada.
    private func cerrar(_ razon: CXCallEndedReason) {
        guard let id = llamadaActual, let proveedor = proveedor else { return }
        proveedor.reportCall(with: id, endedAt: Date(), reason: razon)
        llamadaActual = nil
    }

    /// El unico camino para hablarle al CRM.
    ///
    /// Tiene que ser `triggerWindowJSEvent` del puente de Capacitor: los avisos
    /// internos de Swift (NotificationCenter) NO cruzan al CRM — se quedan del
    /// lado nativo y nadie los escucha. Es un error facil de cometer porque el
    /// codigo compila igual y no falla: simplemente el mensaje no llega.
    private func avisarleAlCRM(_ evento: String, datos: [String: String] = [:]) {
        var todo = datos
        todo["evento"] = evento
        let json = (try? JSONSerialization.data(withJSONObject: todo))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

        DispatchQueue.main.async {
            guard let vc = UIApplication.shared.connectedScenes
                    .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController })
                    .first as? CAPBridgeViewController,
                  let bridge = vc.bridge else { return }
            bridge.triggerWindowJSEvent(eventName: evento == "token"
                                        ? "StratosTokenVoIP" : "StratosLlamada",
                                        data: json)
        }
    }

    /// Lo que se llama al contestar o rechazar.
    private func avisarleALaApp(_ evento: String) {
        var datos: [String: String] = [:]
        if let enlace = enlaceReunion { datos["url"] = enlace }
        avisarleAlCRM(evento, datos: datos)
    }
}

// MARK: - El canal de avisos de llamada

extension LlamadaEntrante: PKPushRegistryDelegate {

    /// iOS entrega la identificacion de este telefono para el canal de llamadas.
    /// Es DISTINTA de la de los avisos normales: son dos buzones separados.
    func pushRegistry(_ registry: PKPushRegistry,
                      didUpdate pushCredentials: PKPushCredentials,
                      for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        // Se le pasa al CRM para que lo guarde junto al usuario que entro.
        avisarleAlCRM("token", datos: ["token": token])
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didInvalidatePushTokenFor type: PKPushType) {
        avisarleAlCRM("token", datos: ["token": ""])
    }

    /// LLEGO UNA LLAMADA.
    ///
    /// Este es el metodo delicado: hay que reportarla al sistema ANTES de que
    /// termine, sin excepcion. Por eso no hay ningun `return` que se salte
    /// `mostrar(...)` — ni cuando el aviso viene vacio.
    func pushRegistry(_ registry: PKPushRegistry,
                      didReceiveIncomingPushWith payload: PKPushPayload,
                      for type: PKPushType,
                      completion: @escaping () -> Void) {

        guard type == .voIP else { completion(); return }

        let datos = payload.dictionaryPayload
        // Valores por defecto a proposito: es preferible una pantalla que diga
        // "Stratos AI" a que iOS cierre la app por no haber reportado nada.
        let nombre = (datos["caller"] as? String)
            ?? (datos["nombre"] as? String)
            ?? "Stratos AI"
        let motivo = datos["motivo"] as? String
        let enlace = (datos["url"] as? String) ?? (datos["meet"] as? String)

        mostrar(nombre: nombre, motivo: motivo, enlace: enlace, completion: completion)
    }
}

// MARK: - Lo que hace la persona en la pantalla

extension LlamadaEntrante: CXProviderDelegate {

    func providerDidReset(_ provider: CXProvider) {
        llamadaActual = nil
        enlaceReunion = nil
    }

    /// Contestar: se abre la app y se entra a la reunion.
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        avisarleALaApp("contestar")
        action.fulfill()
        // La pantalla de llamada se cierra enseguida: lo que sigue pasa dentro
        // de la app (o del navegador, si la reunion es un enlace).
        cerrar(.answeredElsewhere)
    }

    /// Rechazar o colgar.
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        avisarleALaApp("rechazar")
        llamadaActual = nil
        enlaceReunion = nil
        action.fulfill()
    }

    // iOS exige que existan aunque no se usen: una llamada que no se puede
    // silenciar ni poner en espera igual tiene que responder que lo intento.
    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) { action.fulfill() }
    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) { action.fulfill() }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) { }
    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) { }
}
