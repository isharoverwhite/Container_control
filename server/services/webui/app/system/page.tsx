"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Box, Layers, RefreshCw, Info } from 'lucide-react';
import { getSystemInfo, SystemInfo, formatBytes } from '@/lib/apiClient';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

export default function SystemPage() {
    const { secretKey } = useAuth();
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!secretKey) return;
        try {
            const data = await getSystemInfo(secretKey);
            setSystemInfo(data);
        } catch (error: any) {
            toast.error(`Failed to load system info: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [secretKey]);

    if (loading || !systemInfo) {
        return <LoadingSpinner fullScreen message="Loading system information..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">System Information</h1>
                <button
                    onClick={load}
                    className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-6"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Box size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Containers</p>
                            <p className="text-2xl font-bold text-white">{systemInfo.Containers}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                        <span className="text-green-400">▲ {systemInfo.ContainersRunning} running</span>
                        <span className="text-gray-500">● {systemInfo.ContainersStopped} stopped</span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-xl p-6"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Layers size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Images</p>
                            <p className="text-2xl font-bold text-white">{systemInfo.Images}</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-xl p-6"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <Cpu size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">CPUs</p>
                            <p className="text-2xl font-bold text-white">{systemInfo.NCPU}</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-card border border-border rounded-xl p-6"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <HardDrive size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Memory</p>
                            <p className="text-2xl font-bold text-white">{formatBytes(systemInfo.MemTotal)}</p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Docker Information */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Server size={20} className="text-accent" />
                    Docker Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Docker Version</p>
                        <p className="text-white font-semibold">{systemInfo.ServerVersion}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">API Version</p>
                        <p className="text-white font-semibold">{systemInfo.IndexServerAddress}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Storage Driver</p>
                        <p className="text-white font-semibold">{systemInfo.Driver}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Logging Driver</p>
                        <p className="text-white font-semibold">{systemInfo.LoggingDriver}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Cgroup Driver</p>
                        <p className="text-white font-semibold">{systemInfo.CgroupDriver}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Default Runtime</p>
                        <p className="text-white font-semibold">{systemInfo.DefaultRuntime}</p>
                    </div>
                </div>
            </div>

            {/* System Information */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Info size={20} className="text-accent" />
                    Host System
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Operating System</p>
                        <p className="text-white font-semibold">{systemInfo.OperatingSystem}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">OS Type</p>
                        <p className="text-white font-semibold">{systemInfo.OSType}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Architecture</p>
                        <p className="text-white font-semibold">{systemInfo.Architecture}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Kernel Version</p>
                        <p className="text-white font-semibold">{systemInfo.KernelVersion}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Hostname</p>
                        <p className="text-white font-semibold">{systemInfo.Name}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-1">Docker Root Dir</p>
                        <p className="text-white font-mono text-sm break-all">{systemInfo.DockerRootDir}</p>
                    </div>
                </div>
            </div>

            {/* Plugins */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Plugins</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Volume Drivers</h3>
                        <div className="flex flex-wrap gap-2">
                            {systemInfo.Plugins.Volume.map((plugin) => (
                                <span
                                    key={plugin}
                                    className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-sm"
                                >
                                    {plugin}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Network Drivers</h3>
                        <div className="flex flex-wrap gap-2">
                            {systemInfo.Plugins.Network.map((plugin) => (
                                <span
                                    key={plugin}
                                    className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm"
                                >
                                    {plugin}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Log Drivers</h3>
                        <div className="flex flex-wrap gap-2">
                            {systemInfo.Plugins.Log.map((plugin) => (
                                <span
                                    key={plugin}
                                    className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-sm"
                                >
                                    {plugin}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Options */}
            {systemInfo.SecurityOptions && systemInfo.SecurityOptions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Security Options</h2>
                    <div className="flex flex-wrap gap-2">
                        {systemInfo.SecurityOptions.map((option, index) => (
                            <span
                                key={index}
                                className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm font-mono"
                            >
                                {option}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
