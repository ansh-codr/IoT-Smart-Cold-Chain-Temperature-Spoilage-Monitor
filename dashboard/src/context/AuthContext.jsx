import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../config/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync token and resolve role from backend
  const refreshProfile = async (firebaseUser) => {
    try {
      let headers = { 'Content-Type': 'application/json' };
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Fallback simulated session for immediate zero-config dev
        headers['x-dev-email'] = 'admin@coldchainiq.com';
        headers['x-dev-name'] = 'Platform Administrator';
      }

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (e) {
      console.warn('Backend identity resolution warning:', e.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await refreshProfile(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

