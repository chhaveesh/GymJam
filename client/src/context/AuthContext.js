import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user on first render if token exists - temporarily disabled
  useEffect(() => {
    // Temporarily commented out to prevent API calls
    // Since we're focusing only on the frontend for now
    setIsLoading(false);
    
    // const loadUser = async () => {
    //   const token = localStorage.getItem('token');
    //   
    //   if (!token) {
    //     setIsLoading(false);
    //     return;
    //   }
    //   
    //   // Set default headers for all axios requests
    //   axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    //   
    //   try {
    //     const res = await axios.get('/api/auth/me');
    //     
    //     if (res.data.success) {
    //       setUser(res.data.data);
    //       setIsAuthenticated(true);
    //     } else {
    //       localStorage.removeItem('token');
    //       setUser(null);
    //       setIsAuthenticated(false);
    //     }
    //   } catch (err) {
    //     localStorage.removeItem('token');
    //     setUser(null);
    //     setIsAuthenticated(false);
    //     setError('Session expired. Please log in again.');
    //   }
    //   
    //   setIsLoading(false);
    // };
    // 
    // loadUser();
  }, []);

  // Register user
  const register = async (formData) => {
    try {
      // For demo purposes, return success without making API call
      console.log('Register called with:', formData);
      return { success: true };
      
      // Actual implementation would look like this:
      // setIsLoading(true);
      // setError(null);
      // 
      // const res = await axios.post('/api/auth/signup', formData);
      // 
      // if (res.data.success) {
      //   localStorage.setItem('token', res.data.data.token);
      //   axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.token}`;
      //   
      //   setUser(res.data.data);
      //   setIsAuthenticated(true);
      // }
      // 
      // setIsLoading(false);
      // return { success: true };
    } catch (err) {
      setIsLoading(false);
      setError('Registration failed. Please try again.');
      return { success: false, error: 'Registration failed' };
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      // For demo purposes, return success without making API call
      console.log('Login called with:', email, password);
      return { success: true };
      
      // Actual implementation would look like this:
      // setIsLoading(true);
      // setError(null);
      // 
      // const res = await axios.post('/api/auth/login', { email, password });
      // 
      // if (res.data.success) {
      //   localStorage.setItem('token', res.data.data.token);
      //   axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.token}`;
      //   
      //   setUser(res.data.data);
      //   setIsAuthenticated(true);
      // }
      // 
      // setIsLoading(false);
      // return { success: true };
    } catch (err) {
      setIsLoading(false);
      setError('Invalid credentials');
      return { success: false, error: 'Login failed' };
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  // Update user profile
  const updateProfile = async (formData) => {
    try {
      // For demo purposes, return success without making API call
      console.log('Update profile called with:', formData);
      return { success: true };
      
      // Actual implementation would look like this:
      // setIsLoading(true);
      // setError(null);
      // 
      // const res = await axios.put('/api/auth/me', formData);
      // 
      // if (res.data.success) {
      //   setUser({
      //     ...user,
      //     ...res.data.data,
      //   });
      // }
      // 
      // setIsLoading(false);
      // return { success: true };
    } catch (err) {
      setIsLoading(false);
      setError('Update failed. Please try again.');
      return { success: false, error: 'Update failed' };
    }
  };

  // Clear any errors
  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    register,
    login,
    logout,
    updateProfile,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 