import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { AuthUser, UserRole } from "./types.js";
import { getDb } from "./db.js";
import { ObjectId } from "mongodb";

export const COOKIE_NAME = "cargoflow_token";

const JWT_SECRET = process.env.JWT_SECRET || "cargoflow_jwt_secret_dev_2026_do_not_use_in_prod";
const JWT_EXPIRES_IN = "7d";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️ [SECURITY WARNING] JWT_SECRET is not set in environment variables! Using default development secret.");
}

/**
 * Sign JWT token for authenticated user
 */
export function generateToken(user: AuthUser): string {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    isActive: user.isActive,
    driverId: user.driverId,
    assignedVehicleId: user.assignedVehicleId,
    customerId: user.customerId,
    address: user.address,
    adminId: user.adminId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id || !decoded.role) return null;
    return {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role as UserRole,
      phone: decoded.phone,
      isActive: decoded.isActive ?? true,
      driverId: decoded.driverId,
      assignedVehicleId: decoded.assignedVehicleId,
      customerId: decoded.customerId,
      address: decoded.address,
      adminId: decoded.adminId,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Attach HttpOnly authentication cookie
 */
export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
}

// Extend Express Request interface to hold authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware: Extracts JWT from cookie or Authorization header and verifies user in database.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined = req.cookies?.[COOKIE_NAME];

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        authenticated: false,
        error: "Authentication required. Please log in to access this resource.",
      });
    }

    const payload = verifyToken(token);
    if (!payload) {
      clearAuthCookie(res);
      return res.status(401).json({
        authenticated: false,
        sessionExpired: true,
        error: "Session expired or invalid token. Please log in again.",
      });
    }

    // Verify user in MongoDB to ensure account is active and not disabled
    const db = await getDb();
    let userRecord = null;

    if (ObjectId.isValid(payload.id)) {
      userRecord = await db.collection("users").findOne({ _id: new ObjectId(payload.id) });
    }
    if (!userRecord) {
      userRecord = await db.collection("users").findOne({ email: payload.email.toLowerCase() });
    }

    if (!userRecord) {
      clearAuthCookie(res);
      return res.status(401).json({
        authenticated: false,
        error: "Account not found or has been revoked.",
      });
    }

    if (userRecord.isActive === false) {
      clearAuthCookie(res);
      return res.status(403).json({
        authenticated: false,
        accountDisabled: true,
        error: "Account is disabled. Please contact fleet dispatch administration.",
      });
    }

    // Attach fresh user info from DB
    req.user = {
      id: userRecord._id.toString(),
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role as UserRole,
      phone: userRecord.phone || "",
      isActive: userRecord.isActive ?? true,
      driverId: userRecord.driverId,
      assignedVehicleId: userRecord.assignedVehicleId,
      customerId: userRecord.customerId,
      address: userRecord.address,
      adminId: userRecord.adminId,
    };

    next();
  } catch (err: any) {
    return res.status(500).json({ error: "Authentication verification failed: " + err.message });
  }
}

/**
 * Middleware: Enforces that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        authenticated: false,
        error: "Authentication required. Please log in.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        authenticated: true,
        accessDenied: true,
        error: `ACCESS DENIED: Insufficient permissions. Role '${req.user.role}' is not authorized for this operation. Required: ${allowedRoles.join(" | ")}`,
      });
    }

    next();
  };
}
