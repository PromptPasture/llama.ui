import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils/css-helpers';

const inputVariants = cva('', {
  variants: {
    variant: {
      text: '',
      file: '',
      input: 'input',
      bordered: 'input input-bordered',
      toggle: 'toggle',
      range: 'range',
    },
    size: {},
  },
});

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, ...props }, ref) => {
    let type = props.type;
    if (!type) {
      switch (variant) {
        case 'file':
          type = 'file';
          break;
        case 'toggle':
          type = 'checkbox';
          break;
        case 'range':
          type = 'range';
          break;
        default:
          type = 'text';
      }
    }

    return (
      <input
        className={cn(inputVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
