import { cva, VariantProps } from 'class-variance-authority';
import {
  ChangeEvent,
  forwardRef,
  TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../utils/css-helpers';
import { throttle } from '../utils/async-helpers';

const variants = cva('textarea min-h-auto resize-none', {
  variants: {
    variant: {
      bordered: 'focus:outline-1 focus:outline-offset-0 inset-shadow-xs',
      code: 'font-mono',
      transparent:
        'bg-transparent border-none outline-0 ring-0 focus:outline-0 focus:ring-0',
    },
    size: {
      default: 'h-24',
      full: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'bordered',
    size: 'default',
  },
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof variants>;

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, variant, size, ...props }, ref) => (
    <textarea
      className={cn(variants({ variant, size, className }))}
      ref={ref}
      dir="auto"
      {...props}
    />
  )
);
TextArea.displayName = 'TextArea';

const AutoSizingTextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ value: initial, onChange, ...props }, ref) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => textAreaRef.current!, []);

    const [value, setValue] = useState<
      string | number | readonly string[] | undefined
    >('');

    useEffect(() => {
      setValue(initial);
    }, [initial]);

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        setValue(event.target.value);
        if (onChange) onChange(event);
      },
      [onChange]
    );

    const adjustHeight = throttle((textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;

      // Only perform auto-sizing on large screens (matching Tailwind's xl: breakpoint)
      if (!window.matchMedia('(min-width: 1280px)').matches) {
        // On small screens, reset inline height and max-height styles.
        // This allows CSS (e.g., `rows` attribute or classes) to control the height,
        // and enables manual resizing if `resize-vertical` is set.
        textarea.style.height = ''; // Use 'auto' or '' to reset
        textarea.style.maxHeight = '';
        return; // Do not adjust height programmatically on small screens
      }

      const computedStyle = window.getComputedStyle(textarea);
      // Get the max-height specified by CSS (e.g., from `xl:max-h-48`)
      const currentMaxHeight = computedStyle.maxHeight;

      // Temporarily remove max-height to allow scrollHeight to be calculated correctly
      textarea.style.maxHeight = 'none';
      // Reset height to 'auto' to measure the actual scrollHeight needed
      textarea.style.height = 'auto';
      // Set the height to the calculated scrollHeight
      textarea.style.height = textarea.scrollHeight + 2 + 'px';
      // Re-apply the original max-height from CSS to enforce the limit
      textarea.style.maxHeight = currentMaxHeight;
    }, 100);

    useLayoutEffect(() => {
      adjustHeight(textAreaRef?.current);
    }, [adjustHeight, ref, value]);

    return (
      <TextArea
        ref={textAreaRef}
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
AutoSizingTextArea.displayName = 'AutoSizingTextArea';

export { AutoSizingTextArea, TextArea };
