"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface PullState {
    image: string;
    percent: number;
    status: string;
    error?: string;
    isDone?: boolean;
}

export default function PullProgress() {
    const { socket } = useAuth();
    const [pullState, setPullState] = useState<PullState | null>(null);
    const layersRef = useRef<Map<string, { current: number; total: number }>>(new Map());

    useEffect(() => {
        if (!socket) return;

        const onProgress = (data: any) => {
            const { image, event } = data;
            const status = event.status || '';
            const id = event.id;

            if ((status === 'Downloading' || status === 'Extracting') && id && event.progressDetail?.total) {
                const current = event.progressDetail.current;
                const total = event.progressDetail.total;
                layersRef.current.set(id, { current, total });
            }

            let totalBytes = 0;
            let currentBytes = 0;
            layersRef.current.forEach((val) => {
                currentBytes += val.current;
                totalBytes += val.total;
            });

            let percent = 0;
            if (totalBytes > 0) {
                percent = Math.round((currentBytes / totalBytes) * 100);
            }

            setPullState({
                image,
                percent,
                status: `${status} ${id || ''}`,
                isDone: false
            });
        };

        const onComplete = (data: any) => {
            const { image } = data;
            layersRef.current.clear();
            setPullState({
                image,
                percent: 100,
                status: 'Complete',
                isDone: true
            });

            setTimeout(() => {
                setPullState(prev => (prev?.image === image && prev?.isDone ? null : prev));
            }, 4000);
        };

        const onError = (data: any) => {
            const { image, error } = data;
            layersRef.current.clear();
            setPullState({
                image,
                percent: 0,
                status: 'Error',
                error: error || 'Unknown error',
                isDone: true
            });

            setTimeout(() => {
                setPullState(prev => (prev?.image === image && prev?.error ? null : prev));
            }, 5000);
        };

        socket.on('docker_pull_progress', onProgress);
        socket.on('docker_pull_complete', onComplete);
        socket.on('docker_pull_error', onError);

        return () => {
            socket.off('docker_pull_progress', onProgress);
            socket.off('docker_pull_complete', onComplete);
            socket.off('docker_pull_error', onError);
        };
    }, [socket]);

    if (!pullState) return null;

    const isError = !!pullState.error;
    const isComplete = pullState.isDone && !isError;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
            >
                <div className={`flex items-center justify-between text-xs mb-1.5 font-medium ${isError ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-accent'}`}>
                    <div className="flex items-center gap-2 truncate pr-4">
                        {isError ? <AlertCircle size={14} /> : isComplete ? <CheckCircle size={14} /> : <Download size={14} className="animate-bounce" />}
                        <span className="truncate">
                            {isError ? 'Pull Failed:' : isComplete ? 'Pull Complete:' : 'Downloading:'} <span className="text-gray-400 font-mono">{pullState.image}</span>
                        </span>
                        {!isComplete && !isError && <span className="text-gray-500 font-mono hidden sm:inline"> - {pullState.status}</span>}
                    </div>
                    <span className="font-mono font-bold whitespace-nowrap">{pullState.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-accent'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pullState.percent}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
