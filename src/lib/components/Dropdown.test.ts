import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DropdownHarness from './Dropdown.harness.svelte';

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

const trigger = () => screen.getByRole('button', { name: 'Choose Model' });

describe('Dropdown opening and closing', () => {
  it('starts closed, advertising that it controls a listbox', () => {
    render(DropdownHarness, { props: { options: OPTIONS } });

    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on click and lists the options', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('closes again on a second click', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());
    await user.click(trigger());

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('Dropdown selection', () => {
  it('reports the chosen option and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(DropdownHarness, { props: { options: OPTIONS, onSelect } });

    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'Beta' }));

    expect(onSelect).toHaveBeenCalledWith({ value: 'b', label: 'Beta' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks the current option as selected', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, {
      props: { options: OPTIONS, selectedValue: 'c' },
    });

    await user.click(trigger());

    expect(screen.getByRole('option', { name: 'Gamma' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });
});

describe('Dropdown filtering', () => {
  const openFilterable = async (user: ReturnType<typeof userEvent.setup>) => {
    render(DropdownHarness, { props: { options: OPTIONS, filterable: true } });
    await user.click(trigger());
    return screen.getByPlaceholderText('Search Models...');
  };

  it('narrows the list to matching labels', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'et');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('matches regardless of case', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'GAMMA');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'zzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('clears the filter once an option is chosen', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'et');
    await user.click(screen.getByRole('option', { name: 'Beta' }));
    await user.click(trigger());

    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});

describe('Dropdown with too few options to choose from', () => {
  it('is not interactive when there is only one option', () => {
    render(DropdownHarness, { props: { options: [OPTIONS[0]] } });

    expect(
      screen.queryByRole('button', { name: 'Choose Model' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Choose Model')).toBeInTheDocument();
  });
});
