"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Layers, Trash2, Play, Plus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function StacksPage() {
    const { secretKey } = useAuth();
    const [stacks, setStacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Create State
    const [showCreate, setShowCreate] = useState(false);
    const [stackName, setStackName] = useState('');
    const [stackContent, setStackContent] = useState('');
    const [creating, setCreating] = useState(false);

    const load = async (silent = false) => {
        try {
            if (typeof silent !== 'boolean' || !silent) setLoading(true);
            const data = await fetchApi('/stacks', secretKey);
            setStacks(data);
        } catch (e) {
            console.error(e);
        } finally {
            if (typeof silent !== 'boolean' || !silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load(false);
            const interval = setInterval(() => load(true), 3000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stackName.trim() || !stackContent.trim()) return;

        setCreating(true);
        try {
            await fetchApi('/stacks', secretKey, {
                method: 'POST',
                body: JSON.stringify({ name: stackName, content: stackContent })
            });
            alert('Stack deploying...');
            setShowCreate(false);
            setStackName('');
            setStackContent('');
            load();
        } catch (e) {
            alert(`Deploy failed: ${e}`);
        } finally {
            setCreating(false);
        }
    };

    const handleRemove = async (name: string) => {
        if (!confirm(`Bring down stack ${name}? This will remove containers.`)) return;
        try {
            await fetchApi(`/stacks/${name}`, secretKey, { method: 'DELETE' });
            alert('Stack removed');
            load();
        } catch (e) {
            alert(`Remove failed: ${e}`);
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Stacks</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-accent text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors flex items-center gap-2 text-sm">
                        <Plus size={16} /> Deploy Stack
                    </button>
                    <button onClick={() => load()} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {showCreate && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-8 p-6 bg-card border border-border rounded-xl overflow-hidden"
                >
                    <h2 className="text-lg font-semibold mb-4 text-white">New Stack</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Stack Name</label>
                            <input
                                type="text"
                                value={stackName}
                                onChange={e => setStackName(e.target.value)}
                                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-white focus:border-accent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Docker Compose Content</label>
                            <textarea
                                value={stackContent}
                                onChange={e => setStackContent(e.target.value)}
                                rows={10}
                                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-white font-mono text-sm focus:border-accent outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="px-6 py-2 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50"
                            >
                                {creating ? 'Deploying...' : 'Deploy'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stacks.map((stack) => (
                    <motion.div
                        key={stack}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors flex flex-col justify-between"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-500">
                                <Layers size={24} />
                            </div>
                            <div className="px-2 py-1 bg-success/20 text-success text-xs rounded uppercase font-bold">Active</div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{stack}</h3>
                        <p className="text-sm text-gray-500 mb-4">Stack deployed via Docker Compose</p>

                        <div className="border-t border-border pt-4 flex justify-end">
                            <button onClick={() => handleRemove(stack)} className="flex items-center gap-2 text-danger hover:underline text-sm font-medium">
                                <Trash2 size={16} /> Tear Down
                            </button>
                        </div>
                    </motion.div>
                ))}
                {stacks.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        No stacks found. Deploy one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
