import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

export function createWebSocketServer(server) {
  const clients = new Set()
  const ignoredPaths = getIgnoredPaths()

  server.on('upgrade', (req, socket) => {
    if (req.url !== '/ws') {
      socket.destroy()
      return
    }

    const acceptKey = req.headers['sec-websocket-key']
    const hash = generateAcceptValue(acceptKey)

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${hash}`,
    ]

    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n')

    clients.add(socket)

    socket.on('data', (buffer) => {
      console.log('Received data:', buffer.toString())
    })

    socket.on('end', () => clients.delete(socket))

    socket.on('error', (err) => {
      console.error('Socket error:', err)
      clients.delete(socket)
    })

    socket.on('close', () => clients.delete(socket))

    setInterval(() => {
      if (clients.has(socket)) socket.write('ping')
    }, 30000)
  })

  watchDirectory('.', clients, ignoredPaths)
}

function watchDirectory(directory, clients, ignoredPaths) {
  fs.watch(directory, { recursive: true }, (_eventType, filename) => {
    if (filename && !isIgnored(filename, ignoredPaths)) {
      console.log(`File changed: ${filename}`)
      clients.forEach((client) => {
        const message = createWebSocketFrame('reload')
        client.write(message)
      })
    }
  })
}

function isIgnored(filename, ignoredPaths) {
  return ignoredPaths.some((ignoredPath) => filename.includes(ignoredPath))
}

function getIgnoredPaths() {
  const ignoreFilePath = path.resolve('.watchignore')
  if (fs.existsSync(ignoreFilePath)) {
    const ignoredPaths = fs
      .readFileSync(ignoreFilePath, 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
    return ignoredPaths
  }
  return []
}

function generateAcceptValue(acceptKey) {
  return crypto
    .createHash('sha1')
    .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64')
}

function createWebSocketFrame(data) {
  const jsonData = JSON.stringify(data)
  const length = Buffer.byteLength(jsonData)
  const buffer = Buffer.alloc(2 + length)

  buffer[0] = 0x81
  buffer[1] = length

  buffer.write(jsonData, 2)
  return buffer
}
