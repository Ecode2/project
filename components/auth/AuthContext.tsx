"use client";
import { createContext, useState,  ReactNode } from 'react';
import { login as apiLogin, register as apiRegister, userInfo } from '@/lib/api';
import { UserInfo, LoginInfo, RegisterInfo } from '@/lib/definitions';

export const AuthContext = createContext<{ user: UserInfo | null, login: (email: string, password: string) => Promise<void>, register: (username: string, email: string, password: string) => Promise<void>, logout: () => void } | undefined>(undefined);

const AuthProvider = ({children}:{ children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);

  const login = async (email:string, password:string) => {

    const request: LoginInfo = {email, password}

    const data = await apiLogin(request);

    if (data.status) {
      const user = await userInfo();

      if (user.status && typeof user.message !== 'string') {
        setUser(user.message);
      }
    }
  };

  const register = async (username:string, email:string, password:string) => {

    const request: RegisterInfo = {username, email, password}

    const data = await apiRegister(request);

    if (data.status) {
      const user = await userInfo();

      if (user.status && typeof user.message !== 'string') {
        setUser(user.message);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};


export default AuthProvider;

