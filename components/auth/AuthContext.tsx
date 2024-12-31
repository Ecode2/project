import { createContext, useState } from 'react';
import PropTypes from 'prop-types';
import { login as apiLogin, register as apiRegister } from '@/lib/api';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    if (data.token) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }
  };

  const register = async (username, email, password) => {
    const data = await apiRegister(username, email, password);
    if (data.token) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthProvider;

