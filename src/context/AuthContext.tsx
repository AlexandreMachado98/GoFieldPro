import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateProfileRoleLocally: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      setUser(currentUser);

      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);

        try {
          // Check if document exists, if not create default
          const docSnap = await getDoc(docRef);
          const isOwner = currentUser.email?.toLowerCase() === 'alexandre1604981@gmail.com';

          if (docSnap.exists()) {
            let data = docSnap.data() as UserProfile;
            if (isOwner && (data.role !== 'super_admin' || data.status !== 'active')) {
              data.role = 'super_admin';
              data.status = 'active';
              await setDoc(docRef, data, { merge: true });
            }
            setProfile(data);
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário de Campo',
              role: isOwner ? 'super_admin' : 'surveyor',
              status: isOwner ? 'active' : 'pending',
              avatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email || 'U')}&background=0284c7&color=fff`,
              createdAténew Date().toISOString(),
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }

          // Real-time listener for profile changes (instant approval when admin grants access)
          profileUnsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
              const updatedData = snapshot.data() as UserProfile;
              setProfile(updatedData);
            }
          }, (err) => {
            console.warn("Real-time profile listener notice:", err.message);
          });

        } catch (error: any) {
          console.warn("Fallback user profile initialized:", error.message);
          const isOwner = currentUser.email?.toLowerCase() === 'alexandre1604981@gmail.com';
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário',
            role: isOwner ? 'super_admin' : 'surveyor',
            status: isOwner ? 'active' : 'pending',
            avatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email || 'U')}&background=0284c7&color=fff`,
            createdAténew Date().toISOString(),
          };
          setProfile(fallbackProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Error signing out from Firebase Auth:", err);
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      const isOwner = user.email?.toLowerCase() === 'alexandre1604981@gmail.com';
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || user.email?.split('@')[0] || 'Usuário de Campo',
          role: isOwner ? 'super_admin' : 'surveyor',
          status: isOwner ? 'active' : 'pending',
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'U')}&background=0284c7&color=fff`,
          createdAténew Date().toISOString(),
        };
        await setDoc(docRef, newProfile, { merge: true });
        setProfile(newProfile);
      }
    } catch (e) {
      console.error("Error refreshing profile:", e);
    }
  };

  const updateProfileRoleLocally = (role: UserRole) => {
    if (profile) {
      setProfile({ ...profile, role });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, updateProfileRoleLocally, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

