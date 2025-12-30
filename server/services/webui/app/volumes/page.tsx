"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import { HardDrive, Trash2, Plus, RefreshCw } from 'lucide-react';
import { getVolumes, deleteVolume } from '@/lib/apiClient';
import CreateVolumeDialog from '@/components/CreateVolumeDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';

export default function VolumesPage() {
    const { secretKey } = useAuth();
    const [volumes, setVolumes] = useState<any[]>([]);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [volumeToDelete, setVolumeToDelete] = useState<string | null>(null);

    const load = async () => {
        if (!secretKey) return;
        try {
            const data = await getVolumes(secretKey);
            const list = data.Volumes || [];
            setVolumes(list);
        } catch (e: any) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load();
            const interval = setInterval(load, 3000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    const handleDelete = async () => {
        if (!secretKey || !volumeToDelete) return;
        try {
            await deleteVolume(volumeToDelete, secretKey);
            toast.success('Volume deleted');
            load();
        } catch (e: any) {
            toast.error(`Delete failed: ${e.message}`);
        } finally {
            setVolumeToDelete(null);
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Volumes</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="px-4 py-2 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} /> Create Volume
                    </button>
                    <button
                        onClick={load}
                        className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
                    >
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
                                <th className="p-4 font-medium text-gray-400">Driver</th>
                                <th className="p-4 font-medium text-gray-400">Mountpoint</th>
                                <th className="p-4 font-medium text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {volumes.map((vol) => (
                                <motion.tr
                                    key={vol.Name}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="border-b border-border hover:bg-white/5 transition-colors"
                                >
                                    <td className="p-4 text-white font-medium flex items-center gap-3">
                                        <HardDrive size={18} className="text-orange-400" />
                                        {vol.Name}
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">{vol.Driver}</td>
                                    <td className="p-4 text-gray-500 text-xs font-mono">{vol.Mountpoint}</td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => setVolumeToDelete(vol.Name)}
                                            className="p-2 bg-danger/10 text-danger rounded hover:bg-danger/20 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                            {volumes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                        No volumes found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateVolumeDialog
                isOpen={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onSuccess={load}
                secretKey={secretKey || ''}
            />

            <ConfirmDialog
                isOpen={volumeToDelete !== null}
                onClose={() => setVolumeToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Volume"
                message={`Are you sure you want to delete volume "${volumeToDelete}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}
