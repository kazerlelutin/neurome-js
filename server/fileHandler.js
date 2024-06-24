import fs from 'fs'

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

export function getFile(filePath, callback) {
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

export function getContentType(extname) {
  return MIME_TYPES[extname.toLowerCase()] || 'application/octet-stream'
}
