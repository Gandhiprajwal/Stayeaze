import { useEffect, useCallback } from 'react';

/**
 * Custom React hook that prevents accidental loss of form inputs.
 * Warns the user on browser tab close or modal dismissal when isDirty is true.
 */
export function useDirtyFormGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const confirmDismiss = useCallback((onConfirm: () => void) => {
    if (!isDirty) {
      onConfirm();
      return;
    }
    const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
    if (confirmed) {
      onConfirm();
    }
  }, [isDirty]);

  return { confirmDismiss };
}
