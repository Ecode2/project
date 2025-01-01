"use client"
import {useContext} from 'react';
import {AuthContext} from '@/components/auth/AuthContext';


export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  };

export const useUser = () => {
    return useContext(AuthContext)?.user
}

export const useLogin = () => {
    return useContext(AuthContext)?.login
}
export const useLogout = () => {
    return useContext(AuthContext)?.logout
}
export const useSignUp = () => {
    return useContext(AuthContext)?.register
}