"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Calendar, HardDrive, Layers, Plus } from 'lucide-react';
import { getImages, deleteImage, formatBytes, Image } from '@/lib/apiClient';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ImageDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { secretKey } = useAuth();
    const imageId = params.id as string;

    const [image, setImage] = useState<Image | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const loadImage = async () => {
        if (!secretKey) return;
        try {
            const images = await getImages(secretKey);
            const found = images.find((img) => img.Id === imageId || img.Id.startsWith(imageId));
            if (found) {
                setImage(found);
            } else {
                toast.error('Image not found');
                router.push('/images');
            }
        } catch (error: any) {
            toast.error(`Failed to load image: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadImage();
    }, [secretKey, imageId]);

    const handleDelete = async () => {
        if (!secretKey || !image) return;
        try {
            await deleteImage(image.Id, secretKey);
            toast.success('Image deleted');
            router.push('/images');
        } catch (error: any) {
            toast.error(`Failed to delete image: ${error.message}`);
        }
    };

    if (loading || !image) {
        return <LoadingSpinner fullScreen message="Loading image details..." />;
    }

    const primaryTag = image.RepoTags?.[0] || 'none';
    const createdDate = new Date(image.Created * 1000);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/images')}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{primaryTag}</h1>
                        <p className="text-gray-400 text-sm mt-1">Image ID: {image.Id.substring(0, 12)}</p>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Link href={`/containers/create?image=${encodeURIComponent(primaryTag)}`}>
                    <button className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg transition-colors flex items-center gap-2">
                        <Plus size={16} />
                        Create Container
                    </button>
                </Link>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg transition-colors flex items-center gap-2"
                >
                    <Trash2 size={16} />
                    Delete Image
                </button>
            </div>

            {/* Image Details */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <h2 className="text-xl font-semibold text-white">Image Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <HardDrive size={16} />
                            <span className="text-sm">Size</span>
                        </div>
                        <p className="text-white font-semibold text-lg">{formatBytes(image.Size)}</p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <Calendar size={16} />
                            <span className="text-sm">Created</span>
                        </div>
                        <p className="text-white font-semibold text-lg">
                            {createdDate.toLocaleDateString()} {createdDate.toLocaleTimeString()}
                        </p>
                    </div>
                </div>

                {/* Tags */}
                {image.RepoTags && image.RepoTags.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                            <Layers size={16} />
                            <h3 className="text-sm font-semibold">Tags</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {image.RepoTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm font-mono"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Image ID */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Full Image ID</h3>
                    <code className="block px-4 py-3 bg-black/30 rounded-lg text-xs text-gray-300 font-mono break-all">
                        {image.Id}
                    </code>
                </div>
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete Image"
                message={`Are you sure you want to delete "${primaryTag}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}
