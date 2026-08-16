import { format, unwrapFunctionStore } from 'svelte-i18n';

/**
 * Translates outside a Svelte component, where the `$_` store shorthand is not
 * available — state modules raise user-facing toasts and need the same
 * catalogue the components use.
 */
export const t = unwrapFunctionStore(format);
