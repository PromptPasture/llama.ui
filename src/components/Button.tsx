import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils/css-helpers';

const ButtonVariants = cva('btn', {
  variants: {
    variant: {
      default: '',
      neutral: 'btn-neutral',
      ghost: 'btn-ghost',
      error: 'btn-error',
      'menu-item': 'btn-ghost border-none font-normal justify-start',
    },
    size: {
      default: '',
      small: 'btn-sm',
      icon: 'w-8 h-8 p-0',
      'icon-sm': 'btn-sm w-4 h-4 p-0 rounded-full',
      'icon-md': 'btn-sm w-5 h-5 p-0 rounded-full',
      'icon-xl': 'w-8 h-8 p-0 rounded-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof ButtonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      type="button"
      className={cn(ButtonVariants({ variant, size, className }))}
      ref={ref}
      dir="auto"
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button };
