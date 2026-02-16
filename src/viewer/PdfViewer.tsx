import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TranslateTooltip, { TooltipPosition } from '../components/TranslateTooltip';
import { cancelTranslation, translateDebounced } from '../services/translationService';

const MIN_SELECTION_LENGTH = 1;
const MAX_SELECTION_LENGTH = 300;
const NOISE_ONLY_PATTERN = /^[\s\p{P}\p{S}]+$/u;

interface SelectionState {
  text: string;
  position: TooltipPosition;
}

interface PdfViewerProps {
  children?: React.ReactNode;
  sourceLanguage?: string;
  targetLanguage?: string;
}

const isValidSelection = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length < MIN_SELECTION_LENGTH || trimmed.length > MAX_SELECTION_LENGTH) {
    return false;
  }

  if (NOISE_ONLY_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
};

const getSelectionInfo = (textLayerElement: HTMLElement): SelectionState | null => {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;

  if (!textLayerElement.contains(commonAncestor)) {
    return null;
  }

  const text = selection.toString().trim();
  if (!isValidSelection(text)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top - 12;

  return {
    text,
    position: { x, y },
  };
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  children,
  sourceLanguage = 'en',
  targetLanguage = 'ko',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const isTooltipVisible = useMemo(() => Boolean(selection), [selection]);

  const closeTooltip = useCallback(() => {
    cancelTranslation();
    setSelection(null);
    setTranslatedText('');
    setError(undefined);
    setIsLoading(false);
  }, []);

  const updateFromSelection = useCallback(() => {
    if (!textLayerRef.current) {
      return;
    }

    const info = getSelectionInfo(textLayerRef.current);

    if (!info) {
      return;
    }

    setSelection(info);
  }, []);

  const retryTranslation = useCallback(() => {
    if (!selection) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    translateDebounced(selection.text, {
      source: sourceLanguage,
      target: targetLanguage,
    })
      .then((translated) => {
        setTranslatedText(translated);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        setError('번역 중 문제가 발생했습니다. 다시 시도해주세요.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selection, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!selection) {
      return;
    }

    retryTranslation();

    return () => {
      cancelTranslation();
    };
  }, [selection, retryTranslation]);

  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) {
      return;
    }

    const handleMouseUp = () => {
      updateFromSelection();
    };

    const handleSelectionChange = () => {
      updateFromSelection();
    };

    textLayer.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      textLayer.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateFromSelection]);

  useEffect(() => {
    if (!isTooltipVisible) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const container = containerRef.current;

      if (!container || container.contains(target)) {
        return;
      }

      closeTooltip();
    };

    const handleScroll = () => closeTooltip();

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeTooltip, isTooltipVisible]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div ref={textLayerRef} data-testid="pdf-text-layer">
        {children}
      </div>

      {selection && (
        <TranslateTooltip
          text={selection.text}
          translatedText={translatedText}
          position={selection.position}
          isLoading={isLoading}
          error={error}
          onRetry={retryTranslation}
          onClose={closeTooltip}
        />
      )}
    </div>
  );
};

export default PdfViewer;
