"use client";
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface ContainerTerminalProps {
    containerId: string;
    secretKey: string;
}

export default function ContainerTerminal({ containerId, secretKey }: ContainerTerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0A0A0A',
                foreground: '#FFFFFF',
                cursor: '#00E5FF',
            },
            rows: 30,
            cols: 100,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(
            `${protocol}//${window.location.host}/api/containers/${containerId}/exec?secretKey=${secretKey}`
        );

        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln('\x1b[32m✓ Connected to container\x1b[0m');
            term.writeln('');
        };

        ws.onmessage = (event) => {
            term.write(event.data);
        };

        ws.onerror = (error) => {
            term.writeln('\x1b[31m✗ Connection error\x1b[0m');
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            term.writeln('');
            term.writeln('\x1b[33m✗ Connection closed\x1b[0m');
        };

        // Send user input to WebSocket
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Handle window resize
        const handleResize = () => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
                const { rows, cols } = term;
                ws.send(JSON.stringify({ type: 'resize', rows, cols }));
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            ws.close();
            term.dispose();
        };
    }, [containerId, secretKey]);

    return (
        <div className="w-full h-full bg-[#0A0A0A] rounded-lg overflow-hidden border border-border">
            <div ref={terminalRef} className="w-full h-full p-4" />
        </div>
    );
}
