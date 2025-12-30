"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Box, Layers, HardDrive, MonitorSmartphone } from 'lucide-react';

import Link from 'next/link';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { secretKey } = useAuth();
  const [stats, setStats] = useState({ containers: 0, images: 0, volumes: 0, devices: 0 });
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [c, i, v, d, h] = await Promise.all([
          fetchApi('/containers', secretKey),
          fetchApi('/images', secretKey),
          fetchApi('/volumes', secretKey),
          fetchApi('/devices', secretKey),
          fetchApi('/system/history', secretKey)
        ]);

        if (!mounted) return;

        let volCount = 0;
        if (Array.isArray(v)) volCount = v.length;
        else if (v.Volumes) volCount = v.Volumes.length;

        setStats({
          containers: Array.isArray(c) ? c.length : 0,
          images: Array.isArray(i) ? i.length : 0,
          volumes: volCount,
          devices: Array.isArray(d) ? d.length : 0
        });

        if (Array.isArray(h)) {
          setHistory(h);
        }
      } catch (e) {
        console.error("Dashboard Load Error:", e);
      }
    };

    if (secretKey) {
      load();
      const interval = setInterval(load, 3000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }
  }, [secretKey]);

  const cards = [
    { title: 'Containers', value: stats.containers, icon: Box, color: 'text-blue-400', bg: 'bg-blue-400/10', path: '/containers' },
    { title: 'Images', value: stats.images, icon: Layers, color: 'text-purple-400', bg: 'bg-purple-400/10', path: '/images' },
    { title: 'Volumes', value: stats.volumes, icon: HardDrive, color: 'text-orange-400', bg: 'bg-orange-400/10', path: '/volumes' },
    { title: 'Devices', value: stats.devices, icon: MonitorSmartphone, color: 'text-emerald-400', bg: 'bg-emerald-400/10', path: '/devices' },
  ];

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-3xl font-bold mb-8 text-white"
      >
        Dashboard Overview
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, idx) => (
          <Link href={card.path} key={card.title} className="block group">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-6 rounded-xl bg-card border border-border group-hover:border-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">{card.title}</p>
                  <h3 className="text-3xl font-bold mt-2 text-white">{card.value}</h3>
                </div>
                <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                  <card.icon size={24} />
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-xl font-bold mb-6 text-white">System Activity (Last 24 Hours)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorContainers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorImages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c084fc" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t) => new Date(t).getHours() + ':00'}
                  stroke="#525252"
                  fontSize={12}
                />
                <YAxis stroke="#525252" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                />
                <Legend />
                <Area type="monotone" dataKey="containers" name="Containers" stroke="#60a5fa" fillOpacity={1} fill="url(#colorContainers)" />
                <Area type="monotone" dataKey="images" name="Images" stroke="#c084fc" fillOpacity={1} fill="url(#colorImages)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
