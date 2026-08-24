import { forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, htmlFor, error, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive text-red-500 font-bold dark:text-red-400">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, required, hint, className, id, ...props }, ref) => (
    <FormField label={label} htmlFor={id} error={error} required={required} hint={hint}>
      <Input
        id={id}
        ref={ref}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        {...props}
      />
    </FormField>
  )
);
FormInput.displayName = 'FormInput';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, required, hint, className, id, ...props }, ref) => (
    <FormField label={label} htmlFor={id} error={error} required={required} hint={hint}>
      <Textarea
        id={id}
        ref={ref}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        {...props}
      />
    </FormField>
  )
);
FormTextarea.displayName = 'FormTextarea';
