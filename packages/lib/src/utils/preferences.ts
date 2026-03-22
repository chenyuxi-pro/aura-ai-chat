export function loadUserSelectedProvider(
  storageKeyPrefix: string,
): string | null {
  if (!storageKeyPrefix) return null;
  try {
    const providerId = localStorage.getItem(`aura:${storageKeyPrefix}:provider`);
    return providerId ?? null;
  } catch {
    return null;
  }
}

export function loadUserSelectedModel(storageKeyPrefix: string): string | null {
  if (!storageKeyPrefix) return null;
  try {
    const model = localStorage.getItem(`aura:${storageKeyPrefix}:model`);
    return model ?? null;
  } catch {
    return null;
  }
}

export function saveUserSelectedProvider(
  storageKeyPrefix: string,
  providerId: string,
): void {
  if (!storageKeyPrefix) return;
  try {
    localStorage.setItem(`aura:${storageKeyPrefix}:provider`, providerId);
  } catch {
    // Ignore localStorage failures.
  }
}

export function saveUserSelectedModel(
  storageKeyPrefix: string,
  modelId: string,
): void {
  if (!storageKeyPrefix) return;
  try {
    localStorage.setItem(`aura:${storageKeyPrefix}:model`, modelId);
  } catch {
    // Ignore localStorage failures.
  }
}

export function loadUserChatInputHeight(
  storageKeyPrefix: string,
): number | null {
  if (!storageKeyPrefix) return null;
  try {
    const raw = localStorage.getItem(`aura:${storageKeyPrefix}:inputHeight`);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveUserChatInputHeight(
  storageKeyPrefix: string,
  height: number,
): void {
  if (!storageKeyPrefix) return;
  try {
    localStorage.setItem(`aura:${storageKeyPrefix}:inputHeight`, String(height));
  } catch {
    // Ignore localStorage failures.
  }
}

export function loadUserPreferences<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveUserPreferences<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures.
  }
}
