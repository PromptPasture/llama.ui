import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerSW: vi.fn(),
  updateSW: vi.fn(),
}));

vi.mock('virtual:pwa-register', () => ({ registerSW: mocks.registerSW }));

const { startServiceWorker } = await import('./service-worker');

/** The callback the plugin holds on to until a new worker is waiting. */
function newVersionArrives() {
  const options = mocks.registerSW.mock.calls[0]?.[0] as {
    onNeedRefresh?: () => Promise<void>;
  };
  if (!options?.onNeedRefresh) {
    throw new Error('nothing would notice a new version');
  }
  return options.onNeedRefresh();
}

beforeEach(() => {
  mocks.registerSW.mockClear().mockReturnValue(mocks.updateSW);
  mocks.updateSW.mockClear();
});

describe('starting the service worker', () => {
  it('registers one', () => {
    startServiceWorker(async () => true);

    // The plugin builds a worker and a precache manifest either way; without
    // this nothing ever loads them, so nothing is cached and the app cannot
    // run offline.
    expect(mocks.registerSW).toHaveBeenCalled();
  });
});

describe('when a new version is waiting', () => {
  it('applies it once the reader agrees', async () => {
    startServiceWorker(async () => true);

    await newVersionArrives();

    // true asks the waiting worker to take over and reloads the page; a worker
    // left waiting only takes over once every tab has been closed.
    expect(mocks.updateSW).toHaveBeenCalledWith(true);
  });

  it('leaves the old one in place when they decline', async () => {
    startServiceWorker(async () => false);

    await newVersionArrives();

    expect(mocks.updateSW).not.toHaveBeenCalled();
  });

  it('asks before reloading, rather than reloading and then asking', async () => {
    const order: string[] = [];
    startServiceWorker(async () => {
      order.push('asked');
      return true;
    });
    mocks.updateSW.mockImplementation(() => order.push('reloaded'));

    await newVersionArrives();

    // Applying the update reloads the page, which would take a half-written
    // message with it.
    expect(order).toEqual(['asked', 'reloaded']);
  });
});
