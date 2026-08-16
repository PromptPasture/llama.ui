import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Input from './Input.svelte';
import InputHarness from './Input.harness.svelte';

describe('Input two-way binding', () => {
  it('writes typed text back to the bound value', async () => {
    const user = userEvent.setup();
    render(InputHarness, { props: { initial: '' } });

    await user.type(screen.getByRole('textbox'), 'hello');

    expect(screen.getByTestId('bound')).toHaveTextContent('hello');
  });

  it('shows the bound value the parent started with', () => {
    render(InputHarness, { props: { initial: 'preset' } });
    expect(screen.getByRole('textbox')).toHaveValue('preset');
  });

  it("still calls the caller's own oninput", async () => {
    const user = userEvent.setup();
    const oninput = vi.fn();
    render(InputHarness, { props: { initial: '', oninput } });

    await user.type(screen.getByRole('textbox'), 'ab');

    // Both the binding and the caller's handler must fire; SettingsField
    // depends on the handler while the prompt modal depends on the binding.
    expect(oninput).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('bound')).toHaveTextContent('ab');
  });
});

describe('Input type resolution', () => {
  it('defaults to a text input', () => {
    render(Input, { props: {} });
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
  });

  it('renders the toggle variant as a checkbox', () => {
    render(Input, { props: { variant: 'toggle' } });
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders the range variant as a slider', () => {
    render(Input, { props: { variant: 'range' } });
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('lets an explicit type override the variant default', () => {
    const { container } = render(Input, {
      props: { variant: 'toggle', type: 'text' },
    });
    expect(container.querySelector('input')).toHaveAttribute('type', 'text');
  });

  it('keeps the variant class alongside a caller-supplied class', () => {
    const { container } = render(Input, {
      props: { variant: 'bordered', class: 'extra' },
    });
    const input = container.querySelector('input');
    expect(input).toHaveClass('input--bordered');
    expect(input).toHaveClass('extra');
  });
});
