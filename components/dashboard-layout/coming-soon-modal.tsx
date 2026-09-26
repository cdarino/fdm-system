'use client';

import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

/**
 * Built on the shadcn/Radix Dialog rather than a hand-rolled `createPortal`
 * overlay. The previous version opened a bare portal while a Radix dropdown was
 * closing, which could leave `pointer-events: none` on <body> and make the
 * whole page unclickable — testers reported the UI "crashing" after opening
 * Profile/Settings or the notification bell. Radix owns that lock and releases
 * it correctly.
 *
 * The original layout is kept deliberately: the Dialog's default padding, gap,
 * radius, surface and built-in close button are all overridden so this looks
 * exactly as it did before, only without the stuck-overlay bug.
 */
export function ComingSoonModal({ isOpen, onClose, title = 'This feature' }: ComingSoonModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 p-8 max-w-sm sm:max-w-sm bg-card border-border rounded-2xl"
      >
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-chart-4 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-accent-gold-foreground" />
          </div>

          {/* Title */}
          <DialogTitle className="text-xl font-bold text-foreground mb-2">Under development</DialogTitle>

          {/* Message */}
          <DialogDescription className="text-muted-foreground text-sm mb-6">
            {title} is currently under development and will be available soon.
          </DialogDescription>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)] text-primary-foreground text-sm font-medium rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
