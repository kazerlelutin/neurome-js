import fs from 'fs'
import path from 'path'

export function loadEnv() {
  const envPath = path.resolve('.env')
  const env = {}

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach((line) => {
      const [key, value] = line.split('=')
      if (key && value) {
        env[key.trim()] = value.trim()
      }
    })
  }

  return env
}

