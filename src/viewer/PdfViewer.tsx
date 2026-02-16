import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GlobalWorkerOptions,
  getDocument,
  renderTextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy
} from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { buildWordIndex, extractPdfText, type WordIndexItem } from '../services/pdfTextExtractionService';
import { translateText } from '../services/translationService';

GlobalWorkerOptions.workerSrc = workerSrc;

const SCALE = 1.25;
const MAX_TRANSLATION_LENGTH = 300;

interface TooltipState {
  isVisible: boolean;
  x: number;
  y: number;
  sourceText: string;
  translatedText: string;
  loading: boolean;
  provider: string;
  error: string | null;
}

const initialTooltipState: TooltipState = {
  isVisible: false,
  x: 0,
  y: 0,
  sourceText: '',
  translatedText: '',
  loading: false,
  provider: '',
  error: null
};

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
  const [wordIndex, setWordIndex] = useState<WordIndexItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tooltip, setTooltip] = useState<TooltipState>(initialTooltipState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadFirstPage = useCallback(async (pdf: PDFDocumentProxy) => {
    const page = await pdf.getPage(1);
    if (!canvasRef.current || !textLayerRef.current) {
      return;
    }

    await renderPage(page, canvasRef.current, textLayerRef.current);
  }, []);

  const closeTooltip = useCallback(() => {
    setTooltip(initialTooltipState);
  }, []);

  const requestTranslation = useCallback(async (selectedText: string, x: number, y: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTooltip({
      isVisible: true,
      x,
      y,
      sourceText: selectedText,
      translatedText: '',
      loading: true,
      provider: '',
      error: null
    });

    try {
      const result = await translateText(
        {
          text: selectedText,
          sourceLanguage: 'en',
          targetLanguage: 'ko'
        },
        controller.signal
      );

      setTooltip((prev) => ({
        ...prev,
        translatedText: result.translatedText,
        provider: result.provider,
        loading: false
      }));
    } catch (translationError) {
      if (translationError instanceof DOMException && translationError.name === 'AbortError') {
        return;
      }

      setTooltip((prev) => ({
        ...prev,
        loading: false,
        error:
          translationError instanceof Error
            ? translationError.message
            : '번역을 불러오는 중 문제가 발생했습니다.'
      }));
    }
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? '';

      if (!selectedText || selectedText.length > MAX_TRANSLATION_LENGTH) {
        return;
      }

      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        return;
      }

      requestTranslation(selectedText, rect.left + window.scrollX, rect.bottom + window.scrollY + 8);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      const tooltipElement = document.querySelector('.translate-tooltip');
      if (tooltipElement?.contains(target)) {
        return;
      }
      if (stage.contains(target)) {
        return;
      }
      closeTooltip();
    };

    stage.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleDocumentClick);

    return () => {
      stage.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [closeTooltip, requestTranslation]);

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
      setWordIndex([]);
      closeTooltip();

      try {
        const fileBuffer = await selectedFile.arrayBuffer();
        const loadingTask = getDocument({ data: fileBuffer });
        const pdf = await loadingTask.promise;
        setPageCount(pdf.numPages);
        await loadFirstPage(pdf);

        const pages = await extractPdfText(fileBuffer);
        setWordIndex(buildWordIndex(pages));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PDF를 불러오지 못했습니다.');
      }
    },
    [closeTooltip, loadFirstPage]
  );

  const filteredWordIndex = useMemo(() => {
    if (!searchTerm.trim()) {
      return wordIndex;
    }

    const query = searchTerm.trim().toLowerCase();
    return wordIndex.filter((item) => item.word.includes(query));
  }, [searchTerm, wordIndex]);

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <h1>PDF 학습 뷰어</h1>
        <p>영어 단어/문장을 드래그하면 번역 툴팁이 뜨고, 전체 단어 인덱스를 볼 수 있습니다.</p>
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

      <div className="viewer-layout">
        <section ref={stageRef} className="pdf-stage">
          <div className="page-container">
            <canvas ref={canvasRef} className="page-canvas" />
            <div ref={textLayerRef} className="textLayer page-text-layer" />
          </div>
        </section>

        <aside className="word-panel">
          <h2>전체 단어 인덱스</h2>
          <input
            className="word-search"
            placeholder="단어 검색"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <p className="word-count">{filteredWordIndex.length.toLocaleString()}개 단어</p>
          <ul className="word-list">
            {filteredWordIndex.slice(0, 300).map((item) => (
              <li
                key={item.word}
                className="word-item"
                onClick={() =>
                  requestTranslation(item.word, window.scrollX + 24, window.scrollY + 120)
                }
              >
                <div>
                  <strong>{item.word}</strong>
                  <small> 빈도 {item.count}</small>
                </div>
                <small>페이지 {item.pages.join(', ')}</small>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {tooltip.isVisible && (
        <div className="translate-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.sourceText}</strong>
          {tooltip.loading && <p>번역 중...</p>}
          {!tooltip.loading && tooltip.error && <p className="error">{tooltip.error}</p>}
          {!tooltip.loading && !tooltip.error && <p>{tooltip.translatedText || '번역 결과가 없습니다.'}</p>}
          {!tooltip.loading && tooltip.provider && <small>provider: {tooltip.provider}</small>}
        </div>
      )}
    </main>
  );
}
