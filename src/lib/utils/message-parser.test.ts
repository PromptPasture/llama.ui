import { describe, expect, it } from 'vitest';
import { filterThoughtFromMsgs, splitMessageContent } from './message-parser';
import type { InferenceApiMessage } from '../types';

describe('splitMessageContent', () => {
  it('passes null through untouched', () => {
    expect(splitMessageContent(null)).toEqual({ content: null });
  });

  it('leaves blank content alone rather than reporting empty reasoning', () => {
    expect(splitMessageContent('')).toEqual({ content: '' });
    expect(splitMessageContent('   ')).toEqual({ content: '   ' });
  });

  it('reports no reasoning for a plain message', () => {
    expect(splitMessageContent('hello')).toEqual({
      content: 'hello',
      reasoning_content: '',
    });
  });

  it('separates a <think> block from the answer', () => {
    expect(
      splitMessageContent('<think>weighing it up</think>the answer')
    ).toEqual({ content: 'the answer', reasoning_content: 'weighing it up' });
  });

  it('keeps text on both sides of a <think> block', () => {
    expect(splitMessageContent('before<think>hmm</think>after')).toEqual({
      content: 'beforeafter',
      reasoning_content: 'hmm',
    });
  });

  it('treats an unterminated <think> as reasoning all the way to the end', () => {
    expect(splitMessageContent('<think>still going')).toEqual({
      content: '',
      reasoning_content: 'still going',
    });
  });

  it('accumulates several <think> blocks without dropping the tail', () => {
    expect(
      splitMessageContent('<think>a</think>mid<think>b</think>end')
    ).toEqual({ content: 'midend', reasoning_content: 'ab' });
  });

  it('keeps the answer when reasoning is interleaved three times', () => {
    expect(
      splitMessageContent(
        '<think>1</think>x<think>2</think>y<think>3</think>done'
      )
    ).toEqual({ content: 'xydone', reasoning_content: '123' });
  });

  it('understands the harmony channel markers', () => {
    const raw =
      '<|channel|>analysis<|message|>thinking<|start|>assistant<|channel|>final<|message|>answer';
    expect(splitMessageContent(raw)).toEqual({
      content: 'answer',
      reasoning_content: 'thinking',
    });
  });
});

describe('filterThoughtFromMsgs', () => {
  it('strips reasoning from assistant turns', () => {
    const messages: InferenceApiMessage[] = [
      { role: 'assistant', content: '<think>private</think>public' },
    ];
    expect(filterThoughtFromMsgs(messages)).toEqual([
      { role: 'assistant', content: 'public' },
    ]);
  });

  it('leaves user turns untouched', () => {
    const messages: InferenceApiMessage[] = [
      { role: 'user', content: '<think>not mine to strip</think>hi' },
    ];
    expect(filterThoughtFromMsgs(messages)).toEqual(messages);
  });

  it('substitutes an empty string when a turn is nothing but reasoning', () => {
    const messages: InferenceApiMessage[] = [
      { role: 'assistant', content: '<think>only reasoning' },
    ];
    expect(filterThoughtFromMsgs(messages)).toEqual([
      { role: 'assistant', content: '' },
    ]);
  });
});
