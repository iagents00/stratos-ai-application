package com.stratoscapitalgroup.crm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * ServicioLlamadas — que una llamada ABRA la app encima de todo, con la app cerrada.
 *
 * QUE PROBLEMA RESUELVE
 *
 * Los avisos normales ya llegan, pero una llamada aparecia como una tira mas
 * arriba de la pantalla: habia que verla, leerla y tocarla. Una llamada no se
 * mira, se atiende — y si el telefono esta en el bolsillo, una tira no sirve
 * de nada. Angel lo pidio asi: "que se abra algo encima y suene como telefono,
 * con la app cerrada" (27-ago-2026).
 *
 * COMO FUNCIONA
 *
 * Android permite que una notificacion abra una pantalla completa por su cuenta
 * —lo que usa WhatsApp— pero solo si se la marca como llamada y se le da un
 * "destino de pantalla completa". Eso es lo que arma este archivo.
 *
 * La pantalla que se ve NO se dibuja aca: se abre la app, y el CRM muestra su
 * propia pantalla de llamada, la misma que ya existia. Asi se ve igual en los
 * dos sistemas y no hay dos diseños que mantener.
 *
 * ⚠️ LO QUE NO SE PUEDE ROMPER
 *
 * Este servicio REEMPLAZA al que traia el complemento de avisos. Todo lo que no
 * sea una llamada tiene que seguir su camino de siempre — por eso la primera
 * linea de onMessageReceived delega en `super` y sale. Un error aca dejaria sin
 * avisos a todo el equipo, no solo sin llamadas.
 *
 * ⚠️ ANDROID 14 Y EL PERMISO DE PANTALLA COMPLETA
 *
 * Desde Android 14 el permiso de abrir pantalla completa solo se concede solo a
 * las apps de llamadas y alarmas; al resto hay que pedirselo a la persona. Si no
 * esta concedido, Android NO falla: muestra la notificacion como un cartel
 * grande con sonido. Es peor que la pantalla completa pero mucho mejor que una
 * tira — por eso se manda igual y nunca se queda sin avisar.
 */
public class ServicioLlamadas extends MessagingService {

    /** Tiene que coincidir con el canal que crea el CRM (avisos-nativos.js). */
    private static final String CANAL = "llamadas";
    private static final int ID_NOTIFICACION = 7301;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage mensaje) {
        Map<String, String> datos = mensaje.getData();
        String tipo = datos != null ? datos.get("kind") : null;

        if (!"llamada".equals(tipo)) {
            // Todo lo demas sigue exactamente igual que antes.
            super.onMessageReceived(mensaje);
            return;
        }

        try {
            mostrarLlamada(datos, mensaje);
        } catch (Exception e) {
            // Si algo falla armando la pantalla completa, al menos que llegue el
            // aviso normal. Quedarse sin nada seria peor que quedarse sin la
            // pantalla.
            super.onMessageReceived(mensaje);
        }
    }

    private void mostrarLlamada(Map<String, String> datos, RemoteMessage mensaje) {
        // Todo sale de los DATOS, no del bloque de notificacion: una llamada ya
        // no lleva ese bloque a proposito (es lo que hacia que Android la
        // dibujara solo y nunca ejecutara este codigo).
        String quien = "Alguien";
        String texto = "Te está llamando";
        if (datos != null) {
            if (datos.get("caller") != null && !datos.get("caller").isEmpty()) quien = datos.get("caller");
            else if (datos.get("title") != null) quien = datos.get("title");
            if (datos.get("body") != null && !datos.get("body").isEmpty()) texto = datos.get("body");
        }

        asegurarCanal();

        // El destino: abrir la app. El CRM se encarga de mostrar la pantalla de
        // llamada al arrancar, mirando si hay una llamada de hace segundos.
        Intent abrir = new Intent(this, MainActivity.class);
        abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        abrir.putExtra("stratos_llamada", true);
        if (datos != null && datos.get("url") != null) {
            abrir.putExtra("stratos_llamada_url", datos.get("url"));
        }

        int banderas = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            banderas |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent destino = PendingIntent.getActivity(this, 0, abrir, banderas);

        NotificationCompat.Builder n = new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(android.R.drawable.sym_call_incoming)
                .setContentTitle(quien)
                .setContentText(texto)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                // Marcarla como llamada es lo que le dice a Android que puede
                // atravesar el modo silencioso y sonar como un telefono.
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                // `true` = mostrar la pantalla completa AUNQUE el telefono este
                // desbloqueado. Sin eso, con el telefono en la mano solo saldria
                // el cartel de arriba, que es justo lo que se quiere evitar.
                .setFullScreenIntent(destino, true)
                .setContentIntent(destino)
                // SE PUEDE DESCARTAR. Antes estaba marcada como fija para que
                // no se fuera de un manotazo mientras sonaba, y el efecto era el
                // contrario al buscado: quien NO queria atender se quedaba con
                // el aviso pegado sin forma de sacarlo ("sigue insistiendo",
                // Angel, 27-ago-2026). Poder colgar es parte de atender bien una
                // llamada.
                .setAutoCancel(true)
                .setTimeoutAfter(45000)
                .setVibrate(new long[]{0, 700, 400, 700, 400, 700});

        NotificationManagerCompat.from(this).notify(ID_NOTIFICACION, n.build());
    }

    /**
     * El canal decide si suena y con que. Normalmente lo crea el CRM al abrirse,
     * pero con la app CERRADA puede que todavia no exista — y un canal que no
     * existe hace que Android use el de por defecto, que es mudo. Por eso se
     * asegura aca tambien.
     *
     * Crear un canal que ya existe no hace nada: Android lo ignora y respeta lo
     * que la persona haya configurado. No hay riesgo de pisar sus ajustes.
     */
    private void asegurarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;

        NotificationChannel canal = new NotificationChannel(
                CANAL, "Llamadas", NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription("Cuando alguien del equipo te llama");
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        canal.enableVibration(true);
        canal.setVibrationPattern(new long[]{0, 700, 400, 700, 400, 700});

        Uri timbre = Uri.parse("android.resource://" + getPackageName() + "/raw/ringtone");
        canal.setSound(timbre, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());

        nm.createNotificationChannel(canal);
    }
}
