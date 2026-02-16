# Pdfwordtool Frontend Prototype

`pdf.js` 기반 영어 PDF 학습용 프론트엔드 뷰어입니다.

## 구현된 기능

- PDF 업로드 후 1페이지 렌더링(Canvas + Text Layer)
- 영어 단어/문장 드래그 시 번역 툴팁 표시
  - 현재 번역은 API 연동 전 로컬 스텁(`[KR] ...`)을 사용
- PDF 전체 텍스트를 페이지별로 추출해 단어 인덱스 패널 제공
  - 빈도 수 정렬, 검색, 단어 클릭 번역

## 아키텍처

- `src/viewer/PdfViewer.tsx`
  - PDF 렌더링, 텍스트 선택 이벤트, 번역 툴팁 UI
  - 단어 인덱스 사이드 패널 UI
- `src/services/pdfTextExtractionService.ts`
  - PDF 페이지별 텍스트 추출
  - 단어 토큰화 + 빈도/페이지 기반 인덱스 생성
- `src/services/translationService.ts`
  - 번역 요청 인터페이스
  - AbortSignal + 캐시를 포함한 로컬 스텁 번역기

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 Vite 기본 주소(예: `http://localhost:5173`)를 열고 PDF 파일을 선택하세요.
