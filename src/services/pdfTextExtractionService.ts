import { getDocument } from 'pdfjs-dist';

export interface PdfTextPage {
  pageNumber: number;
  text: string;
}

export interface WordIndexItem {
  word: string;
  count: number;
  pages: number[];
  contexts: Array<{
    pageNumber: number;
    snippet: string;
  }>;
}

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z']+/)
    .map((token) => token.replace(/^'+|'+$/g, '').trim())
    .filter((token) => token.length > 1);
}

function createSnippet(pageText: string, word: string): string {
  const lowerText = pageText.toLowerCase();
  const index = lowerText.indexOf(word);
  if (index < 0) {
    return '';
  }

  const start = Math.max(0, index - 24);
  const end = Math.min(pageText.length, index + word.length + 24);
  return pageText.slice(start, end).replace(/\s+/g, ' ').trim();
}

export async function extractPdfText(fileBuffer: ArrayBuffer): Promise<PdfTextPage[]> {
  const pdf = await getDocument({ data: fileBuffer }).promise;
  const pages: PdfTextPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    pages.push({ pageNumber, text });
  }

  return pages;
}

export function buildWordIndex(pages: PdfTextPage[]): WordIndexItem[] {
  const map = new Map<string, WordIndexItem>();

  for (const page of pages) {
    const seenInPage = new Set<string>();
    const words = tokenizeText(page.text);

    for (const word of words) {
      const existing = map.get(word);
      if (existing) {
        existing.count += 1;
        if (!seenInPage.has(word)) {
          existing.pages.push(page.pageNumber);
          const snippet = createSnippet(page.text, word);
          if (snippet) {
            existing.contexts.push({ pageNumber: page.pageNumber, snippet });
          }
          seenInPage.add(word);
        }
        continue;
      }

      const snippet = createSnippet(page.text, word);
      map.set(word, {
        word,
        count: 1,
        pages: [page.pageNumber],
        contexts: snippet ? [{ pageNumber: page.pageNumber, snippet }] : []
      });
      seenInPage.add(word);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
