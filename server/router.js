import fs from 'fs'
import path from 'path'

const isDevelopment = process.env.NODE_ENV !== 'production'
const pagesDir = path.resolve('./pages')
const pageTemplatePath = path.resolve('./index.html')

export function handleRequest(req, res) {
  const urlPath = req.url

  // Check if the request is for a static file
  if (urlPath.startsWith('/public') || urlPath.endsWith('.js')) {
    return serveStaticFile(req, res)
  }

  if (isDevelopment) handleDevelopmentRequest(req, res)
}

function serveStaticFile(req, res) {
  const filePath = path.resolve('.' + req.url)
  const extname = String(path.extname(filePath)).toLowerCase()
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
  }

  const contentType = mimeTypes[extname] || 'application/octet-stream'

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' })
        res.end('<h1>404 Not Found</h1>', 'utf-8')
      } else {
        res.writeHead(500)
        res.end(`Server Error: ${error.code}`, 'utf-8')
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content, 'utf-8')
    }
  })
}

function handleDevelopmentRequest(req, res) {
  fs.readFile(pageTemplatePath, 'utf-8', (err, templateData) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' })
      res.end('<h1>500 Internal Server Error</h1>')
      return
    }

    fs.readFile(path.resolve('./index.html'), 'utf-8', (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html' })
        res.end('<h1>404 Not Found</h1>')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(templateData)
    })
  })
}

function matchDevelopmentRoute(urlPath) {
  const segments = urlPath.split('/').filter((segment) => segment)
  let currentDir = pagesDir
  let matchedPath = ''

  for (const segment of segments) {
    const possiblePaths = fs.readdirSync(currentDir)
    let matched = false

    for (const possiblePath of possiblePaths) {
      const isDir = fs
        .lstatSync(path.join(currentDir, possiblePath))
        .isDirectory()
      const name = isDir ? possiblePath : possiblePath.replace(/\.html$/, '')

      if (name === segment || name.startsWith('[')) {
        matched = true
        matchedPath = path.join(matchedPath, possiblePath)
        currentDir = path.join(currentDir, possiblePath)
        break
      }
    }

    if (!matched) return null
  }

  const finalPath = path.join(pagesDir, matchedPath)

  return fs.existsSync(finalPath) ? finalPath : `${finalPath}.html`
}
