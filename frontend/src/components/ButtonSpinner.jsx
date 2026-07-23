import { Loader2 } from 'lucide-react';

export default function ButtonSpinner({ size = 'h-4 w-4', className = '' }) {
  return (
    <Loader2
      className={`animate-spin shrink-0 ${size} ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingButtonContent({ loading, loadingText, children, spinnerSize }) {
  if (!loading) return children;
  return (
    <>
      <ButtonSpinner size={spinnerSize} />
      {loadingText}
    </>
  );
}
