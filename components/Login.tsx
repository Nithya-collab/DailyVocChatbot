
import React, { useState } from 'react';
import { auth, googleProvider, db, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../services/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Platform } from '../types';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { saveProfile, getProfile } from '../services/db';

interface LoginProps {
    onLogin: (user: UserProfile) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Helper to process authenticated user
    const handleAuthUser = async (firebaseUser: any) => {
        try {
            // Firestore Sync
            const userRef = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: firebaseUser.email,
                    created_date: Timestamp.now(),
                    is_active: true,
                    user_id: Date.now() // Simple unique ID generation
                });
            }

            // Try to get existing profile or create new one
            // For now, we are using the single 'profile' key as per existing db implementation
            // Use getProfile() to see if we have local data. 
            // In a real app with multi-user, we'd fetch data specific to firebaseUser.uid

            let profile = await getProfile();

            if (!profile) {
                // Create new profile if none exists
                profile = {
                    id: firebaseUser.uid,
                    name: firebaseUser.displayName || 'Learner',
                    platform: Platform.WhatsApp,
                    reminderTime: '10:00',
                    currentWords: [],
                    lastGenerated: ''
                };
                await saveProfile(profile);
            } else {
                // Update ID/Name if needed, but preserve other data
                // This is a simple merge strategy
                if (profile.id !== firebaseUser.uid) {
                    // If the ID is different, strictly speaking we should probably switch data
                    // But with current db.ts limitation, we'll just update the ID or keep using the local data as "cached"
                    // Let's just update the ID for now
                    profile.id = firebaseUser.uid;
                    if (firebaseUser.displayName) profile.name = firebaseUser.displayName;
                    await saveProfile(profile);
                }
            }

            onLogin(profile);
        } catch (err) {
            console.error("Error setting up user profile", err);
            setError("Failed to load user profile");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            let userCredential;
            if (isSignUp) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }
            await handleAuthUser(userCredential.user);
        } catch (err: any) {
            console.error(err);
            let msg = "Authentication failed";
            if (err.code === 'auth/invalid-email') msg = "Invalid email address";
            if (err.code === 'auth/user-disabled') msg = "User account disabled";
            if (err.code === 'auth/user-not-found') msg = "User not found";
            if (err.code === 'auth/wrong-password') msg = "Incorrect password";
            if (err.code === 'auth/email-already-in-use') msg = "Email already in use";
            if (err.code === 'auth/weak-password') msg = "Password is too weak";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await handleAuthUser(result.user);
        } catch (err: any) {
            console.error(err);
            setError("Google sign-in failed. Please check your configuration.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-blue-50 overflow-hidden">

                {/* Header Section */}
                <div className="bg-blue-600 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white shadow-inner">
                            <LayoutDashboard size={32} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">NithiBot</h1>
                        <p className="text-blue-100 text-sm font-medium">Your Visual Vocabulary Assistant</p>
                    </div>
                </div>

                {/* Form Section */}
                <div className="p-8">
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-gray-800">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                        <p className="text-sm text-gray-500 mt-1">{isSignUp ? "Join us to expand your vocabulary" : "Sign in to continue learning"}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mb-6 flex items-start gap-3 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="hello@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-12 py-3.5 font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 mt-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn size={20} />}
                            {isSignUp ? "Sign Up" : "Sign In"}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-400 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 group"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
                        <span>Google</span>
                    </button>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 text-center text-sm border-t border-gray-100">
                    <p className="text-gray-500">
                        {isSignUp ? "Already have an account?" : "Don't have an account?"}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            {isSignUp ? "Sign in" : "Sign up"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
