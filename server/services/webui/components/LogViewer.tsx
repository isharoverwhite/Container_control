"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Trash2, Download } from 'lucide-react';

interface LogViewerProps {
    containerId: string;
}

export default function LogViewer({ containerId }: LogViewerProps) {
    const { socket } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket || !containerId) return;

        // Register log listener FIRST
        const handleLogChunk = (data: any) => {
            const chunk = typeof data === 'object' && data.chunk ? data.chunk : data.toString();
            setLogs((prev) => [...prev, chunk]);
        };

        socket.on('log_chunk', handleLogChunk);

        // Then subscribe to logs
        socket.emit('subscribe_logs', containerId);

        // Resubscribe on reconnect
        const handleReconnect = () => {
            socket.emit('subscribe_logs', containerId);
        };

        socket.on('connect', handleReconnect);

        // Cleanup
        return () => {
            socket.emit('unsubscribe_logs', containerId);
            socket.off('log_chunk', handleLogChunk);
            socket.off('connect', handleReconnect);
        };
    }, [socket, containerId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const clearLogs = () => {
        setLogs([]);
    };

    const downloadLogs = () => {
        const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `container-${containerId}-logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded border-border bg-background text-accent focus:ring-accent"
                        />
                        Auto-scroll
                    </label>
                    <span className="text-sm text-gray-500">
                        {logs.length} line{logs.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={downloadLogs}
                        disabled={logs.length === 0}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                        <Download size={14} />
                        Download
                    </button>
                    <button
                        onClick={clearLogs}
                        disabled={logs.length === 0}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                        <Trash2 size={14} />
                        Clear
                    </button>
                </div>
            </div>

            <div
                ref={logContainerRef}
                className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto font-mono text-sm text-gray-300 border border-border"
            >
                {logs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No logs yet. Waiting for output...
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className="whitespace-pre-wrap break-all">
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
