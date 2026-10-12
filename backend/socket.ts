import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";

let ioInstance: SocketIOServer | null = null;

export function initSocket(server: http.Server): SocketIOServer {
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  ioInstance.on("connection", (socket: Socket) => {
    // Client connected
    socket.emit("connected", {
      status: "online",
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.on("join:truck", (truckId: string) => {
      socket.join(`truck:${truckId}`);
    });

    socket.on("join:order", (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("disconnect", () => {
      // Clean disconnect
    });
  });

  return ioInstance;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastTruckLocation(data: {
  truckId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  trackingMode: "LIVE" | "SIMULATED";
  trackingActive: boolean;
  timestamp: string | Date;
}) {
  if (!ioInstance) return;
  ioInstance.emit("truck:location", data);
  ioInstance.to(`truck:${data.truckId}`).emit("truck:location:self", data);
}

export function broadcastFleetUpdate(data: {
  type: "OPTIMIZATION" | "BATON_PASS" | "TRAFFIC_SIMULATION" | "ORDER_CREATED" | "DELIVERY_CONFIRMED" | "RESET";
  payload?: any;
  timestamp: string;
}) {
  if (!ioInstance) return;
  ioInstance.emit("fleet:update", data);
}

export function broadcastOrderStatus(data: {
  orderId: string;
  deliveryId: string;
  status: string;
  assignedTruckId: string;
  estimatedArrival?: string;
  otpVerified?: boolean;
  timestamp: string;
}) {
  if (!ioInstance) return;
  ioInstance.emit("order:status", data);
  ioInstance.to(`order:${data.orderId}`).emit("order:status:self", data);
}

export function broadcastNotification(notif: any) {
  if (!ioInstance) return;
  ioInstance.emit("notification:new", notif);
}
