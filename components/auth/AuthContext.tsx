"use client";
import { createContext, useState,  ReactNode, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, checkToken, userInfo } from '@/lib/api';
import { UserInfo, LoginInfo, RegisterInfo } from '@/lib/definitions';
import {AuthContextType} from "@/lib/definitions"

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({children}:{ children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  

  const login = async (email:string, password:string) => {

    const request: LoginInfo = {email, password}

    const data = await apiLogin(request);

    if (data.status) {
      const user = await userInfo();

      if (user.status && typeof user.message !== 'string') {
        setUser(user.message);
        setIsAuthenticated(true);
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
        setIsAuthenticated(true);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const handleTokenRefresh = async () => {

      const response = await checkToken()

      if (response.status){
        const user = await userInfo();

        if (user.status && typeof user.message !== 'string') {
          setUser(user.message);
          setIsAuthenticated(true);
          return
        }

      }

      setIsAuthenticated(false)
      setUser(null)
    }
    handleTokenRefresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};


export default AuthProvider;

