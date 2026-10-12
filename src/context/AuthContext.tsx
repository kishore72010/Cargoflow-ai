import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthUser, AuthRole } from "../types";

export type AuthState =
  | "AUTHENTICATING"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "ACCESS_DENIED";

interface AuthContextType {
  user: AuthUser | null;
  authState: AuthState;
  errorMessage: string | null;
  accessDeniedMessage: string | null;
  login: (email: string, password: string, expectedRole?: AuthRole) => Promise<boolean>;
  register: (payload: any) => Promise<{ success: boolean; message: string; customerId?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<AuthUser | null>;
  clearError: () => void;
  clearAccessDenied: () => void;
  setAccessDenied: (msg: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>("AUTHENTICATING");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  // Check current session from /api/auth/me using credentials: "include" (HttpOnly cookie)
  const checkAuth = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setAuthState("AUTHENTICATED");
          setErrorMessage(null);
          return data.user;
        }
      }

      // If 401 and session expired
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.sessionExpired) {
          setAuthState("SESSION_EXPIRED");
        } else {
          setAuthState("UNAUTHENTICATED");
        }
      } else {
        setAuthState("UNAUTHENTICATED");
      }

      setUser(null);
      return null;
    } catch (err: any) {
      console.warn("[CargoFlow Auth] Session verification error:", err.message);
      setAuthState("UNAUTHENTICATED");
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // LOGIN
  const login = async (email: string, password: string, expectedRole?: AuthRole): Promise<boolean> => {
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, expectedRole }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
        setAuthState("AUTHENTICATED");
        setErrorMessage(null);
        setAccessDeniedMessage(null);
        return true;
      } else {
        setErrorMessage(data.error || "Invalid email or password.");
        return false;
      }
    } catch (err: any) {
      setErrorMessage("Network error: Unable to contact authentication server.");
      return false;
    }
  };

  // REGISTER
  const register = async (payload: any): Promise<{ success: boolean; message: string; customerId?: string }> => {
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message || "ACCOUNT CREATED SUCCESSFULLY", customerId: data.customerId };
      } else {
        return { success: false, message: data.error || "Registration failed. Please check your inputs." };
      }
    } catch (err: any) {
      return { success: false, message: "Network error during registration." };
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      setUser(null);
      setAuthState("UNAUTHENTICATED");
      setErrorMessage(null);
      setAccessDeniedMessage(null);
    }
  };

  const clearError = () => setErrorMessage(null);
  const clearAccessDenied = () => setAccessDeniedMessage(null);
  const setAccessDenied = (msg: string) => {
    setAccessDeniedMessage(msg);
    setAuthState("ACCESS_DENIED");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authState,
        errorMessage,
        accessDeniedMessage,
        login,
        register,
        logout,
        checkAuth,
        clearError,
        clearAccessDenied,
        setAccessDenied,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
