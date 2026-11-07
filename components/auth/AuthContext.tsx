"use client";
import { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, checkToken, userInfo } from '@/lib/api';
import { UserInfo } from '@/lib/definitions';
import { AuthContextType } from "@/lib/definitions";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // True until the silent session restore on load has finished. Without it the
  // first paint is indistinguishable from "signed out", so pages flashed a
  // sign-in prompt at readers who were in fact logged in.
  const [loading, setLoading] = useState<boolean>(true);

  const loadUser = useCallback(async (): Promise<boolean> => {
    const info = await userInfo();
    if (info.status && typeof info.message !== 'string') {
      setUser(info.message);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  // Login and registration THROW on failure with a message the form can show.
  // They used to resolve quietly, so the form navigated away as if signed in.
  const login = async (email: string, password: string) => {
    const data = await apiLogin({ email, password });
    if (!data.status) throw new Error(String(data.message));
    if (!(await loadUser())) throw new Error("Signed in, but your profile could not be loaded. Please try again.");
  };

  const register = async (username: string, email: string, password: string) => {
    const data = await apiRegister({ username, email, password });
    if (!data.status) throw new Error(String(data.message));
    if (!(await loadUser())) throw new Error("Account created, but sign-in failed. Please sign in.");
  };

  const logout = () => {
    apiLogout().finally(() => {
      setUser(null);
      setIsAuthenticated(false);
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await checkToken();
      if (response.status) await loadUser();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
