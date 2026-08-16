import { render, screen } from '@testing-library/svelte';
import { init, register, waitLocale } from 'svelte-i18n';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration } from '$lib/types';

const { default: AdvancedTab } = await import('./AdvancedTab.svelte');
const { inference } = await import('$lib/state/inference.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Stands in for the provider currently configured. */
function providerThat(accepts: boolean | null) {
  vi.spyOn(inference, 'provider', 'get').mockReturnValue(
    accepts === null
      ? null
      : ({ acceptsGenerationOptions: () => accepts } as never)
  );
}

const renderTab = () =>
  render(AdvancedTab, {
    props: {
      config: CONFIG_DEFAULT as unknown as Configuration,
      onchange: () => vi.fn(),
    },
  });

const notice = () => screen.queryByText(/does not accept these options/i);

describe('generation options against a provider that ignores them', () => {
  it('says they will not be sent', () => {
    providerThat(false);

    renderTab();

    // Hosted APIs are sent none of these, so a temperature set here was
    // dropped on the way out with nothing said about it.
    expect(notice()).toBeInTheDocument();
  });

  it('says nothing where they are honoured', () => {
    providerThat(true);

    renderTab();

    expect(notice()).toBeNull();
  });

  it('says nothing before a provider is configured', () => {
    providerThat(null);

    renderTab();

    // Nothing is being ignored yet; there is nowhere to send anything.
    expect(notice()).toBeNull();
  });
});
