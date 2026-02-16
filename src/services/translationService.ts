export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: string;
}

export async function translateText(
  request: TranslationRequest
): Promise<TranslationResult> {
  void request;

  // TODO: 추후 실제 번역 API(Google/DeepL/OpenAI 등)로 연결.
  return {
    translatedText: '',
    provider: 'not-configured'
  };
}
