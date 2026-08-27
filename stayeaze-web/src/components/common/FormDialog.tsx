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
  sm: 'max-w-md',
  md: 'max-w-lg sm:max-w-xl',
  lg: 'max-w-2xl sm:max-w-3xl lg:max-w-4xl',
  xl: 'max-w-3xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
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
      <DialogContent className={cn(sizeMap[size], 'w-[calc(100vw-2rem)] sm:w-full max-h-[calc(100vh-3.5rem)] flex flex-col rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl')}>
        <div className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20 shrink-0">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">{title}</DialogTitle>
            {description && <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>}
          </DialogHeader>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5">
            {children}
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl h-9 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || disabled}
              className="rounded-xl h-9 text-xs font-semibold shadow-sm"
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
