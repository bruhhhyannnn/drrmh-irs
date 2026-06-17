import { cn } from '@/lib';
import Image from 'next/image';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  center?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'h-15 w-15',
  md: 'h-17 w-17',
  lg: 'h-19 w-19',
};

export function Spinner({ size = 'md', center = false, className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'relative flex animate-bounce items-center justify-center',
        center && 'mx-auto',
        sizeMap[size],
        className
      )}
    >
      <Image
        src="/irs-logo.png"
        alt="DRRM-H Logo"
        sizes="(max-width: 768px) 48px, 64px"
        className="object-contain"
        fill
      />
      <div className="absolute inset-0 animate-spin rounded-full bg-linear-to-tr from-35% to-white blur-xs dark:to-gray-900" />
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <p className="text-error-500 text-sm">{message}</p>
    </div>
  );
}
