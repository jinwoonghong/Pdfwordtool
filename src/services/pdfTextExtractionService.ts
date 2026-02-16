import { getDocument } from 'pdfjs-dist';

export interface PdfTextPage {
  pageNumber: number;
  text: string;
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
