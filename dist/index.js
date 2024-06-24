import fs from 'fs'
import path from 'path'
import {loadEnv} from '../utils/loadEnv.js' // Assurez-vous que ce fichier est au bon endroit

const env = loadEnv()

const pagesDir = path.resolve('./pages')
const distDir = path.resolve('./dist')
const routesFile = path.join(distDir, 'routes.js')
const versionFile = path.join(distDir, 'version.js')
const envFile = path.join(distDir, 'env.js')
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))

export function generateBuild() {
  createDistDir()
  generateRoutes()
  generateVersion()
  generateEnv()
}

function createDistDir() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }
}

function generateRoutes() {
  const pages = getPages(pagesDir)
  const routes = pages.map((page) => {
    const routePath = page
      .replace(pagesDir, '')
      .replace(/\\/g, '/')
      .replace(/\.html$/, '')
      .replace(/\[(\w+)\]/g, ':$1')
    return { path: routePath, component: `.${page}` }
  })

  const routesContent = `export const routes = ${JSON.stringify(
    routes,
    null,
    2
  )};`
  fs.writeFileSync(routesFile, routesContent, 'utf-8')
  console.log('Routes file generated at', routesFile)
}

function generateVersion() {
  const versionContent = `export const version = '${pkg.version}';`
  fs.writeFileSync(versionFile, versionContent, 'utf-8')
  console.log('Version file generated at', versionFile)
}

function generateEnv() {
  const envContent = Object.entries(env)
    .filter(([key]) => key.startsWith('NEUROME_'))
    .map(([key, value]) => {
      let val = value
      if (typeof val === 'string') {
        val = JSON.stringify(val) // Ajouter des guillemets autour des valeurs string
      }
      return `${key.replace('NEUROME_', '')}: ${val}`
    })
    .join(',\n')

  fs.writeFileSync(envFile, `export const env = { ${envContent} };`, 'utf-8')
  console.log('Env file generated at', envFile)
}

function getPages(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const pages = []

  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      pages.push(
        ...getPages(path.join(dir, entry.name), path.join(basePath, entry.name))
      )
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      pages.push(path.join(basePath, entry.name))
    }
  })

  return pages
}
