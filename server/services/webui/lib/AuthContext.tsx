"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

interface AuthContextType {
    secretKey: string;
    setSecretKey: (key: string) => void;
    isAuthenticated: boolean;
    logout: () => void;
    socket: Socket | null;
}

const AuthContext = createContext<AuthContextType>({
    secretKey: '',
    setSecretKey: () => { },
    isAuthenticated: false,
    logout: () => { },
    socket: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [secretKey, setSecretKeyState] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [socket, setSocket] = useState<Socket | null>(null);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);
    const [pendingRequest, setPendingRequest] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('secretKey');
        if (stored) {
            setSecretKeyState(stored);
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const logout = React.useCallback(() => {
        localStorage.removeItem('secretKey');
        setSecretKeyState('');
        setIsAuthenticated(false);
        if (socket) socket.disconnect();
        setSocket(null);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, [socket]);

    const setSecretKey = (key: string) => {
        localStorage.setItem('secretKey', key);
        setSecretKeyState(key);
        setIsAuthenticated(!!key);
    };

    // Auto-logout logic
    useEffect(() => {
        if (!isAuthenticated) return;

        const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                logout();
                alert("Session expired due to inactivity.");
            }, TIMEOUT_MS);
        };

        // Initial start
        resetTimer();

        // Listeners for activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        const handleActivity = () => {
            // Debounce slightly or just reset
            // For simple implementation, reset every time is okay but mousemove fires a lot.
            // Better to throttle? Or just use 'mousedown' and 'keydown' which are less frequent than mousemove.
            // User said "use anything". Mousemove is using.
            // I'll throttle reset to run max once per second to allow browser to breathe.
            if (timerRef.current) {
                // Actually, clearing and setting timeout on every pixel move is heavy.
                // Optimized: Store last activity timestamp, check periodically?
                // Let's stick to the Reset approach but maybe throttle it logic?
                // Or simple approach: Just reset. JS engines are fast.
                resetTimer();
            }
        };

        // Throttled handler
        let throttleTimer: NodeJS.Timeout | null = null;
        const throttledHandler = () => {
            if (!throttleTimer) {
                resetTimer();
                throttleTimer = setTimeout(() => { throttleTimer = null; }, 1000);
            }
        };

        events.forEach(e => window.addEventListener(e, throttledHandler));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
            events.forEach(e => window.removeEventListener(e, throttledHandler));
        };
    }, [isAuthenticated, logout]);

    // Socket Listener
    useEffect(() => {
        if (!isAuthenticated || !secretKey) return;

        const newSocket = io('https://localhost:3000', {
            auth: { token: secretKey },
        });

        newSocket.on('device_pending', (data: any) => {
            setPendingRequest(data);
        });

        setSocket(newSocket);

        return () => { newSocket.disconnect(); };
    }, [isAuthenticated, secretKey]);

    if (isLoading) return null; // Or a loader

    return (
        <AuthContext.Provider value={{ secretKey, setSecretKey, isAuthenticated, logout, socket }}>
            {children}
            <AnimatePresence>
                {pendingRequest && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-card border border-border p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center relative"
                        >
                            <button onClick={() => setPendingRequest(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                                <X size={20} />
                            </button>
                            <div className="mx-auto bg-yellow-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                                <ShieldAlert size={32} className="text-yellow-500" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">New Device Connection</h2>
                            <p className="text-gray-400 mb-6 text-sm">
                                Device <strong>{pendingRequest.deviceName}</strong> ({pendingRequest.ip}) is requesting access.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => { setPendingRequest(null); window.location.href = '/devices'; }}
                                    className="w-full py-2.5 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors"
                                >
                                    Review Access
                                </button>
                                <button
                                    onClick={() => setPendingRequest(null)}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                                >
                                    Ignore
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
