import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: any;
  lastActive?: any;
  searchCount?: number;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user data from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              setUser({
                id: firebaseUser.uid,
                ...userData
              });
              setFirebaseUser(firebaseUser);
            } else {
              setUser({
                id: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firebaseUser.email || '',
                role: 'user',
                createdAt: new Date(),
                lastActive: new Date()
              });
              setFirebaseUser(firebaseUser);
            }
          } catch (firestoreErr) {
            console.warn('Firestore permissions/fetch error, falling back to auth session:', firestoreErr);
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'user',
              createdAt: new Date(),
              lastActive: new Date()
            });
            setFirebaseUser(firebaseUser);
          }
        } else {
          setUser(null);
          setFirebaseUser(null);
        }
      } catch (err) {
        console.error('Error during onAuthStateChanged:', err);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      let userData: User | null = null;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          userData = userDoc.data() as User;
          if (userData.role && userData.role !== role) {
            await signOut(auth);
            throw new Error('Access denied for this portal');
          }
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            ...userData,
            lastActive: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      } catch (docErr: any) {
        if (docErr.message === 'Access denied for this portal') throw docErr;
        console.warn('Could not read user profile from Firestore:', docErr);
      }

      const activeUser: User = userData || {
        id: userCredential.user.uid,
        name: userCredential.user.displayName || email.split('@')[0],
        email: email,
        role: role,
        createdAt: new Date(),
        lastActive: new Date()
      };

      setUser(activeUser);
      setFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const signup = async (email: string, password: string, name: string, role: UserRole = 'user') => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        name,
        email,
        role,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        searchCount: 0
      };

      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      } catch (firestoreErr) {
        console.warn('Could not save user profile to Firestore (check rules):', firestoreErr);
      }
      
      setUser(newUser);
      setFirebaseUser(userCredential.user);
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser,
      login, 
      signup,
      logout, 
      isAuthenticated: !!user,
      loading 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};