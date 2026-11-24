// Started by Firebase emulators:exec after both disposable services are ready.
import { randomBytes } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile, rm, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const project = 'demo-renewal-reviewer'
const authHost = '127.0.0.1:9199'
if (process.env.GCLOUD_PROJECT !== project || process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8185' || process.env.K_SERVICE) {
  throw new Error('Start this profile with pnpm dev:reviewer.')
}

const directory = '.local-reviewer'
const file = join(directory, 'credentials.json')
await mkdir(directory, { recursive: true, mode: 0o700 })
const email = 'reviewer@example.test'
try {
  await writeFile(file, JSON.stringify({ email, password: randomBytes(24).toString('base64url') }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
const info = await lstat(file)
if (!info.isFile() || (process.platform !== 'win32' && (info.mode & 0o077))) throw new Error('Restrict credentials.json to the current user.')
const credentials = JSON.parse(await readFile(file, 'utf8'))
if (credentials.email !== email || typeof credentials.password !== 'string' || credentials.password.length < 24) throw new Error('Invalid local credential file.')
const seeded = await fetch('http://' + authHost + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-reviewer', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ ...credentials, localId: 'workbench-reviewer' }),
})
if (!seeded.ok || (await seeded.json()).localId !== 'workbench-reviewer') throw new Error('Could not provision the dedicated emulator reviewer.')

const scratch = await mkdtemp(join(tmpdir(), 'renewal-reviewer-'))
const executable = join(scratch, process.platform === 'win32' ? 'api.exe' : 'api')
const children = []
let stopping = false
function stop() {
  stopping = true
  for (const child of children) child.kill('SIGTERM')
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop)
try {
  execFileSync('go', ['build', '-o', executable, './cmd/api'], { cwd: 'backend/api', stdio: 'inherit' })
  children.push(spawn(executable, [], {
    env: { ...process.env, WORKBENCH_LOCAL_AUTH: '1', GOOGLE_CLOUD_PROJECT: project, FIRESTORE_DATABASE: '(default)', SENTRY_DSN: '' }, stdio: 'inherit',
  }))
  // Next updates its generated type includes on startup. Isolate those from the public build.
  await writeFile('frontend/web/tsconfig.reviewer.json', await readFile('frontend/web/tsconfig.json'))
  children.push(spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'], {
    cwd: 'frontend/web', env: { ...process.env, NEXT_PUBLIC_LOCAL_REVIEWER: '1', SENTRY_AUTH_TOKEN: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit',
  }))
  console.log('Local reviewer dashboard: http://127.0.0.1:3100 · Credentials: ' + file)
  const exits = children.map(child => new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  }))
  const first = await Promise.race(exits)
  if (!stopping) throw new Error('A reviewer service stopped (' + (first.code ?? first.signal) + ').')
  stop()
  await Promise.race([Promise.allSettled(exits), delay(3500)])
} finally {
  stop()
  await rm(scratch, { recursive: true, force: true })
}
