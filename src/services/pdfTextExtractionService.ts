export type SortDirection = 'asc' | 'desc';

export interface PdfTextItem {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface PdfTextContent {
  items: PdfTextItem[];
}

export interface PdfPageProxyLike {
  getTextContent(): Promise<PdfTextContent>;
}

export interface PdfDocumentProxyLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxyLike>;
}

export interface NormalizationOptions {
  lowercase?: boolean;
  removePunctuation?: boolean;
  removeNumbers?: boolean;
  removeStopWords?: boolean;
  stopWords?: Iterable<string>;
}

export interface ExtractionOptions {
  chunkSize?: number;
  useWorker?: boolean;
  normalization?: NormalizationOptions;
}

export interface WordOccurrence {
  page: number;
  tokenIndex: number;
  sourceText: string;
  context: string;
}

export interface WordEntry {
  word: string;
  frequency: number;
  occurrences: WordOccurrence[];
}

export interface PageWordExtraction {
  page: number;
  sourceText: string;
  tokens: string[];
  normalizedTokens: string[];
  entries: WordEntry[];
}

export interface WordIndexResult {
  pages: PageWordExtraction[];
  globalIndex: WordEntry[];
}

const DEFAULT_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeToken(token: string, options: NormalizationOptions): string {
  let value = token;

  if (options.lowercase) {
    value = value.toLowerCase();
  }

  if (options.removePunctuation) {
    value = value.replace(/[^\p{L}\p{N}\s]/gu, '');
  }

  if (options.removeNumbers) {
    value = value.replace(/\d+/g, '');
  }

  return value.trim();
}

function toStopWordSet(options?: NormalizationOptions): Set<string> {
  if (!options?.removeStopWords) {
    return new Set();
  }

  const base = options.stopWords ? new Set(options.stopWords) : DEFAULT_STOP_WORDS;
  return new Set(Array.from(base).map((word) => word.toLowerCase()));
}

function buildWordEntries(
  page: number,
  sourceText: string,
  tokens: string[],
  normalizedTokens: string[],
): WordEntry[] {
  const map = new Map<string, WordEntry>();

  normalizedTokens.forEach((word, tokenIndex) => {
    if (!word) {
      return;
    }

    const prev = map.get(word);
    const occurrence: WordOccurrence = {
      page,
      tokenIndex,
      sourceText,
      context: buildContext(tokens, tokenIndex),
    };

    if (prev) {
      prev.frequency += 1;
      prev.occurrences.push(occurrence);
      return;
    }

    map.set(word, {
      word,
      frequency: 1,
      occurrences: [occurrence],
    });
  });

  return Array.from(map.values());
}

function buildContext(tokens: string[], index: number, radius = 4): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(tokens.length, index + radius + 1);
  return tokens.slice(start, end).join(' ');
}

function mergeGlobalIndex(pages: PageWordExtraction[]): WordEntry[] {
  const aggregate = new Map<string, WordEntry>();

  pages.forEach((page) => {
    page.entries.forEach((entry) => {
      const existing = aggregate.get(entry.word);

      if (existing) {
        existing.frequency += entry.frequency;
        existing.occurrences.push(...entry.occurrences);
        return;
      }

      aggregate.set(entry.word, {
        word: entry.word,
        frequency: entry.frequency,
        occurrences: [...entry.occurrences],
      });
    });
  });

  return Array.from(aggregate.values());
}

function sortWordEntries(entries: WordEntry[], direction: SortDirection = 'desc'): WordEntry[] {
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...entries].sort((a, b) => (a.frequency - b.frequency) * multiplier || a.word.localeCompare(b.word));
}

async function yieldToMainThread(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 30 });
      return;
    }

    setTimeout(resolve, 0);
  });
}

function normalizeTokensInWorker(
  pageTokens: Array<{ page: number; sourceText: string; tokens: string[] }>,
  normalization: NormalizationOptions,
): Promise<PageWordExtraction[]> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return Promise.resolve(normalizeTokensOnMainThread(pageTokens, normalization));
  }

  const workerScript = `
self.onmessage = (event) => {
  const { payload, options } = event.data;
  const stopWords = new Set((options.stopWords || []).map((word) => String(word).toLowerCase()));

  const normalize = (token) => {
    let value = String(token);
    if (options.lowercase) value = value.toLowerCase();
    if (options.removePunctuation) value = value.replace(/[^\\p{L}\\p{N}\\s]/gu, '');
    if (options.removeNumbers) value = value.replace(/\\d+/g, '');
    value = value.trim();
    if (options.removeStopWords && stopWords.has(value.toLowerCase())) return '';
    return value;
  };

  const context = (tokens, index, radius = 4) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(tokens.length, index + radius + 1);
    return tokens.slice(start, end).join(' ');
  };

  const toEntries = (page, sourceText, tokens, normalizedTokens) => {
    const map = new Map();
    normalizedTokens.forEach((word, tokenIndex) => {
      if (!word) return;
      const occurrence = { page, tokenIndex, sourceText, context: context(tokens, tokenIndex) };
      const prev = map.get(word);
      if (prev) {
        prev.frequency += 1;
        prev.occurrences.push(occurrence);
      } else {
        map.set(word, { word, frequency: 1, occurrences: [occurrence] });
      }
    });
    return Array.from(map.values());
  };

  const result = payload.map((entry) => {
    const normalizedTokens = entry.tokens.map(normalize);
    return {
      page: entry.page,
      sourceText: entry.sourceText,
      tokens: entry.tokens,
      normalizedTokens,
      entries: toEntries(entry.page, entry.sourceText, entry.tokens, normalizedTokens),
    };
  });

  self.postMessage(result);
};`;

  const blob = new Blob([workerScript], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));

  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<PageWordExtraction[]>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(event.error ?? new Error('Word normalization worker failed.'));
      worker.terminate();
    };

    worker.postMessage({
      payload: pageTokens,
      options: {
        ...normalization,
        stopWords: Array.from(normalization.stopWords ?? DEFAULT_STOP_WORDS),
      },
    });
  });
}

function normalizeTokensOnMainThread(
  pageTokens: Array<{ page: number; sourceText: string; tokens: string[] }>,
  normalization: NormalizationOptions,
): PageWordExtraction[] {
  const stopWords = toStopWordSet(normalization);

  return pageTokens.map(({ page, sourceText, tokens }) => {
    const normalizedTokens = tokens
      .map((token) => normalizeToken(token, normalization))
      .map((token) => (normalization.removeStopWords && stopWords.has(token.toLowerCase()) ? '' : token));

    return {
      page,
      sourceText,
      tokens,
      normalizedTokens,
      entries: buildWordEntries(page, sourceText, tokens, normalizedTokens),
    };
  });
}

export async function extractPdfWordIndex(
  pdfDocument: PdfDocumentProxyLike,
  options: ExtractionOptions = {},
  onProgress?: (progress: number) => void,
): Promise<WordIndexResult> {
  const chunkSize = Math.max(1, options.chunkSize ?? 4);
  const pageTokens: Array<{ page: number; sourceText: string; tokens: string[] }> = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const sourceText = textContent.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();

    pageTokens.push({
      page: pageNumber,
      sourceText,
      tokens: tokenize(sourceText),
    });

    onProgress?.(pageNumber / pdfDocument.numPages);

    if (pageNumber % chunkSize === 0) {
      await yieldToMainThread();
    }
  }

  let pages: PageWordExtraction[];

  if (options.useWorker) {
    try {
      pages = await normalizeTokensInWorker(pageTokens, options.normalization ?? {});
    } catch {
      pages = normalizeTokensOnMainThread(pageTokens, options.normalization ?? {});
    }
  } else {
    pages = normalizeTokensOnMainThread(pageTokens, options.normalization ?? {});
  }

  const globalIndex = sortWordEntries(mergeGlobalIndex(pages), 'desc');
  return { pages, globalIndex };
}

export interface BackgroundIndexingController {
  promise: Promise<WordIndexResult>;
  cancel: () => void;
}

export function startBackgroundWordIndexing(
  pdfDocument: PdfDocumentProxyLike,
  options: ExtractionOptions = {},
  onProgress?: (progress: number) => void,
): BackgroundIndexingController {
  let cancelled = false;

  const promise = (async () => {
    const result = await extractPdfWordIndex(pdfDocument, options, (progress) => {
      if (!cancelled) {
        onProgress?.(progress);
      }
    });

    if (cancelled) {
      throw new Error('Word indexing cancelled.');
    }

    return result;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

export function sortWordIndex(entries: WordEntry[], mode: 'frequency' | 'alphabet', direction: SortDirection = 'desc'): WordEntry[] {
  if (mode === 'alphabet') {
    const multiplier = direction === 'desc' ? -1 : 1;
    return [...entries].sort((a, b) => a.word.localeCompare(b.word) * multiplier);
  }

  return sortWordEntries(entries, direction);
}
