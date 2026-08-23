import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { rmSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Dos modos de build:
 *
 *   npm run build       → la web completa (Vercel). Todo incluido.
 *   npm run build:app   → SOLO la app. Es lo que empaqueta el binario iOS/Android.
 *
 * POR QUÉ EL MODO `app`
 * El binario empaqueta el bundle, y sin esto se llevaría adentro la landing de
 * marketing, la política de privacidad y los siete manuales de cliente: ~365 kB
 * que la app NUNCA abre, porque en nativo `isApp` siempre es true.
 *
 * Y pesa más que el peso: Apple revisa el contenido del paquete. Encontrar un
 * sitio de marketing completo ahí adentro refuerza justo la lectura que hay que
 * evitar — que la app es una web enlatada (Guideline 4.2).
 *
 * Se hace interceptando la resolución del módulo, no con una bandera dentro del
 * código: así Rollup nunca llega a leer esos archivos y no genera sus chunks.
 * Una condición en tiempo de ejecución los habría dejado igual dentro del bundle.
 */
const SOLO_WEB = new Set([
  './landing/LandingMarketing.jsx',
  './landing/PrivacyPolicy.jsx',
  './landing/DataDeletion.jsx',
  './landing/DeliveryHubCRM.jsx',
  './landing/ManualCRM.jsx',
  './landing/ManualMarketing.jsx',
  './landing/ManualNSG.jsx',
  './landing/ManualLegacy.jsx',
  './landing/ManualBrasa.jsx',
  './landing/ManualGasil.jsx',
  './landing/ManualMuebleria.jsx',
  './landing/Diagnostico.jsx',
  './landing/DukeLeadRouter.jsx',
  './app/views/LandingPages/PublicLanding.jsx',
  // PricingScreen muestra precios de suscripción y un botón de Apple Pay que
  // NO cobra (simula con setTimeout). El módulo "Planes" ya está oculto en la
  // app, pero su CÓDIGO seguía viajando dentro del binario: un revisor que
  // inspeccione el paquete encuentra "Apple Pay" ahí adentro. Apple exige
  // In-App Purchase para bienes digitales; una pasarela falsa es peor que no
  // tener ninguna. Los planes se contratan por la web.
  // Con '../' porque quien la importa es App.jsx, que vive en src/app/. El hook
  // compara la cadena tal como está escrita en el import, no la ruta resuelta.
  '../landing/PricingScreen.jsx',
])

/**
 * Archivos de public/ que solo sirven al sitio web. Vite copia public/ tal cual,
 * así que los chunks excluidos no alcanzan: hay que sacarlos del resultado.
 *
 * Verificado uno por uno antes de listarlos: duke/ y entregables/ solo los
 * referencian DukeLeadRouter, ManualNSG y DeliveryHubCRM — las tres páginas ya
 * excluidas. Los manuales en PDF no los referencia nadie en src/. Las og-*.png
 * son imágenes de vista previa para redes, que la app nunca pide.
 */
const ESTATICOS_SOLO_WEB = [
  'duke',
  'entregables',
  'Manual-Stratos-IA-NSG.pdf',
  'Manual-Stratos-IA-NSG.doc',
  'og-stratos.png',
  'og-portafolio.png',
]

/** Cambia esos imports por un stub minúsculo antes de que Rollup los lea. */
function sacarElSitioWeb(stub) {
  const fuera = []
  return {
    name: 'stratos-solo-app',
    enforce: 'pre',
    resolveId(source) {
      if (SOLO_WEB.has(source)) {
        fuera.push(source)
        return stub
      }
      return null
    },
    buildEnd() {
      // Si mañana alguien renombra una página, este número baja y se nota.
      // Si este número deja de ser n/n, alguien renombró o movió una página y
      // su código volvió a colarse en el binario sin que nadie se entere.
      const faltan = [...SOLO_WEB].filter(x => !fuera.includes(x))
      this.info(`[solo-app] ${fuera.length}/${SOLO_WEB.size} páginas públicas excluidas del binario`)
      if (faltan.length) this.warn(`[solo-app] NO se excluyeron (¿se renombraron?): ${faltan.join(', ')}`)
    },
    closeBundle() {
      let liberado = 0
      for (const nombre of ESTATICOS_SOLO_WEB) {
        const ruta = join(process.cwd(), 'dist-app', nombre)
        if (!existsSync(ruta)) continue
        liberado += pesar(ruta)
        rmSync(ruta, { recursive: true, force: true })
      }
      this.info(`[solo-app] ${(liberado / 1024 / 1024).toFixed(1)} MB de estáticos del sitio fuera del binario`)
    },
  }
}

/** Peso de un archivo o carpeta, en bytes. */
function pesar(ruta) {
  const st = statSync(ruta)
  if (!st.isDirectory()) return st.size
  let total = 0
  for (const hijo of readdirSync(ruta)) total += pesar(join(ruta, hijo))
  return total
}

export default defineConfig(({ mode }) => {
  const soloApp = mode === 'app'
  const stub = fileURLToPath(new URL('./src/pagina-solo-web.jsx', import.meta.url))

  return {
    plugins: [react(), ...(soloApp ? [sacarElSitioWeb(stub)] : [])],
    build: { outDir: soloApp ? 'dist-app' : 'dist' },
  }
})
