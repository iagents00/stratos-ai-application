# Acabado de capturas: marco translúcido sobre blanco

Refinamiento solicitado por el usuario el 16 de octubre de 2026. Se conservan las capturas reales de Stratos con datos de demostración y se componen como imágenes terminadas con un anillo de cristal translúcido, bordes redondeados y sombra suave sobre blanco.

## Revisión independiente

Disposición: **ship**. Revisión con contexto nuevo mediante un subagente general que aplicó el protocolo de acabado Impeccable; el harness no selecciona un tipo de revisor especializado. Alcance acotado a este refinamiento, conservando la landing aprobada.

Se inspeccionaron las tres galerías de escritorio 1440 px, móvil 390 px y móvil 320 px, y los seis recortes de sus consumidores workflow/benefits. Las capturas de estos consumidores se corrigieron para evitar la superposición del header durante la toma; no se cambió la implementación por ese artefacto de captura.

El revisor confirmó que el marco es íntegro, discreto y consistente, con proporción preservada y fondo RGB (255,255,255). Comprobó hashes de la receta y los seis activos de 1440 × 1020. Los interiores RGB coinciden exactamente con los PNG originales, excluyendo 16 px del borde redondeado. No hubo hallazgos materiales.

## Validación

- 195 pruebas Node aprobadas; builds web/app y lint dirigido/runtime aprobados.
- Seis imágenes cargadas en 1440/390/320, sin overflow ni recortes; controles, rotación de 2.8 segundos, teclado y movimiento reducido conservados.
- Recursos de marketing excluidos del paquete móvil. Árbol completo de fuente y activos verificado antes del commit.
- Procedencia, hashes y límites de demostración en `public/marketing/modules/framed-20261016/README.md` y su manifiesto.
- Detector ejecutado una vez: cero errores. Dos warnings de fuente comparan contra el sistema global de Rails; marketing tiene su propio DESIGN.md. El tercero corresponde al src dinámico de la receta local, cuya carga se verificó con los seis originales. Los avisos de material/escala respetan el acabado expresamente pedido.

Conservar la interfaz real, el fondo blanco, el marco fino y el comportamiento de la landing. La documentación de marketing se actualizó sin reemplazar el sistema de Rails.
