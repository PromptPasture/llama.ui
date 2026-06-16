import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { IconBaseProps } from 'react-icons';
import { cn } from '../utils/css-helpers';

const iconVariants = cva('', {
  variants: {
    library: {
      lucide: 'lucide',
    },
    variant: {
      spin: 'animate-spin',
      current: 'fill-current',
      leftside: 'inline mr-1',
      rightside: 'inline ml-1',
    },
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      xl: 'h-8 w-8',
    },
  },
  defaultVariants: {
    library: 'lucide',
    size: 'sm',
  },
});

type IconProps = Omit<IconBaseProps, 'size'> &
  VariantProps<typeof iconVariants> &
  React.SVGAttributes<SVGSVGElement> & {
    className?: string;
    children: React.ReactElement<IconBaseProps>;
  };

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    if (!children) {
      throw new Error('Icon component requires a child icon element');
    }

    const iconElement = React.cloneElement(children, {
      className: cn(
        iconVariants({ variant, size, className }),
        children.props.className
      ),
      ref,
      ...props,
    });

    return iconElement;
  }
);

Icon.displayName = 'Icon';

export { Icon };
