"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Server } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

import { API_URL } from '@/lib/api';

export default function LoginScreen() {
    const { setSecretKey } = useAuth();
    const [input, setInput] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const key = input.trim();
        if (!key) return;

        setLoading(true);
        setError('');

        try {
            // Verify key by making a lightweight API call
            const res = await fetch(`${API_URL}/system/info`, {
                headers: { 'x-secret-key': key }
            });

            if (res.ok) {
                setSecretKey(key);
            } else {
                setError('Invalid Secret Key');
            }
        } catch (e: any) {
            setError(`Connection failed: ${e.message || e}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md p-8 rounded-xl bg-card border border-border shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 rounded-full bg-accent/10 text-accent mb-4">
                        <Server size={32} />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-blue-500 bg-clip-text text-transparent">
                        Container Control
                    </h1>
                    <p className="text-gray-400 mt-2">Server Management Dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Server Secret Key</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="password"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-sidebar border border-border rounded-lg focus:border-accent outline-none text-white transition-colors"
                                placeholder="Enter your secret key..."
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Verifying...' : 'Access Dashboard'}
                    </button>
                </form>
            </motion.div>
        </div >
    );
}
