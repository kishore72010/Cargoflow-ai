import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log("[CargoFlow Socket] Connected to real-time server with ID:", socketInstance?.id);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("[CargoFlow Socket] Real-time connection notice:", err.message);
    });
  }

  return socketInstance;
}
