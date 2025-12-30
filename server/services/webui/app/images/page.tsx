"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { fetchApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Trash2, Download, Search, RefreshCw, Star, Shield, X, Calendar, HardDrive, Info, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/LoadingSpinner';
import PullProgress from '@/components/PullProgress';

const POPULAR_IMAGES = [
    'nginx', 'redis', 'postgres', 'mysql', 'mongo',
    'ubuntu', 'node', 'python', 'alpine', 'traefik',
    'caddy', 'httpd', 'mariadb', 'memcached', 'rabbitmq'
];

interface DockerHubImage {
    name: string;
    description: string;
    star_count: number;
    pull_count: number;
    is_official: boolean;
    is_automated: boolean;
}

interface ImageDetailsProps {
    image: any;
    isDockerHub: boolean;
    secretKey: string; // Add secretKey prop
    onClose: () => void;
    onPull: (imageName: string) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (imageName: string) => void;
}

function ImageDetailsModal({ image, isDockerHub, secretKey, onClose, onPull, onDelete, onUpdate }: ImageDetailsProps) {
    const [tags, setTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState('latest');
    const [loadingTags, setLoadingTags] = useState(false);
    const [hasUpdate, setHasUpdate] = useState(false);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [hubDate, setHubDate] = useState<string | null>(null);
    const [fullDescription, setFullDescription] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLocalOnly, setIsLocalOnly] = useState(false);

    useEffect(() => {
        if (isDockerHub) {
            // Logic for Docker Hub Search Result
            setLoadingTags(true);
            const name = image.name || image.repo_name || '';
            const imageNameParts = name.includes('/') ? name.split('/') : ['library', name];
            const owner = imageNameParts.length === 2 ? imageNameParts[0] : 'library';
            const repo = imageNameParts.length === 2 ? imageNameParts[1] : imageNameParts[0];

            if (!repo) {
                console.error('Invalid image name:', image);
                setLoadingTags(false);
                return;
            }

            // Fetch Tags
            fetch(`/api/dockerhub/tags/${owner}/${repo}?page_size=20`, {
                headers: { 'x-secret-key': secretKey }
            })
                .then(res => res.json())
                .then(data => {
                    const tagNames = (data.results || []).map((t: any) => t.name);
                    setTags(tagNames);
                    if (tagNames.includes('latest')) setSelectedTag('latest');
                    else if (tagNames.length > 0) setSelectedTag(tagNames[0]);
                })
                .catch(err => console.error('Failed to load tags:', err))
                .finally(() => setLoadingTags(false));

            // Fetch Repo Overview
            fetch(`/api/dockerhub/repo/${owner}/${repo}`, {
                headers: { 'x-secret-key': secretKey }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.full_description) setFullDescription(data.full_description);
                })
                .catch(e => console.error('Failed to load repo info:', e));

        } else {
            // Logic for Local Image (Check for updates)
            if (image.RepoTags && image.RepoTags.length > 0) {
                const fullTag = image.RepoTags[0]; // e.g., nginx:latest
                const [repoName, tag] = fullTag.includes(':') ? fullTag.split(':') : [fullTag, 'latest'];
                const currentTag = tag;

                // Clean up repo name (handle library/ prefix implicit)
                const cleanRepo = repoName.includes('/') ? repoName : `library/${repoName}`;
                const [owner, repo] = cleanRepo.split('/');

                setCheckingUpdate(true);

                // Check for updates via Tags API
                fetch(`/api/dockerhub/tags/${owner}/${repo}?page_size=10`, {
                    headers: { 'x-secret-key': secretKey }
                })
                    .then(res => {
                        if (res.status === 404) {
                            setIsLocalOnly(true);
                            throw new Error('Image not found on Docker Hub');
                        }
                        return res.json();
                    })
                    .then(data => {
                        const tagData = (data.results || []).find((t: any) => t.name === currentTag);
                        if (tagData) {
                            const hubTime = new Date(tagData.last_updated).getTime();
                            const localTime = image.Created * 1000;

                            if (hubTime > localTime + 3600000) {
                                setHasUpdate(true);
                                setHubDate(tagData.last_updated);
                            }
                        }
                    })
                    .catch(() => {/* Ignore if cant check update or not found */ })
                    .finally(() => setCheckingUpdate(false));

                // Fetch Repo Overview for Local Image
                if (!isLocalOnly) {
                    fetch(`/api/dockerhub/repo/${owner}/${repo}`, {
                        headers: { 'x-secret-key': secretKey }
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.full_description) setFullDescription(data.full_description);
                        })
                        .catch(() => { /* Ignore if not found on Hub */ });
                }
            }
        }
    }, [image, isDockerHub, secretKey]);

    const formatNumber = (num: number) => {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatBytes = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' B';
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#1a1a1a] z-10 border-b border-white/10 p-6 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                            {isDockerHub ? image.name : (image.RepoTags?.[0] || image.Id.substring(0, 12))}
                        </h2>
                        {isDockerHub && image.is_official && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
                                <Shield size={12} /> Official Image
                            </span>
                        )}
                        {!isDockerHub && hasUpdate && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/20">
                                <AlertTriangle size={12} /> Update Available
                            </span>
                        )}
                        {!isDockerHub && isLocalOnly && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500/10 text-gray-400 text-xs font-medium rounded-full border border-gray-500/20">
                                <HardDrive size={12} /> Local Image
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8">
                    {isDockerHub ? (
                        // Docker Hub View
                        <div className="space-y-6">
                            <div className="flex items-center gap-8 text-sm">
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Stars</span>
                                    <div className="flex items-center gap-2 text-white font-mono text-lg">
                                        <Star size={18} className="text-yellow-500 fill-yellow-500" />
                                        {formatNumber(image.star_count)}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Downloads</span>
                                    <div className="flex items-center gap-2 text-white font-mono text-lg">
                                        <Download size={18} className="text-cyan-400" />
                                        {formatNumber(image.pull_count)}
                                    </div>
                                </div>
                            </div>

                            {/* Overview */}
                            <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex items-center gap-2">
                                    <Info size={16} className="text-gray-400" />
                                    <h3 className="text-sm font-semibold text-white">Overview</h3>
                                </div>

                                <div className="p-5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {fullDescription ? (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm">{fullDescription}</pre>
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 text-sm leading-relaxed">
                                            {image.description || "No description provided."}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-4">Select Tag to Pull</h3>
                                {loadingTags ? (
                                    <div className="py-6 flex justify-center">
                                        <LoadingSpinner size={24} message="Fetching tags..." />
                                    </div>
                                ) : tags.length > 0 ? (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span className="font-mono">{selectedTag}</span>
                                            <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isDropdownOpen && (
                                            <div className="mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                                {tags.map(tag => (
                                                    <button
                                                        key={tag}
                                                        onClick={() => {
                                                            setSelectedTag(tag);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-3 text-sm font-mono hover:bg-white/5 transition-colors ${selectedTag === tag ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-300'}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-500 text-sm italic border border-dashed border-white/10 rounded-lg">
                                        No tags information available.
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => onPull(`${image.name}:${selectedTag}`)}
                                className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center justify-center gap-3"
                            >
                                <Download size={20} />
                                Pull Image <span className="bg-black/20 px-2 py-0.5 rounded text-sm font-mono">{selectedTag}</span>
                            </button>
                        </div>
                    ) : (
                        // Local Image View
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2 text-xs uppercase tracking-wider font-semibold">
                                        <HardDrive size={14} />
                                        Virtual Size
                                    </div>
                                    <p className="text-white text-xl font-mono">{formatBytes(image.Size)}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2 text-xs uppercase tracking-wider font-semibold">
                                        <Calendar size={14} />
                                        Created On
                                    </div>
                                    <p className="text-white text-lg">
                                        {new Date(image.Created * 1000).toLocaleDateString()}
                                    </p>
                                    <span className="text-xs text-gray-500">
                                        {new Date(image.Created * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>

                            {/* Update Section */}
                            {onUpdate && hasUpdate && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                                            <RefreshCw size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-yellow-400 font-bold text-lg mb-1">Newer Version Available</h3>
                                            <p className="text-yellow-200/70 text-sm mb-4">
                                                A newer version of this image was pushed to Docker Hub on
                                                <span className="font-semibold text-yellow-200 ml-1">
                                                    {hubDate ? new Date(hubDate).toLocaleDateString() : 'Unknown'}
                                                </span>.
                                            </p>
                                            <button
                                                onClick={() => onUpdate(image.RepoTags[0])}
                                                className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors text-sm flex items-center gap-2"
                                            >
                                                <Download size={16} />
                                                Update Image
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {image.RepoTags && image.RepoTags.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3 ml-1">Tags</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {image.RepoTags.map((tag: string) => (
                                            <span key={tag} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 font-mono">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-semibold text-gray-300 mb-3 ml-1">Image ID</h3>
                                <code className="block w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-xs text-gray-400 font-mono break-all select-all">
                                    {image.Id}
                                </code>
                            </div>

                            {onDelete && (
                                <button
                                    onClick={() => {
                                        toast.custom((t) => (
                                            <div className="bg-[#1a1a1a] border border-red-500/30 rounded-xl p-4 shadow-xl w-80">
                                                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                                    <Trash2 size={16} /> Delete Image?
                                                </h3>
                                                <p className="text-gray-400 text-sm mb-4">
                                                    Are you sure you want to delete <span className="text-white font-mono bg-white/5 px-1 rounded">{image.RepoTags?.[0] || 'this image'}</span>? This cannot be undone.
                                                </p>
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => toast.dismiss(t)}
                                                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            onDelete(image.Id);
                                                            onClose();
                                                            toast.dismiss(t);
                                                        }}
                                                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-medium transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ), { duration: 5000 });
                                    }}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    Delete Image
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function ImagesPage() {
    const { secretKey } = useAuth();
    const [images, setImages] = useState<any[]>([]);
    const [pulling, setPulling] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DockerHubImage[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [isDockerHubImage, setIsDockerHubImage] = useState(false);

    const load = async (silent = false) => {
        try {
            if (typeof silent !== 'boolean' || !silent) setLoading(true);
            const data = await fetchApi('/images', secretKey);
            setImages(data);
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

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const response = await fetch(
                    `/api/dockerhub/search?query=${encodeURIComponent(searchQuery)}&page_size=10`,
                    {
                        headers: { 'x-secret-key': secretKey || '' }
                    }
                );
                const data = await response.json();
                const results = (data.results || []).map((r: any) => ({ ...r, name: r.repo_name }));
                setSearchResults(results);
            } catch (e) {
                console.error('Search failed:', e);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const recommendedImages = searchQuery.trim()
        ? POPULAR_IMAGES.filter(img => img.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const handlePull = async (imageName: string) => {
        setPulling(true);
        toast.info("Pull Initiated", { description: `Requesting pull for ${imageName}...` });

        try {
            await fetchApi('/images/pull', secretKey, {
                method: 'POST',
                body: JSON.stringify({ image: imageName })
            });
            toast.success("Pull Started", {
                description: `${imageName} is being pulled in background. Watch the sidebar for progress!`,
                duration: 5000
            });
            setSearchQuery('');
            setSelectedImage(null);
        } catch (e: any) {
            toast.error("Pull Failed", { description: e.message || 'Unknown error occurred' });
        } finally {
            setPulling(false);
        }
    };

    const handleUpdate = (imageName: string) => {
        toast.custom((t) => (
            <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-xl p-4 shadow-xl w-80">
                <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                    <RefreshCw size={16} /> Confirm Update
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                    This will delete the existing image
                    <span className="text-white font-mono bg-white/5 px-1 rounded ml-1 mr-1">{imageName}</span>
                    and pull the latest version from Docker Hub. Containers using this image will NOT be automatically recreated.
                </p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => toast.dismiss(t)}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(t);
                            performUpdate(imageName);
                        }}
                        className="px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg font-medium transition-colors"
                    >
                        Update
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    const performUpdate = async (imageName: string) => {
        // 1. Delete
        const image = images.find(img => img.RepoTags?.includes(imageName));
        if (image) {
            try {
                toast.loading(`Removing old ${imageName}...`, { id: 'update-process' });
                await fetchApi(`/images/${image.Id}?force=true`, secretKey, { method: 'DELETE' });

                // 2. Pull
                toast.loading(`Pulling new ${imageName}...`, { id: 'update-process' });
                await fetchApi('/images/pull', secretKey, {
                    method: 'POST',
                    body: JSON.stringify({ image: imageName })
                });

                toast.success("Update Started", {
                    id: 'update-process',
                    description: `Updating ${imageName}. Check sidebar for progress.`,
                });

                setSelectedImage(null);
                load();

            } catch (e: any) {
                toast.error("Update Failed", {
                    id: 'update-process',
                    description: e.message
                });
            }
        }
    }

    const handleRemove = async (id: string) => {
        const loadingToast = toast.loading("Deleting image...");
        try {
            await fetchApi(`/images/${id}?force=true`, secretKey, { method: 'DELETE' });
            toast.success("Image Deleted", { id: loadingToast });
            load();
        } catch (e: any) {
            toast.error("Delete Failed", { id: loadingToast, description: e.message });
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Images</h1>
                <button onClick={() => load()} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            <div className="mb-8 p-6 bg-card border border-border rounded-xl">
                <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                    <Search size={20} className="text-accent" /> Search & Pull Images
                </h2>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search Docker Hub or enter image:tag to pull (e.g., nginx:latest)..."
                        className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-lg focus:border-accent outline-none text-white"
                    />
                </div>

                <AnimatePresence mode="wait">
                    {searching ? (
                        <div className="mt-8 mb-8">
                            <LoadingSpinner size={32} message="Searching..." />
                        </div>
                    ) : searchQuery.trim() && (recommendedImages.length > 0 || searchResults.length > 0) ? (
                        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 space-y-4">
                            {recommendedImages.length > 0 && (
                                <div>
                                    <div className="text-sm text-gray-400 mb-2">Recommended</div>
                                    <div className="space-y-2">
                                        {recommendedImages.map(imageName => (
                                            <div
                                                key={imageName}
                                                className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => {
                                                    // Fetch details implicitly by selecting it
                                                    const mockHubImage = {
                                                        name: imageName,
                                                        description: 'Official Image',
                                                        star_count: 0,
                                                        pull_count: 0,
                                                        is_official: true,
                                                        is_automated: false
                                                    };
                                                    setSelectedImage(mockHubImage);
                                                    setIsDockerHubImage(true);
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-purple-500/10 p-2 rounded-lg">
                                                        <Layers size={18} className="text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{imageName}</div>
                                                        <div className="text-xs text-gray-500">Official Image</div>
                                                    </div>
                                                </div>
                                                <button className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent font-semibold rounded-lg transition-colors text-sm">
                                                    View Details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchResults.length > 0 && (
                                <div>
                                    <div className="text-sm text-gray-400 mb-2">{searchResults.length} results found</div>
                                    <div className="space-y-2">
                                        {searchResults.map(result => (
                                            <div
                                                key={result.name}
                                                className="flex items-start justify-between p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setSelectedImage(result);
                                                    setIsDockerHubImage(true);
                                                }}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="font-medium text-white truncate">{result.name}</div>
                                                        {result.is_official && (
                                                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                                                                <Shield size={12} /> Official
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                                                        {result.description || 'No description available'}
                                                    </p>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Star size={12} className="text-yellow-500" />
                                                            {formatNumber(result.star_count)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Download size={12} />
                                                            {formatNumber(result.pull_count)} pulls
                                                        </span>
                                                    </div>
                                                </div>
                                                <button className="ml-4 px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent font-semibold rounded-lg transition-colors text-sm shrink-0">
                                                    View Details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : searchQuery && !searching ? (
                        <div className="mt-4 text-center text-gray-500 py-8">
                            No results found for "{searchQuery}"
                        </div>
                    ) : null}
                </AnimatePresence>


                <PullProgress />
            </div>

            <h2 className="text-xl font-semibold text-white mb-4">Your Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((img) => {
                    const tags = img.RepoTags || [];
                    const sizeMB = (img.Size / 1024 / 1024).toFixed(2);

                    return (
                        <motion.div
                            key={img.Id}
                            layoutId={img.Id}
                            onClick={() => {
                                setSelectedImage(img);
                                setIsDockerHubImage(false);
                            }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02 }}
                            className="bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-all cursor-pointer shadow-sm hover:shadow-lg relative group"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toast.custom((t) => (
                                        <div className="bg-[#1a1a1a] border border-red-500/30 rounded-xl p-4 shadow-xl w-80">
                                            <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                                <Trash2 size={16} /> Delete Image?
                                            </h3>
                                            <p className="text-gray-400 text-sm mb-4">
                                                Are you sure you want to delete <span className="text-white font-mono bg-white/5 px-1 rounded">{img.RepoTags?.[0] || 'this image'}</span>? This cannot be undone.
                                            </p>
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => toast.dismiss(t)}
                                                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        toast.dismiss(t);
                                                        handleRemove(img.Id);
                                                    }}
                                                    className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-medium transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ), { duration: 5000 });
                                }}
                                className="absolute top-2 right-2 p-2 bg-black/20 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                            <div className="bg-purple-500/10 p-3 rounded-lg text-purple-400 w-fit mb-3">
                                <Layers size={24} />
                            </div>
                            <h3 className="font-semibold text-white mb-2 truncate" title={tags.join(', ')}>
                                {tags.length > 0 ? tags[0] : img.Id.substring(0, 12)}
                            </h3>
                            <div className="flex items-center justify-between text-sm text-gray-500">
                                <span>{sizeMB} MB</span>
                                <span className="text-accent">View Details →</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedImage && (
                    <ImageDetailsModal
                        image={selectedImage}
                        isDockerHub={isDockerHubImage}
                        secretKey={secretKey || ''}
                        onClose={() => setSelectedImage(null)}
                        onPull={handlePull}
                        onDelete={!isDockerHubImage ? handleRemove : undefined}
                        onUpdate={!isDockerHubImage ? handleUpdate : undefined}
                    />
                )}
            </AnimatePresence>
        </div >
    );
}


