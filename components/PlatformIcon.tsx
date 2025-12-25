
import React from 'react';
import { MessageCircle, Send, Hash, Instagram } from 'lucide-react';
import { Platform } from '../types';

export const PlatformIcon: React.FC<{ platform: Platform; size?: number; className?: string }> = ({ platform, size = 20, className = "" }) => {
  switch (platform) {
    case Platform.WhatsApp: return <MessageCircle size={size} className={className + " text-green-500"} />;
    case Platform.Telegram: return <Send size={size} className={className + " text-blue-400"} />;
    case Platform.Discord: return <Hash size={size} className={className + " text-indigo-500"} />;
    case Platform.Instagram: return <Instagram size={size} className={className + " text-pink-500"} />;
    default: return null;
  }
};
