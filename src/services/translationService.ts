const MIN_SELECTION_LENGTH = 1;
const MAX_SELECTION_LENGTH = 300;
const DEFAULT_DEBOUNCE_MS = 350;

const translationCache = new Map<string, string>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeController: AbortController | null = null;

const cacheKey = (text: string, source: string, target: string): string =>
  `${source}:${target}:${text}`;

const isLengthValid = (text: string): boolean =>
  text.length >= MIN_SELECTION_LENGTH && text.length <= MAX_SELECTION_LENGTH;

export interface TranslateOptions {
  source?: string;
  target?: string;
  signal?: AbortSignal;
}

export async function translate(
  text: string,
  source = 'en',
  target = 'ko',
  signal?: AbortSignal,
): Promise<string> {
  const normalizedText = text.trim();

  if (!isLengthValid(normalizedText)) {
    throw new Error(`선택 텍스트는 ${MIN_SELECTION_LENGTH}~${MAX_SELECTION_LENGTH}자여야 합니다.`);
  }

  const key = cacheKey(normalizedText, source, target);
  const cached = translationCache.get(key);
  if (cached) {
    return cached;
  }

  const response = await fetch('https://libretranslate.de/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: normalizedText,
      source,
      target,
      format: 'text',
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error('번역 API 호출에 실패했습니다.');
  }

  const payload = (await response.json()) as { translatedText?: string };
  const translated = payload.translatedText?.trim();

  if (!translated) {
    throw new Error('번역 결과가 비어 있습니다.');
  }

  translationCache.set(key, translated);
  return translated;
}

export function translateDebounced(
  text: string,
  { source = 'en', target = 'ko' }: TranslateOptions = {},
  waitMs = DEFAULT_DEBOUNCE_MS,
): Promise<string> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (activeController) {
    activeController.abort();
  }

  return new Promise((resolve, reject) => {
    debounceTimer = setTimeout(async () => {
      activeController = new AbortController();

      try {
        const translated = await translate(text, source, target, activeController.signal);
        resolve(translated);
      } catch (error) {
        reject(error);
      } finally {
        activeController = null;
      }
    }, waitMs);
  });
}

export function cancelTranslation(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

export function getTranslationCache(): Map<string, string> {
  return translationCache;
}
