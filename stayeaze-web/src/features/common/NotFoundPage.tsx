import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-base text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
      <Button asChild className="mt-6">
        <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Dashboard</Link>
      </Button>
    </div>
  );
}
