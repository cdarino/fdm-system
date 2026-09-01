'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function ComingSoonModal({ isOpen, onClose, title = 'Coming Soon!' }: ComingSoonModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <Card
        className="w-full max-w-sm bg-white border-[#E2E7EC] rounded-2xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-[#FFF9E5] rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-[#F5CE42]" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-[#1A1D20] mb-2">{title}</h2>

          {/* Message */}
          <p className="text-[#6C7E8E] text-sm mb-6">
            This feature is currently under development and will be available soon.
          </p>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#5BC4E7] hover:bg-[#3AAFE0] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </Card>
    </div>,
    document.body
  );
}