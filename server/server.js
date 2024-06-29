import http from 'http'
import path from 'path'
import fs from 'fs'
import { createWebSocketServer } from './websocket.js'
import { handleRequest } from './router.js'
import { generateBuild } from '../dist/index.js'

const PORT = 3030

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/public')) {
    const filePath = '.' + req.url
    const extname = String(path.extname(filePath)).toLowerCase()
    const contentType = getContentType(extname)

    getFile(filePath, (content, statusCode = 200) => {
      res.writeHead(statusCode, { 'Content-Type': contentType })
      res.end(content, 'utf-8')
    })
  } else if (req.url.includes('/neurome-js')) {
    // Serve dynamically generated files from dist directory
    const filePath = path.join('.', req.url)
    const extname = String(path.extname(filePath)).toLowerCase()
    const contentType = getContentType(extname)

    getFile(filePath, (content, statusCode = 200) => {
      res.writeHead(statusCode, { 'Content-Type': contentType })
      res.end(content, 'utf-8')
    })
  } else {
    handleRequest(req, res)
  }
})

createWebSocketServer(server)

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  generateBuild() // Generate build files on server start
})

function getContentType(extname) {
  const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
  }
  return MIME_TYPES[extname.toLowerCase()] || 'application/octet-stream'
}

function getFile(filePath, callback) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        callback('404 Not Found', 404)
      } else {
        callback('500 Internal Server Error', 500)
      }
    } else {
      callback(data)
    }
  })
}
