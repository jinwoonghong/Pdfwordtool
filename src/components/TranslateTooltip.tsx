import React from 'react';

export interface TooltipPosition {
  x: number;
  y: number;
}

interface TranslateTooltipProps {
  text: string;
  translatedText?: string;
  position: TooltipPosition;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  maxWidth: 360,
  minWidth: 220,
  padding: '12px',
  borderRadius: 8,
  border: '1px solid #d9d9d9',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  backgroundColor: '#fff',
  color: '#111827',
  fontSize: 13,
  lineHeight: 1.4,
};

const mutedTextStyle: React.CSSProperties = {
  margin: '0 0 8px',
  color: '#6b7280',
  fontSize: 12,
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 10,
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  color: '#111827',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 12,
};

const errorTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#b91c1c',
};

export const TranslateTooltip: React.FC<TranslateTooltipProps> = ({
  text,
  translatedText,
  position,
  isLoading,
  error,
  onRetry,
  onClose,
}) => {
  return (
    <div
      style={{
        ...tooltipStyle,
        left: Math.max(8, position.x),
        top: Math.max(8, position.y),
      }}
      role="dialog"
      aria-live="polite"
      aria-label="Translation tooltip"
    >
      <p style={mutedTextStyle}>선택 텍스트</p>
      <p style={bodyTextStyle}>{text}</p>

      <hr style={{ border: 0, borderTop: '1px solid #f3f4f6', margin: '10px 0' }} />

      {isLoading && <p style={mutedTextStyle}>번역 중...</p>}

      {!isLoading && !error && translatedText && (
        <>
          <p style={mutedTextStyle}>번역 결과</p>
          <p style={bodyTextStyle}>{translatedText}</p>
        </>
      )}

      {!isLoading && error && (
        <>
          <p style={errorTextStyle}>{error}</p>
          <div style={actionRowStyle}>
            {onRetry && (
              <button type="button" style={buttonStyle} onClick={onRetry}>
                다시 시도
              </button>
            )}
            {onClose && (
              <button type="button" style={buttonStyle} onClick={onClose}>
                닫기
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TranslateTooltip;
