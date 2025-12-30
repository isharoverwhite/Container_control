"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Box,
    Layers,
    HardDrive,
    MonitorSmartphone,
    LogOut,
    Network,
    Download,
    Server
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import clsx from 'clsx';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Containers', href: '/containers', icon: Box },
    { name: 'Images', href: '/images', icon: Layers },
    { name: 'Volumes', href: '/volumes', icon: HardDrive },
    { name: 'Stacks', href: '/stacks', icon: Layers },
    { name: 'Networks', href: '/networks', icon: Network },
    { name: 'System', href: '/system', icon: Server },
    { name: 'Devices', href: '/devices', icon: MonitorSmartphone },
];

interface PullProgress {
    image: string;
    percent: number;
    layers: { [layerId: string]: { current: number; total: number } };
}

export default function Sidebar() {
    const pathname = usePathname();
    const { logout, socket } = useAuth();
    const [pullingImages, setPullingImages] = useState<{ [image: string]: PullProgress }>({});

    useEffect(() => {
        if (!socket) return;

        const onStart = (data: { image: string }) => {
            setPullingImages(prev => ({
                ...prev,
                [data.image]: { image: data.image, percent: 0, layers: {} }
            }));
        };

        const onProgress = (data: { image: string; event: any }) => {
            const { image, event } = data;
            const status = event.status || '';
            const id = event.id;

            setPullingImages(prev => {
                if (!prev[image]) return prev;

                const updated = { ...prev[image] };

                // Track layer progress
                if ((status === 'Downloading' || status === 'Extracting') && id && event.progressDetail?.total) {
                    updated.layers[id] = {
                        current: event.progressDetail.current || 0,
                        total: event.progressDetail.total
                    };
                }

                // Calculate overall progress
                let totalBytes = 0;
                let currentBytes = 0;
                Object.values(updated.layers).forEach(layer => {
                    currentBytes += layer.current;
                    totalBytes += layer.total;
                });

                if (totalBytes > 0) {
                    updated.percent = Math.round((currentBytes / totalBytes) * 100);
                }

                return { ...prev, [image]: updated };
            });
        };

        const onComplete = (data: { image: string }) => {
            setPullingImages(prev => {
                const updated = { ...prev };
                delete updated[data.image];
                return updated;
            });
        };

        const onError = (data: { image: string }) => {
            setPullingImages(prev => {
                const updated = { ...prev };
                delete updated[data.image];
                return updated;
            });
        };

        socket.on('docker_pull_start', onStart);
        socket.on('docker_pull_progress', onProgress);
        socket.on('docker_pull_complete', onComplete);
        socket.on('docker_pull_error', onError);

        return () => {
            socket.off('docker_pull_start', onStart);
            socket.off('docker_pull_progress', onProgress);
            socket.off('docker_pull_complete', onComplete);
            socket.off('docker_pull_error', onError);
        };
    }, [socket]);

    const pullingList = Object.values(pullingImages);

    return (
        <aside className="w-64 h-screen bg-sidebar border-r border-border flex flex-col shrink-0">
            <div className="p-6 border-b border-border">
                <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-blue-500 bg-clip-text text-transparent">
                    Container Control
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                        <div key={item.href}>
                            <Link href={item.href}>
                                <div
                                    className={clsx(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
                                        isActive ? "text-accent bg-accent/5" : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-r-full"
                                        />
                                    )}
                                    <item.icon size={20} className={clsx(isActive && "text-accent")} />
                                    <span className="font-medium">{item.name}</span>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </nav>

            {/* Global Pull Progress */}
            <AnimatePresence>
                {
                    pullingList.length > 0 && (
                        <div className="px-4 pb-2 space-y-2">
                            {pullingList.map(pull => (
                                <motion.div
                                    key={pull.image}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-white/5 rounded-lg p-3 border border-white/10"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-accent/10 p-1.5 rounded">
                                            <Download size={14} className="text-accent shrink-0" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-white font-medium truncate" title={pull.image}>
                                                {pull.image.split(':')[0]}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono truncate">
                                                {pull.percent}% • {pull.image.split(':')[1] || 'latest'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-accent"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pull.percent}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )
                }
            </AnimatePresence >

            <div className="p-4 border-t border-border">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside >
    );
}
