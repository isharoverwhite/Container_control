"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Trash2, Play, Plus, RefreshCw, Square, X, Terminal, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function StacksPage() {
    const { secretKey, socket } = useAuth();
    const [stacks, setStacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Create State
    const [showCreate, setShowCreate] = useState(false);
    const [stackName, setStackName] = useState('');
    const [stackContent, setStackContent] = useState('');
    const [deploying, setDeploying] = useState(false);

    // Deployment Log State
    const [showLogModal, setShowLogModal] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);

    const load = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await fetchApi('/stacks', secretKey);
            setStacks(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load stacks");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load(false);
            const interval = setInterval(() => load(true), 5000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    // Socket listeners for logs
    useEffect(() => {
        if (!socket) return;

        const onLog = (data: { name: string, line: string, isError?: boolean }) => {
            if (data.name === stackName && showLogModal) {
                setLogs(prev => [...prev, data.line]);
            }
        };

        const onComplete = (data: { name: string, success: boolean, action: string, error?: string }) => {
            if (data.name === stackName) {
                if (data.success) {
                    setDeploymentStatus('success');
                    setDeploying(false); // <--- Add this
                    setTimeout(() => {
                        load();
                    }, 1000);
                } else {
                    setDeploymentStatus('error');
                    setDeploying(false); // <--- Add this
                    setLogs(prev => [...prev, `Error: ${data.error}`]);
                }
            }
        };

        socket.on('stack_log', onLog);
        socket.on('stack_action_complete', onComplete);

        return () => {
            socket.off('stack_log', onLog);
            socket.off('stack_action_complete', onComplete);
        };
    }, [socket, stackName, showLogModal]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stackName.trim() || !stackContent.trim()) {
            toast.error("Stack name and content are required");
            return;
        }

        setDeploying(true);
        setLogs(['Initializing deployment...']);
        setDeploymentStatus('running');
        setShowLogModal(true); // Open Log Modal immediately

        try {
            // 1. Create Stack Definition
            const createRes = await fetchApi('/stacks', secretKey, {
                method: 'POST',
                body: JSON.stringify({ name: stackName, content: stackContent })
            });

            if (createRes.error) throw new Error(createRes.error);
            setLogs(prev => [...prev, 'Stack definition created.', 'Starting container deployment...']);

            // 2. Start (Up) Stack - purely triggers the process, logs come via socket
            const upRes = await fetchApi(`/stacks/${stackName}/up`, secretKey, { method: 'POST' });
            if (upRes.error) throw new Error(upRes.error);

        } catch (e: any) {
            const errMsg = e.message || e;
            setLogs(prev => [...prev, `FATAL ERROR: ${errMsg}`]);
            setDeploymentStatus('error');
            toast.error(`Deploy failed: ${errMsg}`);
        } finally {
            setDeploying(false);
        }
    };

    const closeLogModal = () => {
        if (deploymentStatus === 'running') {
            if (!confirm("Deployment is still in progress. Are you sure you want to close this window? Logs will continue in background.")) return;
        }
        setShowLogModal(false);
        if (deploymentStatus === 'success') {
            setShowCreate(false);
            setStackName('');
            setStackContent('');
        }
    };

    const handleRemove = async (name: string) => {
        if (!confirm(`Are you sure you want to remove stack '${name}'? This will stop and remove all associated containers.`)) return;

        const toastId = toast.loading(`Removing stack '${name}'...`);
        try {
            await fetchApi(`/stacks/${name}`, secretKey, { method: 'DELETE' });
            toast.success("Stack removed successfully", { id: toastId });
            load();
        } catch (e: any) {
            toast.error(`Remove failed: ${e.message || e}`, { id: toastId });
        }
    };

    const handleAction = async (name: string, action: 'up' | 'down') => {
        const toastId = toast.loading(`${action === 'up' ? 'Starting' : 'Stopping'} stack '${name}'...`);
        try {
            await fetchApi(`/stacks/${name}/${action}`, secretKey, { method: 'POST' });
            toast.success(`Stack ${action === 'up' ? 'started' : 'stopped'}`, { id: toastId });
        } catch (e: any) {
            toast.error(`Action failed: ${e.message || e}`, { id: toastId });
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    Stacks
                </h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex-1 md:flex-none px-4 py-2 bg-accent text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Deploy Stack
                    </button>
                    <button onClick={() => load()} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Deployment Log Modal */}
            <AnimatePresence>
                {showLogModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#1e1e1e] border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="text-white font-mono font-bold flex items-center gap-2">
                                    {deploymentStatus === 'running' && <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />}
                                    {deploymentStatus === 'success' && <CheckCircle size={16} className="text-green-400" />}
                                    {deploymentStatus === 'error' && <div className="w-3 h-3 bg-red-500 rounded-full" />}
                                    Deploying: {stackName}
                                </h3>
                                <button onClick={closeLogModal} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1 bg-black/50">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-gray-300 break-words whitespace-pre-wrap border-l-2 border-transparent pl-2 hover:border-white/20 hover:bg-white/5">
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                                {deploymentStatus === 'running' ? (
                                    <span className="text-xs text-yellow-400 flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                                        Deployment in progress...
                                    </span>
                                ) : (
                                    <button
                                        onClick={closeLogModal}
                                        className={`px-4 py-2 rounded font-bold text-sm ${deploymentStatus === 'success' ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    >
                                        {deploymentStatus === 'success' ? 'Done' : 'Close'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreate && !showLogModal && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="mb-8 overflow-hidden"
                    >
                        <div className="p-6 bg-card border border-border rounded-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Terminal size={18} className="text-accent" /> New Stack Deployment
                                </h2>
                                <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>

                            <form onSubmit={handleDeploy} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Stack Name</label>
                                    <input
                                        type="text"
                                        value={stackName}
                                        onChange={e => setStackName(e.target.value)}
                                        placeholder="my-stack"
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg text-white focus:border-accent outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Docker Compose Content (YAML)</label>
                                    <textarea
                                        value={stackContent}
                                        onChange={e => setStackContent(e.target.value)}
                                        rows={12}
                                        placeholder="version: '3'&#10;services:&#10;  ..."
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg text-white font-mono text-sm focus:border-accent outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(false)}
                                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={deploying}
                                        className="px-6 py-2 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                                    >
                                        Deploy Stack
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.isArray(stacks) ? stacks : []).map((stack) => {
                    const stackName = typeof stack === 'string' ? stack : stack.name || 'Unknown';
                    return (
                        <motion.div
                            key={stackName}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.01 }}
                            className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-all flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-3 rounded-lg text-yellow-500 group-hover:text-yellow-400 transition-colors">
                                        <Layers size={24} />
                                    </div>
                                    <div className="px-2 py-1 bg-white/5 text-gray-400 text-xs rounded uppercase font-bold tracking-wider">
                                        Stack
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 truncate" title={stackName}>{stackName}</h3>
                                <p className="text-sm text-gray-500 mb-6">Managed via Docker Compose</p>
                            </div>

                            <div className="border-t border-border pt-4 flex justify-between items-center">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAction(stackName, 'up')}
                                        className="p-2 hover:bg-success/20 text-success rounded-lg transition-colors"
                                        title="Start Stack"
                                    >
                                        <Play size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleAction(stackName, 'down')}
                                        className="p-2 hover:bg-warning/20 text-warning rounded-lg transition-colors"
                                        title="Stop Stack"
                                    >
                                        <Square size={18} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleRemove(stackName)}
                                    className="p-2 hover:bg-danger/20 text-danger rounded-lg transition-colors"
                                    title="Delete Stack"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    );
                })}

                {stacks.length === 0 && !loading && (
                    <div className="col-span-full py-16 text-center text-gray-500 bg-card/50 border border-border/50 rounded-xl border-dashed">
                        <Layers size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No stacks deployed.</p>
                        <p className="text-sm opacity-60">Click "Deploy Stack" to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
