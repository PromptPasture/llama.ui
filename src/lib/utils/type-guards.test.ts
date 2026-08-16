import { describe, expect, it } from 'vitest';
import { isBoolean, isNumeric, isString } from './type-guards';

describe('isString', () => {
  it('accepts strings, including the empty one', () => {
    expect(isString('hello')).toBe(true);
    expect(isString('')).toBe(true);
  });

  it('rejects other types', () => {
    expect(isString(5)).toBe(false);
    expect(isString(true)).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString([])).toBe(false);
  });

  it('returns false for nullish input rather than throwing', () => {
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
  });

  it('rejects objects that merely carry a toLowerCase property', () => {
    expect(isString({ toLowerCase: () => 'not a string' })).toBe(false);
  });
});

describe('isBoolean', () => {
  it('accepts booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });

  it('rejects everything else, nullish included', () => {
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean(null)).toBe(false);
    expect(isBoolean(undefined)).toBe(false);
  });
});

describe('isNumeric', () => {
  it('accepts numbers', () => {
    expect(isNumeric(0)).toBe(true);
    expect(isNumeric(-1.5)).toBe(true);
  });

  it('rejects numeric strings, matching how config values are validated', () => {
    expect(isNumeric('5')).toBe(false);
  });

  it('rejects booleans and non-numeric values', () => {
    expect(isNumeric(true)).toBe(false);
    expect(isNumeric(NaN)).toBe(false);
    expect(isNumeric({})).toBe(false);
  });

  it('returns false for nullish input rather than throwing', () => {
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
  });
});
