import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirm',
  cancelLabel = 'Cancel', variant = 'default', onConfirm, loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground mt-1.5">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading} className="rounded-xl h-10 text-xs sm:text-sm font-semibold mt-0">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={(e) => { e.preventDefault(); onConfirm(); }}
              disabled={loading}
              className="rounded-xl h-10 text-xs sm:text-sm font-bold shadow-xs"
            >
              {loading ? 'Please wait...' : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
