"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Play, Square, Trash2, Box, RefreshCw, Eye } from 'lucide-react';
import clsx from 'clsx';

export default function ContainersPage() {
    const { secretKey } = useAuth();
    const [containers, setContainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async (silent = false) => {
        try {
            if (typeof silent !== 'boolean' || !silent) setLoading(true);
            const data = await fetchApi('/containers', secretKey);
            setContainers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load(false);
            const interval = setInterval(() => load(true), 3000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    const handleAction = async (id: string, action: string) => {
        try {
            if (action === 'remove') {
                if (!confirm('Are you sure you want to remove this container?')) return;
                await fetchApi(`/containers/${id}?force=true`, secretKey, { method: 'DELETE' });
            } else {
                await fetchApi(`/containers/${id}/${action}`, secretKey, { method: 'POST' });
            }
            load();
        } catch (e) {
            alert(`Action failed: ${e}`);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredContainers = containers.filter(c => {
        const term = searchTerm.toLowerCase();
        const name = (c.Names?.[0] || '').toLowerCase();
        const image = (c.Image || '').toLowerCase();
        const id = (c.Id || '').toLowerCase();
        return name.includes(term) || image.includes(term) || id.includes(term);
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Containers</h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search containers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 md:w-64 px-4 py-2 bg-card border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                    />
                    <button onClick={() => load()} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-border">
                                <th className="p-4 font-medium text-gray-400">Name</th>
                                <th className="p-4 font-medium text-gray-400">Image</th>
                                <th className="p-4 font-medium text-gray-400">State</th>
                                <th className="p-4 font-medium text-gray-400">Status</th>
                                <th className="p-4 font-medium text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContainers.map((c) => {
                                const name = c.Names?.[0]?.replace('/', '') || c.Id.substring(0, 12);
                                const isRunning = c.State === 'running';

                                return (
                                    <motion.tr
                                        key={c.Id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="border-b border-border hover:bg-white/5 transition-colors"
                                    >
                                        <td className="p-4 font-medium text-white">{name}</td>
                                        <td className="p-4 text-gray-400 text-sm max-w-[200px] truncate" title={c.Image}>{c.Image}</td>
                                        <td className="p-4">
                                            <span className={clsx(
                                                "px-2 py-1 rounded-full text-xs font-semibold uppercase",
                                                isRunning ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                                            )}>
                                                {c.State}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500 text-sm">{c.Status}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/containers/${c.Id}`}>
                                                    <button className="p-2 bg-accent/10 text-accent rounded hover:bg-accent/20" title="Details">
                                                        <Eye size={16} />
                                                    </button>
                                                </Link>
                                                {isRunning ? (
                                                    <button onClick={() => handleAction(c.Id, 'stop')} className="p-2 bg-warning/10 text-warning rounded hover:bg-warning/20" title="Stop">
                                                        <Square size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleAction(c.Id, 'start')} className="p-2 bg-success/10 text-success rounded hover:bg-success/20" title="Start">
                                                        <Play size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleAction(c.Id, 'remove')} className="p-2 bg-danger/10 text-danger rounded hover:bg-danger/20" title="Remove">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}

                            {filteredContainers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Box size={24} className="opacity-50" />
                                            <span>{loading ? 'Loading...' : 'No containers found matching your search.'}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
