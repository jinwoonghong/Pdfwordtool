export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: string;
}

const translationCache = new Map<string, TranslationResult>();

function createCacheKey(request: TranslationRequest): string {
  return `${request.sourceLanguage}:${request.targetLanguage}:${request.text.trim().toLowerCase()}`;
}

/**
 * 임시 번역 스텁.
 * 실제 API 연결 전까지는 선택 텍스트를 보기 좋은 형태로 반환합니다.
 */
export async function translateText(
  request: TranslationRequest,
  signal?: AbortSignal
): Promise<TranslationResult> {
  const normalizedText = request.text.trim();
  if (!normalizedText) {
    return {
      translatedText: '',
      provider: 'local-stub'
    };
  }

  const cacheKey = createCacheKey({ ...request, text: normalizedText });
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 150);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('번역 요청이 취소되었습니다.', 'AbortError'));
        },
        { once: true }
      );
    }
  });

  const translatedText = `[KR] ${normalizedText}`;
  const result: TranslationResult = {
    translatedText,
    provider: 'local-stub'
  };

  translationCache.set(cacheKey, result);
  return result;
}
