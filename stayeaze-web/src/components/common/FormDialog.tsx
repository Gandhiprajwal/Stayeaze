import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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
  open, onOpenChange, title, description, onSubmit, loading, disabled, submitLabel = 'Save', size = 'md', children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sizeMap[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        >
          {children}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || disabled}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
