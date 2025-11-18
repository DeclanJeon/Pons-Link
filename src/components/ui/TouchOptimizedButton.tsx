// src/components/ui/TouchOptimizedButton.tsx

import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';

export const TouchOptimizedButton = ({ 
  className, 
  children, 
  ...props 
}: ButtonProps) => {
  const { isMobile } = useDeviceType();
  
  return (
    <Button
      className={cn(
        isMobile && "min-w-[44px] min-h-[44px] p-3",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};
