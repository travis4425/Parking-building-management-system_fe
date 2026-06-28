// Socket.IO client dùng chung — nghe các event realtime từ BE (payment:success,
// alert:overtime...). Trước đây socket.io-client có trong package.json nhưng
// chưa được import/dùng ở đâu trong src/ — file này khởi tạo singleton connection.
import { io, type Socket } from 'socket.io-client'

// BE phát socket trên cùng host với REST API, KHÔNG có tiền tố /api
// (xem src/config/socket.ts ở BE — initSocket(server) gắn trực tiếp vào http server).
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '')

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    })
  }
  return socket
}
