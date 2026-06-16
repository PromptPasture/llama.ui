import daisyuiThemes from 'daisyui/theme/object';
import highlightThemes from './highlight.js-themes.json';

/**
 * List of available UI themes supported by DaisyUI
 * @constant
 * @type {readonly string[]}
 * @description Array of theme names with 'light' and 'dark' always at the beginning,
 * followed by all other DaisyUI themes excluding light/dark
 */
export const THEMES: readonly string[] = Object.freeze(
  ['light', 'dark']
    // make sure light & dark are always at the beginning
    .concat(
      Object.keys(daisyuiThemes).filter((t) => t !== 'light' && t !== 'dark')
    )
);

/**
 * List of syntax highlighting themes supported by Highlight.js
 * @constant
 * @type {readonly string[]}
 * @description Array of theme names available for code syntax highlighting
 */
export const SYNTAX_THEMES: readonly string[] = Object.freeze(highlightThemes);
