import { ChangeEvent, useCallback, useRef, useState } from 'react';
import {
  GlobalWorkerOptions,
  getDocument,
  renderTextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy
} from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerSrc;

const SCALE = 1.25;

async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  textLayerContainer: HTMLDivElement
): Promise<void> {
  const viewport = page.getViewport({ scale: SCALE });
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context를 생성할 수 없습니다.');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  textLayerContainer.innerHTML = '';
  textLayerContainer.style.width = `${viewport.width}px`;
  textLayerContainer.style.height = `${viewport.height}px`;

  const textContent = await page.getTextContent();
  await renderTextLayer({
    container: textLayerContainer,
    textContentSource: textContent,
    viewport
  }).promise;
}

export function PdfViewer() {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const loadFirstPage = useCallback(async (pdf: PDFDocumentProxy) => {
    const page = await pdf.getPage(1);
    if (!canvasRef.current || !textLayerRef.current) {
      return;
    }

    await renderPage(page, canvasRef.current, textLayerRef.current);
  }, []);

  const onSelectFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        return;
      }

      if (selectedFile.type !== 'application/pdf') {
        setError('PDF 파일만 업로드할 수 있습니다.');
        return;
      }

      setError(null);
      setFileName(selectedFile.name);

      try {
        const fileBuffer = await selectedFile.arrayBuffer();
        const loadingTask = getDocument({ data: fileBuffer });
        const pdf = await loadingTask.promise;
        setPageCount(pdf.numPages);
        await loadFirstPage(pdf);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PDF를 불러오지 못했습니다.');
      }
    },
    [loadFirstPage]
  );

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <h1>PDF.js 최소 뷰어</h1>
        <p>로컬 PDF를 선택하면 첫 페이지를 렌더링하고 텍스트 레이어를 활성화합니다.</p>
        <label className="file-picker">
          <span>PDF 파일 선택</span>
          <input type="file" accept="application/pdf" onChange={onSelectFile} />
        </label>
        {fileName && (
          <small>
            파일: {fileName} / 페이지 수: {pageCount}
          </small>
        )}
        {error && <small className="error">{error}</small>}
      </header>

      <section className="pdf-stage">
        <div className="page-container">
          <canvas ref={canvasRef} className="page-canvas" />
          <div ref={textLayerRef} className="textLayer page-text-layer" />
        </div>
      </section>
    </main>
  );
}
