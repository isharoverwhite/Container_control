"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Box, Layers, HardDrive, Network, Cpu, Terminal } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PullProgress from '@/components/PullProgress';

interface CreateContainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface PortMapping {
    private: number | string;
    public: number | string;
    protocol: string;
}

interface EnvVar {
    key: string;
    value: string;
}

interface VolumeMapping {
    source: string;
    target: string;
    readonly: boolean;
}

export default function CreateContainerModal({ isOpen, onClose, onSuccess }: CreateContainerModalProps) {
    const { secretKey } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<any[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [ports, setPorts] = useState<PortMapping[]>([]);
    const [env, setEnv] = useState<EnvVar[]>([]);
    const [volumes, setVolumes] = useState<VolumeMapping[]>([]);
    const [restartPolicy, setRestartPolicy] = useState('no');
    const [autostart, setAutostart] = useState(true);
    const [cmd, setCmd] = useState('');

    const [availableVolumes, setAvailableVolumes] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchImages();
            fetchVolumes();
        } else {
            // Reset form
            // ... (keep existing reset logic)
            setStep(1);
            setName('');
            setImage('');
            setPorts([]);
            setEnv([]);
            setVolumes([]);
            setRestartPolicy('no');
            setCmd('');
        }
    }, [isOpen]);

    const fetchImages = async () => {
        try {
            const data = await fetchApi('/images', secretKey);
            setImages(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load images");
        }
    };

    const fetchVolumes = async () => {
        try {
            const data = await fetchApi('/volumes', secretKey);
            if (Array.isArray(data)) setAvailableVolumes(data);
            else if (data && data.Volumes) setAvailableVolumes(data.Volumes);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async () => {
        if (!image) {
            toast.error("Please select or enter an image");
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading("Creating container...");

        try {
            const payload = {
                name,
                image,
                ports: ports.filter(p => p.private && p.public),
                env: env.filter(e => e.key).map(e => `${e.key}=${e.value}`),
                volumes: volumes.filter(v => v.source && v.target),
                restartPolicy,
                autostart,
                cmd: cmd ? cmd.split(' ') : undefined
            };

            const res = await fetchApi('/containers/create', secretKey, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.error) throw new Error(res.error);

            toast.success("Container created successfully!", { id: loadingToast });
            onSuccess();
            onClose();
        } catch (e: any) {
            toast.error(e.message || "Failed to create container", { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    const addPort = () => setPorts([...ports, { private: 80, public: 8080, protocol: 'tcp' }]);
    const removePort = (idx: number) => setPorts(ports.filter((_, i) => i !== idx));
    const updatePort = (idx: number, field: keyof PortMapping, value: any) => {
        const newPorts = [...ports];
        newPorts[idx] = { ...newPorts[idx], [field]: value };
        setPorts(newPorts);
    };

    const addEnv = () => setEnv([...env, { key: '', value: '' }]);
    const removeEnv = (idx: number) => setEnv(env.filter((_, i) => i !== idx));
    const updateEnv = (idx: number, field: keyof EnvVar, value: string) => {
        const newEnv = [...env];
        newEnv[idx] = { ...newEnv[idx], [field]: value };
        setEnv(newEnv);
    };

    const addVolume = () => setVolumes([...volumes, { source: '', target: '', readonly: false }]);
    const removeVolume = (idx: number) => setVolumes(volumes.filter((_, i) => i !== idx));
    const updateVolume = (idx: number, field: keyof VolumeMapping, value: any) => {
        const newVols = [...volumes];
        newVols[idx] = { ...newVols[idx], [field]: value };
        setVolumes(newVols);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="bg-accent/10 p-2 rounded-lg">
                                <Box size={20} className="text-accent" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Create New Container</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* 1. Basic Info */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Layers size={18} className="text-blue-400" /> Image & Name
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Container Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="my-container"
                                        className="w-full p-3 bg-background border border-border rounded-lg focus:border-accent outline-none text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Image</label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            value={image}
                                            onChange={(e) => setImage(e.target.value)}
                                            list="local-images"
                                            placeholder="e.g. nginx:latest"
                                            className="w-full p-3 bg-background border border-border rounded-lg focus:border-accent outline-none text-white placeholder-gray-600"
                                        />
                                        <datalist id="local-images">
                                            {images.map(img => {
                                                const tagName = img.RepoTags?.[0] || img.Id.substring(0, 12);
                                                return <option key={img.Id} value={tagName} />;
                                            })}
                                        </datalist>
                                    </div>
                                    <p className="text-xs text-gray-500">Select a local image or type a new one to pull automatically.</p>
                                    <PullProgress />
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-border/50" />

                        {/* 2. Networking */}
                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Network size={18} className="text-cyan-400" /> Ports
                                </h3>
                                <button onClick={addPort} className="text-xs flex items-center gap-1 text-accent hover:text-accent/80 font-medium">
                                    <Plus size={14} /> Add Port
                                </button>
                            </div>

                            {ports.length === 0 && <p className="text-sm text-gray-500 italic">No ports exposed.</p>}

                            <div className="space-y-2">
                                {ports.map((port, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2 p-3 bg-background rounded-lg border border-border">
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Host Port</label>
                                                <input
                                                    type="number"
                                                    value={port.public}
                                                    onChange={e => updatePort(idx, 'public', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                    className="w-full bg-transparent outline-none text-white font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Container Port</label>
                                                <input
                                                    type="number"
                                                    value={port.private}
                                                    onChange={e => updatePort(idx, 'private', e.target.value === '' ? '' : parseInt(e.target.value))}
                                                    className="w-full bg-transparent outline-none text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => removePort(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="h-px bg-border/50" />

                        {/* 3. Environment */}
                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Terminal size={18} className="text-green-400" /> Environment Variables
                                </h3>
                                <button onClick={addEnv} className="text-xs flex items-center gap-1 text-accent hover:text-accent/80 font-medium">
                                    <Plus size={14} /> Add Env
                                </button>
                            </div>

                            {env.length === 0 && <p className="text-sm text-gray-500 italic">No environment variables.</p>}

                            <div className="space-y-2">
                                {env.map((e, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2 p-3 bg-background rounded-lg border border-border">
                                            <input
                                                type="text"
                                                value={e.key}
                                                onChange={ev => updateEnv(idx, 'key', ev.target.value)}
                                                placeholder="KEY"
                                                className="bg-transparent outline-none text-white font-mono placeholder-gray-600"
                                            />
                                            <div className="border-l border-border pl-2">
                                                <input
                                                    type="text"
                                                    value={e.value}
                                                    onChange={ev => updateEnv(idx, 'value', ev.target.value)}
                                                    placeholder="VALUE"
                                                    className="w-full bg-transparent outline-none text-white font-mono placeholder-gray-600"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => removeEnv(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="h-px bg-border/50" />

                        {/* 4. Advanced (Volumes, etc) */}
                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <HardDrive size={18} className="text-purple-400" /> Volumes
                                </h3>
                                <button onClick={addVolume} className="text-xs flex items-center gap-1 text-accent hover:text-accent/80 font-medium">
                                    <Plus size={14} /> Add Volume
                                </button>
                            </div>

                            {volumes.length === 0 && <p className="text-sm text-gray-500 italic">No volumes attached.</p>}

                            <div className="space-y-2">
                                {volumes.map((v, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2 p-3 bg-background rounded-lg border border-border">
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Host Volume / Path</label>
                                                <input
                                                    type="text"
                                                    value={v.source}
                                                    onChange={e => updateVolume(idx, 'source', e.target.value)}
                                                    list={`volume-list-${idx}`}
                                                    placeholder="Volume name or /host/path"
                                                    className="w-full bg-transparent outline-none text-white font-mono text-sm"
                                                />
                                                <datalist id={`volume-list-${idx}`}>
                                                    {availableVolumes.map((vol: any) => (
                                                        <option key={vol.Name} value={vol.Name} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Container Path</label>
                                                <input
                                                    type="text"
                                                    value={v.target}
                                                    onChange={e => updateVolume(idx, 'target', e.target.value)}
                                                    placeholder="/container/path"
                                                    className="w-full bg-transparent outline-none text-white font-mono text-sm"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => removeVolume(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="h-px bg-border/50" />

                        {/* 5. Additional Settings */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Cpu size={18} className="text-yellow-400" /> Settings
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">Restart Policy</label>
                                    <select
                                        value={restartPolicy}
                                        onChange={(e) => setRestartPolicy(e.target.value)}
                                        className="w-full p-3 bg-background border border-border rounded-lg outline-none text-white"
                                    >
                                        <option value="no">No</option>
                                        <option value="always">Always</option>
                                        <option value="unless-stopped">Unless Stopped</option>
                                        <option value="on-failure">On Failure</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-3 h-full pt-6">
                                    <input
                                        type="checkbox"
                                        id="autostart"
                                        checked={autostart}
                                        onChange={(e) => setAutostart(e.target.checked)}
                                        className="w-5 h-5 accent-accent"
                                    />
                                    <label htmlFor="autostart" className="text-white">Start Container Immediately</label>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="text-sm text-gray-400 block mb-2">Command Override (Optional)</label>
                                <input
                                    type="text"
                                    value={cmd}
                                    onChange={(e) => setCmd(e.target.value)}
                                    placeholder="e.g. npm start"
                                    className="w-full p-3 bg-background border border-border rounded-lg outline-none text-white font-mono"
                                />
                            </div>
                        </section>

                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-border bg-white/5 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-3 rounded-lg bg-accent hover:bg-cyan-400 text-black font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                            {loading ? 'Creating...' : 'Deploy Container'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
