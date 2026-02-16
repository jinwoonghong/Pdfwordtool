# Pdfwordtool Frontend Prototype

`pdf.js` 기반 최소 실행 가능한 프론트엔드 뷰어 구조입니다.

## 아키텍처

- `src/viewer/PdfViewer.tsx`
  - 로컬 PDF 업로드
  - 1페이지 렌더링(Canvas)
  - 텍스트 레이어 활성화(`renderTextLayer`)
- `src/services/pdfTextExtractionService.ts`
  - PDF의 페이지별 텍스트 추출 담당
- `src/services/translationService.ts`
  - 번역 API 연동을 위한 독립 서비스 레이어(현재는 스텁)

즉, **뷰어(UI)**, **PDF 텍스트 추출**, **번역 API**가 분리된 구조로 되어 있어 향후 기능 확장 시 결합도를 낮출 수 있습니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 Vite 기본 주소(예: `http://localhost:5173`)를 열고 PDF 파일을 선택하면 첫 페이지가 렌더링됩니다.

## 향후 확장 아이디어

1. 페이지 이동(이전/다음), 줌 컨트롤 추가
2. 추출 텍스트를 문단 단위로 분할해 번역 파이프라인 연결
3. 번역 결과를 오버레이하거나 병렬 뷰(원문/번역)로 표시
