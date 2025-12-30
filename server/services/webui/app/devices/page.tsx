"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, Monitor, Clock, ToggleLeft, ToggleRight, Check, X, AlertCircle, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

interface Device {
    ip: string;
    deviceId: string;
    deviceName: string;
    userAgent: string;
    lastSeen: number;
    fails: number;
    banUntil: number;
    approved: boolean;
    isCurrent?: boolean;
}

export default function DevicesPage() {
    const { secretKey } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [approvalMode, setApprovalMode] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async (silent = false) => {
        try {
            if (typeof silent !== 'boolean' || !silent) setLoading(true);
            const [devs, settings] = await Promise.all([
                fetchApi('/devices', secretKey),
                fetchApi('/devices/settings', secretKey)
            ]);
            setDevices(devs);
            if (settings) setApprovalMode(settings.approvalMode);
        } catch (e) {
            console.error(e);
        } finally {
            if (typeof silent !== 'boolean' || !silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (secretKey) {
            load(false);
            const interval = setInterval(() => load(true), 3000);
            return () => clearInterval(interval);
        }
    }, [secretKey]);

    const toggleBlock = async (device: Device) => {
        const isBanned = device.banUntil > Date.now();
        const action = isBanned ? 'unblock' : 'block';
        try {
            await fetchApi(`/devices/${action}`, secretKey, {
                method: 'POST',
                body: JSON.stringify({ ip: device.ip })
            });
            load();
        } catch (e: any) {
            alert(`Failed: ${e.message || e}`);
        }
    };

    const approveDevice = async (device: Device) => {
        try {
            await fetchApi('/devices/approve', secretKey, {
                method: 'POST',
                body: JSON.stringify({ ip: device.ip })
            });
            load();
        } catch (e) {
            alert(`Failed to approve: ${e}`);
        }
    };

    const deleteDevice = async (device: Device) => {
        if (!confirm(`Delete device ${device.deviceName} (${device.ip})?`)) return;
        try {
            await fetchApi('/devices/delete', secretKey, {
                method: 'POST',
                body: JSON.stringify({ ip: device.ip })
            });
            load();
        } catch (e: any) {
            alert(`Failed: ${e.message || e}`);
        }
    };

    const toggleApprovalMode = async () => {
        if (!approvalMode) {
            // Turning ON - Ask for confirmation
            toast.custom((t) => (
                <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-xl p-4 shadow-xl w-80">
                    <h3 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
                        <ShieldCheck size={16} /> Enable Approval Mode?
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                        This will <span className="text-white font-bold">block all new devices</span> from connecting until you manually approve them. Existing connections will remain active.
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => toast.dismiss(t)}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                toast.dismiss(t);
                                await performToggle(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded-lg font-medium transition-colors"
                        >
                            Enable
                        </button>
                    </div>
                </div>
            ), { duration: Infinity });
        } else {
            // Turning OFF - Just do it
            await performToggle(false);
        }
    };

    const performToggle = async (newState: boolean) => {
        try {
            await fetchApi('/devices/settings', secretKey, {
                method: 'POST',
                body: JSON.stringify({ enabled: newState })
            });
            setApprovalMode(newState);
            toast.success(`Approval Mode ${newState ? 'Enabled' : 'Disabled'}`);
        } catch (e) {
            toast.error(`Failed to update settings: ${e}`);
        }
    };

    // Grouping
    const now = Date.now();
    const blocked = devices.filter(d => d.banUntil > now);
    const pending = devices.filter(d => !d.approved && d.banUntil <= now);
    const active = devices.filter(d => d.approved && d.banUntil <= now);

    const DeviceTable = ({ list, type }: { list: Device[], type: 'pending' | 'active' | 'blocked' }) => (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
            <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white capitalize">{type} Devices ({list.length})</h3>
                {type === 'pending' && list.length > 0 && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">Action Required</span>}
            </div>
            {list.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">No {type} devices</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border text-xs text-gray-500 uppercase">
                                <th className="p-4">Device</th>
                                <th className="p-4">IP & User Agent</th>
                                <th className="p-4">Last Seen</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {list.map(device => (
                                <tr key={device.ip} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-sidebar rounded-lg">
                                                <Monitor size={18} className="text-accent" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{device.deviceName}</p>
                                                <p className="text-xs text-gray-500">{device.deviceId}</p>
                                                {device.isCurrent && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">YOU</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-mono text-sm text-gray-300">{device.ip}</p>
                                        <p className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={device.userAgent}>
                                            {device.userAgent}
                                        </p>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">
                                        {new Date(device.lastSeen).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                        {type === 'pending' && (
                                            <button
                                                onClick={() => approveDevice(device)}
                                                className="px-3 py-1.5 bg-success/20 text-success hover:bg-success/30 rounded text-xs font-semibold"
                                            >
                                                Approve
                                            </button>
                                        )}
                                        {type !== 'blocked' && (
                                            <button
                                                onClick={() => toggleBlock(device)}
                                                disabled={device.isCurrent}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded text-xs font-semibold transition-colors",
                                                    device.isCurrent
                                                        ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                                        : "bg-danger/20 text-danger hover:bg-danger/30"
                                                )}
                                            >
                                                {device.isCurrent ? "Current" : "Block"}
                                            </button>
                                        )}
                                        {type === 'blocked' && (
                                            <button
                                                onClick={() => toggleBlock(device)}
                                                className="px-3 py-1.5 bg-gray-700 text-white hover:bg-gray-600 rounded text-xs font-semibold"
                                            >
                                                Unblock
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteDevice(device)}
                                            disabled={device.isCurrent}
                                            className={clsx("p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors", device.isCurrent && "opacity-50 cursor-not-allowed")}
                                            title="Delete Device"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Device Management</h1>
                    <p className="text-gray-400 mt-1">Manage access security and connected clients.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div
                        onClick={toggleApprovalMode}
                        className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <div className={clsx("p-1.5 rounded-full", approvalMode ? "bg-success/20 text-success" : "bg-gray-700 text-gray-400")}>
                            {approvalMode ? <ShieldCheck size={18} /> : <Shield size={18} />}
                        </div>
                        <div className="text-sm">
                            <p className="font-medium text-white">{approvalMode ? 'Approval Mode ON' : 'Approval Mode OFF'}</p>
                            <p className="text-xs text-gray-500">{approvalMode ? 'New devices waiting' : 'Auto-approve new'}</p>
                        </div>
                    </div>
                    <button onClick={() => load()} className="p-2 bg-card border border-border rounded-lg hover:bg-white/5">
                        <Clock size={20} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading devices...</div>
            ) : (
                <div className="space-y-2">
                    {pending.length > 0 && <DeviceTable list={pending} type="pending" />}
                    <DeviceTable list={active} type="active" />
                    {blocked.length > 0 && <DeviceTable list={blocked} type="blocked" />}
                </div>
            )}
        </div>
    );
}
