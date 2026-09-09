import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'dist-app')

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const bundle = filesUnder(outputDir)
  .filter((path) => /\.(?:html|js|css)$/i.test(path))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

const forbidden = [
  'Solicitar acceso',
  'Crear cuenta',
  'register=true',
  'Planes y Precios',
  'Apple Pay',
  'Para asesores individuales',
]

const required = [
  'revision.apple@stratosdemo.mx',
  'AuroraDemo2026',
  'deded000-0000-4000-a000-000000000001',
  'Usa la cuenta que te proporcionó tu empresa.',
]

const errors = []
for (const text of forbidden) {
  if (bundle.includes(text)) errors.push(`El binario todavía contiene la interfaz prohibida: ${text}`)
}
for (const text of required) {
  if (!bundle.includes(text)) errors.push(`Falta el acceso determinista de App Review: ${text}`)
}

const project = readFileSync(
  join(process.cwd(), 'mobile/ios/App/App.xcodeproj/project.pbxproj'),
  'utf8',
)
const families = [...project.matchAll(/TARGETED_DEVICE_FAMILY = "?([^";]+)"?;/g)].map((match) => match[1])
if (!families.length || families.some((family) => family !== '1')) {
  errors.push(`TARGETED_DEVICE_FAMILY debe ser 1 en todas las configuraciones; encontrado: ${families.join(', ') || 'ninguno'}`)
}

if (errors.length) {
  console.error(errors.map((error) => `✗ ${error}`).join('\n'))
  process.exit(1)
}

console.log('✓ Binario iOS sin alta, precios ni contratación')
console.log('✓ Acceso aislado de App Review incluido')
console.log('✓ Destino del proyecto limitado a iPhone')
