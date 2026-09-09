const EMAIL = 'revision.apple@stratosdemo.mx'
const PASSWORD = 'AuroraDemo2026'
const ORGANIZATION_ID = 'deded000-0000-4000-a000-000000000001'
const SESSION_KEY = 'stratos_demo'
const SESSION_VALUE = 'apple-review'

const USER = {
  // Conserva el id local de demo: los guardas de escritura existentes lo
  // reconocen y evitan que una revisión toque datos de clientes.
  id:             'demo-user-local',
  name:           'Apple Review',
  email:          EMAIL,
  role:           'admin',
  phone:          null,
  organizationId: ORGANIZATION_ID,
  isDemo:         true,
}

export function getAppReviewLogin(email, password) {
  if (email !== EMAIL || password !== PASSWORD) return null
  sessionStorage.setItem(SESSION_KEY, SESSION_VALUE)
  return USER
}

export function readAppReviewSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE ? USER : null
  } catch {
    return null
  }
}
