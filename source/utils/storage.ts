import {defaultStorage} from '../types/storage';
import type {StorageSchema} from '../types/storage';

type UnknownStorageRecord = Record<string, unknown>;

interface PromiseStorageArea {
  get(keys?: string[] | null): Promise<UnknownStorageRecord>;
  set(items: UnknownStorageRecord): Promise<void>;
}

interface CallbackStorageArea {
  get(
    keys: string[] | null,
    callback: (items: UnknownStorageRecord) => void
  ): void;
  set(items: UnknownStorageRecord, callback: () => void): void;
}

interface FallbackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ExtensionGlobals {
  browser?: {
    storage?: {
      local?: PromiseStorageArea;
    };
  };
  chrome?: {
    runtime?: {
      lastError?: {
        message?: string;
      };
    };
    storage?: {
      local?: CallbackStorageArea;
    };
  };
  localStorage?: FallbackStorage;
}

const fallbackStorageKey = 'homebase:storage';

function getExtensionGlobals(): ExtensionGlobals {
  return globalThis as typeof globalThis & ExtensionGlobals;
}

function getFallbackStorage(): Partial<StorageSchema> {
  const localStorage = getExtensionGlobals().localStorage;

  if (!localStorage) {
    return {};
  }

  const rawStorage = localStorage.getItem(fallbackStorageKey);
  if (!rawStorage) {
    return {};
  }

  try {
    return JSON.parse(rawStorage) as Partial<StorageSchema>;
  } catch {
    return {};
  }
}

function setFallbackStorage(items: Partial<StorageSchema>): void {
  const localStorage = getExtensionGlobals().localStorage;

  if (!localStorage) {
    return;
  }

  const nextStorage = {
    ...getFallbackStorage(),
    ...items,
  };

  localStorage.setItem(fallbackStorageKey, JSON.stringify(nextStorage));
}

async function getRawStorage(
  keys: Array<keyof StorageSchema> | null
): Promise<Partial<StorageSchema>> {
  const extensionGlobals = getExtensionGlobals();
  const browserStorage = extensionGlobals.browser?.storage?.local;
  const keyNames = keys?.map(String) ?? null;

  if (browserStorage) {
    return (await browserStorage.get(keyNames)) as Partial<StorageSchema>;
  }

  const chromeStorage = extensionGlobals.chrome?.storage?.local;

  if (chromeStorage) {
    return new Promise((resolve, reject) => {
      chromeStorage.get(keyNames, (items) => {
        const errorMessage =
          extensionGlobals.chrome?.runtime?.lastError?.message;

        if (errorMessage) {
          reject(new Error(errorMessage));
          return;
        }

        resolve(items as Partial<StorageSchema>);
      });
    });
  }

  const fallbackStorage = getFallbackStorage();

  if (!keys) {
    return fallbackStorage;
  }

  return Object.fromEntries(
    keys.map((key) => [key, fallbackStorage[key]])
  ) as Partial<StorageSchema>;
}

async function setRawStorage(items: Partial<StorageSchema>): Promise<void> {
  const extensionGlobals = getExtensionGlobals();
  const browserStorage = extensionGlobals.browser?.storage?.local;
  const rawItems = {...items} as UnknownStorageRecord;

  if (browserStorage) {
    await browserStorage.set(rawItems);
    return;
  }

  const chromeStorage = extensionGlobals.chrome?.storage?.local;

  if (chromeStorage) {
    await new Promise<void>((resolve, reject) => {
      chromeStorage.set(rawItems, () => {
        const errorMessage =
          extensionGlobals.chrome?.runtime?.lastError?.message;

        if (errorMessage) {
          reject(new Error(errorMessage));
          return;
        }

        resolve();
      });
    });
    return;
  }

  setFallbackStorage(items);
}

export async function getStorage<K extends keyof StorageSchema>(
  keys: K[]
): Promise<Pick<StorageSchema, K>> {
  const result = await getRawStorage(keys);

  const output = {} as Pick<StorageSchema, K>;
  for (const key of keys) {
    output[key] = (result[key] as StorageSchema[K]) ?? defaultStorage[key];
  }

  return output;
}

export async function setStorage<K extends keyof StorageSchema>(
  items: Pick<StorageSchema, K>
): Promise<void> {
  await setRawStorage(items);
}

export async function getAllStorage(): Promise<StorageSchema> {
  const result = await getRawStorage(null);

  return {
    ...defaultStorage,
    ...result,
  };
}
