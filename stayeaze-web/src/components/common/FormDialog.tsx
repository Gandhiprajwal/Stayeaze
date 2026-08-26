import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const sizeMap = {
  sm: 'w-[95vw] sm:max-w-md',
  md: 'w-[95vw] sm:max-w-lg',
  lg: 'w-[95vw] sm:max-w-2xl',
  xl: 'w-[95vw] sm:max-w-4xl',
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  loading,
  disabled,
  submitLabel = 'Save',
  size = 'md',
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeMap[size], 'rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl')}>
        <div className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-bold text-foreground">{title}</DialogTitle>
            {description && <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>}
          </DialogHeader>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col"
        >
          <div className="max-h-[65vh] sm:max-h-[70vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            {children}
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-border/60 bg-muted/10 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl h-9.5 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || disabled}
              className="rounded-xl h-9.5 text-xs font-semibold shadow-sm"
            >
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
