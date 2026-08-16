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
  it('starts closed, advertising that it controls a popup', () => {
    render(DropdownHarness, { props: { options: OPTIONS } });

    expect(trigger()).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('opens on click and lists the options', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('closes again on a second click', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());
    await user.click(trigger());

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('Dropdown selection', () => {
  it('reports the chosen option and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(DropdownHarness, { props: { options: OPTIONS, onSelect } });

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Beta' }));

    expect(onSelect).toHaveBeenCalledWith({ value: 'b', label: 'Beta' });
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('marks the current option as selected', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, {
      props: { options: OPTIONS, selectedValue: 'c' },
    });

    await user.click(trigger());

    // aria-current rather than aria-selected: the latter is only meaningful
    // on an option inside a listbox, and these are buttons in a list.
    expect(screen.getByRole('button', { name: 'Gamma' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    // Absent rather than false: aria-current="false" is announced by some
    // readers as if it were a state worth mentioning.
    expect(screen.getByRole('button', { name: 'Alpha' })).not.toHaveAttribute(
      'aria-current'
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

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('matches regardless of case', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'GAMMA');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Gamma' })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'zzz');

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('clears the filter once an option is chosen', async () => {
    const user = userEvent.setup();
    const filter = await openFilterable(user);

    await user.type(filter, 'et');
    await user.click(screen.getByRole('button', { name: 'Beta' }));
    await user.click(trigger());

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
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

describe('Dropdown structure', () => {
  it('offers its options as buttons', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS } });

    await user.click(trigger());

    // role="option" replaces the implicit button role, and an option outside a
    // listbox means nothing. These are tabbed through, so buttons is what they
    // are.
    expect(
      screen.getAllByRole('button', { name: /Alpha|Beta|Gamma/ })
    ).toHaveLength(3);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('keeps the filter box out of the list of options', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS, filterable: true } });

    await user.click(trigger());

    // A listbox may hold options and nothing else; the filter used to sit
    // inside one.
    const list = screen.getByRole('list');
    expect(list.querySelector('input')).toBeNull();
  });

  it('puts the cursor in the filter box when it opens', async () => {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS, filterable: true } });

    await user.click(trigger());

    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});

describe('Dropdown keyboard movement', () => {
  const option = (name: string) => screen.getByRole('button', { name });

  async function openWith(props: Record<string, unknown> = {}) {
    const user = userEvent.setup();
    render(DropdownHarness, { props: { options: OPTIONS, ...props } });
    await user.click(trigger());
    return user;
  }

  it('starts on the first option', async () => {
    await openWith();

    // Opening puts the cursor in the panel, so the arrows have somewhere to
    // start and the panel hears the keys at all.
    expect(option('Alpha')).toHaveFocus();
  });

  it('starts on the option already chosen', async () => {
    await openWith({ selectedValue: 'c' });

    expect(option('Gamma')).toHaveFocus();
  });

  it('steps down the list', async () => {
    const user = await openWith();

    await user.keyboard('{ArrowDown}');
    expect(option('Beta')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(option('Gamma')).toHaveFocus();
  });

  it('steps back up', async () => {
    const user = await openWith();

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');

    expect(option('Beta')).toHaveFocus();
  });

  it('wraps around at either end', async () => {
    const user = await openWith();

    // Up from the first lands on the last, which is how the end of a long
    // list is reached without walking it.
    await user.keyboard('{ArrowUp}');
    expect(option('Gamma')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(option('Alpha')).toHaveFocus();
  });

  it('jumps to the first and last', async () => {
    const user = await openWith();

    await user.keyboard('{End}');
    expect(option('Gamma')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(option('Alpha')).toHaveFocus();
  });

  it('reaches the options from the filter box', async () => {
    const user = await openWith({ filterable: true });
    expect(screen.getByRole('textbox')).toHaveFocus();

    await user.keyboard('{ArrowDown}');

    expect(option('Alpha')).toHaveFocus();
  });

  it('leaves Home and End to the filter box while typing in it', async () => {
    const user = await openWith({ filterable: true });
    await user.keyboard('alp');

    await user.keyboard('{Home}');

    // They move within the text being typed; taking them would make the box
    // hard to correct.
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('says nothing to other keys', async () => {
    const user = await openWith();

    await user.keyboard('{ArrowRight}');

    // Left where it was, rather than treated as a step.
    expect(option('Alpha')).toHaveFocus();
  });
});
