import fs from 'fs'
import path from 'path'
import { loadEnv } from '../utils/loadEnv.js' // Assurez-vous que ce fichier est au bon endroit
import { hashString } from '../utils/hash-string.js'
import styles from './styles.js'

const env = loadEnv()

const pagesDir = path.resolve('./pages')
const distDir = path.resolve('./dist')
const routesFile = path.join(distDir, 'routes.js')
const viewDir = path.resolve('./views')
const viewDistDir = path.join(distDir, 'views')
const routesDir = path.join(distDir, 'routes')
const versionFile = path.join(distDir, 'version.js')
const envFile = path.join(distDir, 'env.js')
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))

export async function generateBuild() {
  createDistDir()
  generateViews()
  generateRoutes()
  generateVersion()
  generateEnv()
  copyCss()
}

function createDistDir() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }
}

function generateViews() {
  if (!fs.existsSync(viewDistDir)) fs.mkdirSync(viewDistDir)

  const views = getPages(viewDir)
  views.map((view) => {
    const name = view.replace(viewDir, '').replace(/\.html$/, '')
    const content = fs.readFileSync(path.join(viewDir, view), 'utf-8')
    const contentFileName = name + '.js'
    const contentPath = path.join(viewDistDir, contentFileName)

    fs.writeFileSync(
      contentPath,
      'const view = ' + '`' + content + '`\nexport default view',
      'utf-8'
    )
  })

  console.log('views file generated')
}

function generateRoutes() {
  if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir)

  const pages = getPages(pagesDir)
  const routes = pages.map((page) => {
    const routePath = page
      .replace(pagesDir, '')
      .replace(/index\.html$/, '/')
      .replace(/\\/g, '/')
      .replace(/\.html$/, '')
      .replace(/\[(\w+)\]/g, ':$1')

    const name = page.replace(pagesDir, '').replace(/\.html$/, '')

    const content = fs.readFileSync(path.join(pagesDir, page), 'utf-8')

    const contentFileName = hashString(name) + '.js'
    const contentPath = path.join(routesDir, contentFileName)

    fs.writeFileSync(
      contentPath,
      'const page = ' + '`' + content + '`\nexport default page',
      'utf-8'
    )

    return {
      path: routePath.startsWith('/') ? routePath : '/' + routePath,
      component: `/dist/routes/${contentFileName}`,
    }
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

function copyCss() {
  console.log('styles', styles)
  fs.writeFileSync(path.join(distDir, 'styles.css'), styles, 'utf-8')
  console.log('CSS file generated at', path.join(distDir, 'styles.css'))
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
