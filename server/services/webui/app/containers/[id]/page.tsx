"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import {
    Play, Square, RotateCw, Trash2, Copy, RefreshCw, ArrowLeft,
    Activity, FileText, Terminal as TerminalIcon, Network, HardDrive, Settings
} from 'lucide-react';
import {
    inspectContainer,
    startContainer,
    stopContainer,
    restartContainer,
    deleteContainer,
    duplicateContainer,
    recreateContainer,
    updateContainer,
    getNetworks,
    connectNetwork,
    disconnectNetwork,
    ContainerInspect,
    Network as NetworkType,
    getContainerState
} from '@/lib/apiClient';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import LogViewer from '@/components/LogViewer';
import ContainerTerminal from '@/components/ContainerTerminal';
import { toast } from 'sonner';

export default function ContainerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { secretKey } = useAuth();
    const containerId = params.id as string;

    const [container, setContainer] = useState<ContainerInspect | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [uptime, setUptime] = useState('');
    const [networks, setNetworks] = useState<NetworkType[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<{ name: string; id: string } | null>(null);

    const tabs = [
        { name: 'Overview', icon: Activity },
        { name: 'Logs', icon: FileText },
        { name: 'Terminal', icon: TerminalIcon },
        { name: 'Networks', icon: Network },
        { name: 'Volumes', icon: HardDrive },
        { name: 'Environment', icon: Settings },
    ];

    const loadContainer = async () => {
        if (!secretKey) return;
        try {
            const data = await inspectContainer(containerId, secretKey);
            setContainer(data);
        } catch (error: any) {
            toast.error(`Failed to load container: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadNetworks = async () => {
        if (!secretKey) return;
        try {
            const data = await getNetworks(secretKey);
            setNetworks(data);
        } catch (error: any) {
            console.error('Failed to load networks:', error);
        }
    };

    useEffect(() => {
        loadContainer();
        loadNetworks();
        const interval = setInterval(loadContainer, 3000);
        return () => clearInterval(interval);
    }, [secretKey, containerId]);

    // Update uptime
    useEffect(() => {
        if (!container?.State.Running || !container.State.StartedAt) return;

        const updateUptime = () => {
            const startTime = new Date(container.State.StartedAt).getTime();
            const now = Date.now();
            const diff = now - startTime;

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let uptimeStr = '';
            if (days > 0) uptimeStr += `${days}d `;
            if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
            if (minutes > 0 || hours > 0 || days > 0) uptimeStr += `${minutes}m `;
            uptimeStr += `${seconds}s`;

            setUptime(uptimeStr);
        };

        updateUptime();
        const interval = setInterval(updateUptime, 1000);
        return () => clearInterval(interval);
    }, [container]);

    const handleAction = async (action: string) => {
        if (!secretKey) return;

        try {
            switch (action) {
                case 'start':
                    await startContainer(containerId, secretKey);
                    toast.success('Container started');
                    break;
                case 'stop':
                    await stopContainer(containerId, secretKey);
                    toast.success('Container stopped');
                    break;
                case 'restart':
                    await restartContainer(containerId, secretKey);
                    toast.success('Container restarted');
                    break;
                case 'duplicate':
                    await duplicateContainer(containerId, secretKey);
                    toast.success('Container duplicated');
                    break;
                case 'recreate':
                    await recreateContainer(containerId, secretKey);
                    toast.success('Container recreated');
                    break;
                case 'delete':
                    await deleteContainer(containerId, secretKey);
                    toast.success('Container deleted');
                    router.push('/containers');
                    return;
            }
            loadContainer();
        } catch (error: any) {
            toast.error(`Action failed: ${error.message}`);
        }
    };

    const handleRestartPolicyChange = async (newPolicy: string) => {
        if (!secretKey) return;
        try {
            await updateContainer(containerId, secretKey, {
                RestartPolicy: { Name: newPolicy },
            });
            toast.success('Restart policy updated');
            loadContainer();
        } catch (error: any) {
            toast.error(`Failed to update restart policy: ${error.message}`);
        }
    };

    const handleConnectNetwork = async (networkId: string) => {
        if (!secretKey) return;
        try {
            await connectNetwork(networkId, containerId, secretKey);
            toast.success('Network connected');
            loadContainer();
        } catch (error: any) {
            toast.error(`Failed to connect network: ${error.message}`);
        }
    };

    const handleDisconnectNetwork = async (networkId: string) => {
        if (!secretKey) return;
        try {
            await disconnectNetwork(networkId, containerId, secretKey);
            toast.success('Network disconnected');
            loadContainer();
            setShowDisconnectConfirm(null);
        } catch (error: any) {
            toast.error(`Failed to disconnect network: ${error.message}`);
        }
    };

    if (loading || !container) {
        return <LoadingSpinner fullScreen message="Loading container details..." />;
    }

    const state = getContainerState(container.State.Status);
    const isRunning = container.State.Running;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/containers')}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{container.Name.replace(/^\//, '')}</h1>
                        <p className="text-gray-400 text-sm mt-1">{container.Config.Image}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${state.color} bg-white/5`}>
                        {state.label}
                    </span>
                </div>

                <button
                    onClick={loadContainer}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-wrap">
                {!isRunning && (
                    <button
                        onClick={() => handleAction('start')}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Play size={16} />
                        Start
                    </button>
                )}
                {isRunning && (
                    <button
                        onClick={() => handleAction('stop')}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Square size={16} />
                        Stop
                    </button>
                )}
                <button
                    onClick={() => handleAction('restart')}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2"
                >
                    <RotateCw size={16} />
                    Restart
                </button>
                <button
                    onClick={() => handleAction('duplicate')}
                    className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2"
                >
                    <Copy size={16} />
                    Duplicate
                </button>
                <button
                    onClick={() => handleAction('recreate')}
                    className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    Recreate
                </button>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg transition-colors flex items-center gap-2"
                >
                    <Trash2 size={16} />
                    Delete
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <div className="flex gap-6">
                    {tabs.map((tab, index) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === index
                                        ? 'border-accent text-accent'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                <Icon size={18} />
                                {tab.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-card border border-border rounded-xl p-6"
            >
                {/* Overview Tab */}
                {activeTab === 0 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-sm text-gray-400 mb-1">Container ID</div>
                                <div className="font-mono text-sm text-white">{container.Id.substring(0, 12)}</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-sm text-gray-400 mb-1">Status</div>
                                <div className={`font-medium ${state.color}`}>{state.label}</div>
                            </div>
                            {isRunning && (
                                <div className="bg-white/5 p-4 rounded-lg">
                                    <div className="text-sm text-gray-400 mb-1">Uptime</div>
                                    <div className="font-medium text-white">{uptime}</div>
                                </div>
                            )}
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-sm text-gray-400 mb-1">Restart Policy</div>
                                <select
                                    value={container.HostConfig.RestartPolicy.Name}
                                    onChange={(e) => handleRestartPolicyChange(e.target.value)}
                                    className="bg-background border border-border rounded px-2 py-1 text-white text-sm"
                                >
                                    <option value="no">No</option>
                                    <option value="always">Always</option>
                                    <option value="on-failure">On Failure</option>
                                    <option value="unless-stopped">Unless Stopped</option>
                                </select>
                            </div>
                        </div>

                        {container.Config.Cmd && container.Config.Cmd.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">Command</h3>
                                <div className="bg-black/30 p-3 rounded-lg font-mono text-sm text-gray-300">
                                    {container.Config.Cmd.join(' ')}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Logs Tab */}
                {activeTab === 1 && (
                    <div className="h-[600px]">
                        <LogViewer containerId={containerId} />
                    </div>
                )}

                {/* Terminal Tab */}
                {activeTab === 2 && (
                    <div className="h-[600px]">
                        {isRunning ? (
                            <ContainerTerminal containerId={containerId} secretKey={secretKey || ''} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Container must be running to access terminal
                            </div>
                        )}
                    </div>
                )}

                {/* Networks Tab */}
                {activeTab === 3 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Connected Networks</h3>
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleConnectNetwork(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                                className="bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
                            >
                                <option value="">Connect to network...</option>
                                {networks
                                    .filter((net) => !container.NetworkSettings.Networks[net.Name])
                                    .map((net) => (
                                        <option key={net.Id} value={net.Id}>
                                            {net.Name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            {Object.entries(container.NetworkSettings.Networks).map(([name, network]: [string, any]) => (
                                <div key={name} className="bg-white/5 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-white">{name}</div>
                                        <div className="text-sm text-gray-400">IP: {network.IPAddress || 'N/A'}</div>
                                    </div>
                                    {name !== 'bridge' && (
                                        <button
                                            onClick={() => setShowDisconnectConfirm({ name, id: network.NetworkID })}
                                            className="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg transition-colors text-sm"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Volumes Tab */}
                {activeTab === 4 && (
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Volume Mounts</h3>
                        {container.Mounts.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No volumes mounted</div>
                        ) : (
                            container.Mounts.map((mount, index) => (
                                <div key={index} className="bg-white/5 p-4 rounded-lg">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-gray-400">Source</div>
                                            <div className="font-mono text-sm text-white break-all">{mount.Source}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-400">Destination</div>
                                            <div className="font-mono text-sm text-white break-all">{mount.Destination}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-400">Type</div>
                                            <div className="text-sm text-white">{mount.Type}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-400">Mode</div>
                                            <div className="text-sm text-white">{mount.RW ? 'Read/Write' : 'Read-Only'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Environment Tab */}
                {activeTab === 5 && (
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Environment Variables</h3>
                        {container.Config.Env.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No environment variables</div>
                        ) : (
                            container.Config.Env.map((env, index) => {
                                const [key, ...valueParts] = env.split('=');
                                const value = valueParts.join('=');
                                return (
                                    <div key={index} className="bg-white/5 p-3 rounded-lg flex items-center justify-between">
                                        <div className="font-mono text-sm">
                                            <span className="text-accent">{key}</span>
                                            <span className="text-gray-500">=</span>
                                            <span className="text-white">{value}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </motion.div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => handleAction('delete')}
                title="Delete Container"
                message={`Are you sure you want to delete "${container.Name.replace(/^\//, '')}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            {/* Disconnect Network Confirmation */}
            {showDisconnectConfirm && (
                <ConfirmDialog
                    isOpen={true}
                    onClose={() => setShowDisconnectConfirm(null)}
                    onConfirm={() => handleDisconnectNetwork(showDisconnectConfirm.id)}
                    title="Disconnect Network"
                    message={`Are you sure you want to disconnect from "${showDisconnectConfirm.name}"?`}
                    confirmText="Disconnect"
                    variant="warning"
                />
            )}
        </div>
    );
}
