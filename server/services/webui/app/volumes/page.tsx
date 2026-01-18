"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Trash2, Plus, Info, RefreshCw, Box, X } from 'lucide-react';
import { toast } from 'sonner';

export default function VolumesPage() {
    const { secretKey } = useAuth();
    const [volumes, setVolumes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create Form
    const [newVolName, setNewVolName] = useState('');

    const load = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await fetchApi('/volumes', secretKey);
            // API might return array or object with Volumes key
            if (Array.isArray(data)) {
                setVolumes(data);
            } else if (data && data.Volumes) {
                setVolumes(data.Volumes);
            } else {
                setVolumes([]);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch volumes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load(false);
            const interval = setInterval(() => load(true), 5000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to remove volume '${name}'? This cannot be undone.`)) return;

        const loadingToast = toast.loading("Removing volume...");
        try {
            await fetchApi(`/volumes/${name}`, secretKey, { method: 'DELETE' });
            toast.success("Volume removed", { id: loadingToast });
            load();
        } catch (e: any) {
            toast.error(e.message || "Failed to remove volume", { id: loadingToast });
        }
    };

    const handleCreate = async () => {
        if (!newVolName.trim()) {
            toast.error("Volume name is required");
            return;
        }

        setCreating(true);
        const loadingToast = toast.loading("Creating volume...");
        try {
            const res = await fetchApi('/volumes', secretKey, {
                method: 'POST',
                body: JSON.stringify({ name: newVolName })
            });
            if (res.error) throw new Error(res.error);

            toast.success("Volume created successfully", { id: loadingToast });
            setNewVolName('');
            setCreateModalOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.message || "Failed to create volume", { id: loadingToast });
        } finally {
            setCreating(false);
        }
    };

    const filteredVolumes = volumes.filter(v =>
        v.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.Driver && v.Driver.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    Volumes
                </h1>
                <div className="flex gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search volumes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 md:w-64 px-4 py-2 bg-card border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                    />
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Create
                    </button>
                    <button onClick={() => load()} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-border">
                                <th className="p-4 font-medium text-gray-400">Name</th>
                                <th className="p-4 font-medium text-gray-400">Driver</th>
                                <th className="p-4 font-medium text-gray-400">Mountpoint</th>
                                <th className="p-4 font-medium text-gray-400">Created At</th>
                                <th className="p-4 font-medium text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVolumes.map((vol) => (
                                <motion.tr
                                    key={vol.Name}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="border-b border-border hover:bg-white/5 transition-colors"
                                >
                                    <td className="p-4 font-medium text-white flex items-center gap-2">
                                        <HardDrive size={16} className="text-orange-400" />
                                        <span className="truncate max-w-[200px]" title={vol.Name}>{vol.Name}</span>
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">{vol.Driver}</td>
                                    <td className="p-4 text-gray-500 text-xs font-mono max-w-[300px] truncate" title={vol.Mountpoint}>
                                        {vol.Mountpoint}
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {vol.CreatedAt ? new Date(vol.CreatedAt).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDelete(vol.Name)}
                                            className="p-2 bg-danger/10 text-danger rounded hover:bg-danger/20 transition-colors"
                                            title="Remove Volume"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}

                            {filteredVolumes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <HardDrive size={24} className="opacity-50" />
                                            <span>{loading ? 'Loading...' : 'No volumes found.'}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Volume Modal */}
            <AnimatePresence>
                {createModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus size={20} className="text-accent" /> Create Volume
                                </h2>
                                <button onClick={() => setCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">Volume Name</label>
                                    <input
                                        type="text"
                                        value={newVolName}
                                        onChange={(e) => setNewVolName(e.target.value)}
                                        placeholder="my-volume"
                                        className="w-full p-3 bg-background border border-border rounded-lg focus:border-accent outline-none text-white"
                                        autoFocus
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Creates a standard local volume.</p>
                                </div>
                            </div>
                            <div className="p-6 border-t border-border bg-white/5 flex justify-end gap-3">
                                <button
                                    onClick={() => setCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={creating}
                                    className="px-4 py-2 rounded-lg bg-accent hover:bg-cyan-400 text-black font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {creating && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                                    {creating ? 'Creating...' : 'Create Volume'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
