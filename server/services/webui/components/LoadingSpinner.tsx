"use client";
import React from 'react';

interface LoadingSpinnerProps {
    size?: number;
    message?: string;
    fullScreen?: boolean;
}

export default function LoadingSpinner({ size = 48, message, fullScreen = false }: LoadingSpinnerProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-6">
            {/* 2x2 Grid of squares with wave animation */}
            <div
                className="grid grid-cols-2 grid-rows-2 gap-1"
                style={{ width: size, height: size }}
            >
                {/* Upper Left - animates first */}
                <div
                    className="bg-accent rounded-sm animate-loader-scale w-full h-full"
                    style={{ animationDelay: '-0.3s' }}
                />

                {/* Upper Right - animates second */}
                <div
                    className="bg-accent rounded-sm animate-loader-scale w-full h-full"
                    style={{ animationDelay: '-0.1s' }}
                />

                {/* Lower Left - animates third */}
                <div
                    className="bg-accent rounded-sm animate-loader-scale w-full h-full"
                    style={{ animationDelay: '-0.2s' }}
                />

                {/* Lower Right - animates last */}
                <div
                    className="bg-accent rounded-sm animate-loader-scale w-full h-full"
                    style={{ animationDelay: '0s' }}
                />
            </div>

            {message && <p className="text-gray-400 text-sm">{message}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
                {content}
            </div>
        );
    }

    return content;
}
