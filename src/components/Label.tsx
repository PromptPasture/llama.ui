import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils/css-helpers';

const LabelVariants = cva('', {
  variants: {
    variant: {
      default: '',
      'group-title': 'block font-bold text-base-content text-start',
      'fake-btn': 'text-center cursor-pointer',
      btn: 'btn',
      'btn-ghost': 'btn btn-ghost',
      'form-control': 'form-control flex flex-col justify-center',
      'input-bordered':
        'input input-bordered join-item grow flex items-center gap-2 focus-within:outline-1 focus-within:outline-offset-0 inset-shadow-xs',
    },
    size: {
      default: '',
      xs: 'text-xs',
      icon: 'w-8 h-8 p-0',
      'icon-xl': 'w-8 h-8 p-0 rounded-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> &
  VariantProps<typeof LabelVariants>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, size, ...props }, ref) => (
    <label
      className={cn(LabelVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
