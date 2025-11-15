import { MetaProgressionState, createDefaultMetaState } from './MetaProgressionState';

export interface ProgressionStorage {
  read(): string | null;
  write(payload: string): void;
}

export class LocalStorageProgressionStorage implements ProgressionStorage {
  constructor(private readonly key: string) {}

  read(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(this.key);
  }

  write(payload: string): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(this.key, payload);
  }
}

export class MemoryProgressionStorage implements ProgressionStorage {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(payload: string): void {
    this.value = payload;
  }
}

export class MetaProgressionRepository {
  constructor(private readonly storage: ProgressionStorage, private readonly key: string = 'last-hand-meta') {}

  load(): MetaProgressionState {
    const raw = this.storage.read();
    if (!raw) {
      return createDefaultMetaState();
    }

    try {
      const parsed = JSON.parse(raw) as MetaProgressionState;
      if (!parsed.version) {
        return createDefaultMetaState();
      }
      return parsed;
    } catch {
      return createDefaultMetaState();
    }
  }

  save(state: MetaProgressionState): void {
    this.storage.write(JSON.stringify(state));
  }
}
