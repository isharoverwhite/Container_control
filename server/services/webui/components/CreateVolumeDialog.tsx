"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { createVolume } from '@/lib/apiClient';
import { toast } from 'sonner';

interface CreateVolumeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    secretKey: string;
}

export default function CreateVolumeDialog({ isOpen, onClose, onSuccess, secretKey }: CreateVolumeDialogProps) {
    const [name, setName] = useState('');
    const [driver, setDriver] = useState('local');
    const [driverOpts, setDriverOpts] = useState<Array<{ key: string; value: string }>>([]);
    const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([]);
    const [creating, setCreating] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Volume name is required');
            return;
        }

        setCreating(true);
        try {
            const driverOptsObj = driverOpts.reduce((acc, { key, value }) => {
                if (key.trim()) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);

            const labelsObj = labels.reduce((acc, { key, value }) => {
                if (key.trim()) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);

            await createVolume(name, secretKey, {
                driver,
                driverOpts: Object.keys(driverOptsObj).length > 0 ? driverOptsObj : undefined,
                labels: Object.keys(labelsObj).length > 0 ? labelsObj : undefined,
            });

            toast.success('Volume created successfully');
            onSuccess();
            onClose();
            // Reset form
            setName('');
            setDriver('local');
            setDriverOpts([]);
            setLabels([]);
        } catch (error: any) {
            toast.error(`Failed to create volume: ${error.message}`);
        } finally {
            setCreating(false);
        }
    };

    const addDriverOpt = () => {
        setDriverOpts([...driverOpts, { key: '', value: '' }]);
    };

    const removeDriverOpt = (index: number) => {
        setDriverOpts(driverOpts.filter((_, i) => i !== index));
    };

    const updateDriverOpt = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...driverOpts];
        updated[index][field] = value;
        setDriverOpts(updated);
    };

    const addLabel = () => {
        setLabels([...labels, { key: '', value: '' }]);
    };

    const removeLabel = (index: number) => {
        setLabels(labels.filter((_, i) => i !== index));
    };

    const updateLabel = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...labels];
        updated[index][field] = value;
        setLabels(updated);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-white">Create Volume</h2>
                            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Volume Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Volume Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="my-volume"
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white"
                                    required
                                />
                            </div>

                            {/* Driver */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Driver</label>
                                <select
                                    value={driver}
                                    onChange={(e) => setDriver(e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white"
                                >
                                    <option value="local">local</option>
                                    <option value="nfs">nfs</option>
                                    <option value="cifs">cifs</option>
                                </select>
                            </div>

                            {/* Driver Options */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-400">Driver Options</label>
                                    <button
                                        type="button"
                                        onClick={addDriverOpt}
                                        className="text-sm text-accent hover:text-cyan-400 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Option
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {driverOpts.map((opt, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={opt.key}
                                                onChange={(e) => updateDriverOpt(index, 'key', e.target.value)}
                                                placeholder="Key"
                                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={opt.value}
                                                onChange={(e) => updateDriverOpt(index, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeDriverOpt(index)}
                                                className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Labels */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-400">Labels</label>
                                    <button
                                        type="button"
                                        onClick={addLabel}
                                        className="text-sm text-accent hover:text-cyan-400 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add Label
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {labels.map((label, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={label.key}
                                                onChange={(e) => updateLabel(index, 'key', e.target.value)}
                                                placeholder="Key"
                                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={label.value}
                                                onChange={(e) => updateLabel(index, 'value', e.target.value)}
                                                placeholder="Value"
                                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:border-accent outline-none text-white text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeLabel(index)}
                                                className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="flex gap-3 justify-end pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 bg-accent hover:bg-cyan-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating...' : 'Create Volume'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
