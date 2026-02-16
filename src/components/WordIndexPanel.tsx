import { useEffect, useMemo, useState } from 'react';
import type { WordEntry, WordOccurrence } from '../services/pdfTextExtractionService';
import { sortWordIndex } from '../services/pdfTextExtractionService';

export interface TranslationResult {
  text: string;
  language?: string;
}

export interface WordBookSavePayload {
  word: string;
  translation?: TranslationResult;
  metadata: {
    frequency: number;
    occurrence: WordOccurrence;
  };
}

export interface WordBookSaver {
  saveWord(payload: WordBookSavePayload): Promise<void>;
}

export interface WordIndexPanelProps {
  entries: WordEntry[];
  loading?: boolean;
  onNavigateToOccurrence: (occurrence: WordOccurrence) => void;
  translateWord: (word: string) => Promise<TranslationResult>;
  wordBookSaver?: WordBookSaver;
}

export function WordIndexPanel({
  entries,
  loading = false,
  onNavigateToOccurrence,
  translateWord,
  wordBookSaver,
}: WordIndexPanelProps) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'frequency' | 'alphabet'>('frequency');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [translationCache, setTranslationCache] = useState<Record<string, TranslationResult>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? entries.filter((entry) => entry.word.toLowerCase().includes(normalizedQuery))
      : entries;

    return sortWordIndex(filtered, sortMode, sortMode === 'frequency' ? 'desc' : 'asc');
  }, [entries, query, sortMode]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.word === selectedWord) ?? null,
    [filteredEntries, selectedWord],
  );

  useEffect(() => {
    if (!selectedEntry || translationCache[selectedEntry.word]) {
      return;
    }

    let active = true;
    setIsTranslating(true);

    translateWord(selectedEntry.word)
      .then((result) => {
        if (!active) {
          return;
        }

        setTranslationCache((prev) => ({ ...prev, [selectedEntry.word]: result }));
      })
      .finally(() => {
        if (active) {
          setIsTranslating(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedEntry, translationCache, translateWord]);

  const selectedTranslation = selectedEntry ? translationCache[selectedEntry.word] : undefined;

  return (
    <aside className="word-index-panel" aria-label="Word index panel">
      <header className="word-index-panel__header">
        <h3>단어 인덱스</h3>
        <div className="word-index-panel__controls">
          <input
            type="search"
            value={query}
            placeholder="단어 검색"
            onChange={(event) => setQuery(event.target.value)}
            aria-label="단어 검색"
          />
          <div role="group" aria-label="정렬 방식">
            <button type="button" onClick={() => setSortMode('frequency')} aria-pressed={sortMode === 'frequency'}>
              빈도순
            </button>
            <button type="button" onClick={() => setSortMode('alphabet')} aria-pressed={sortMode === 'alphabet'}>
              알파벳순
            </button>
          </div>
        </div>
      </header>

      {loading ? <p>단어 인덱싱 중...</p> : null}

      <ul className="word-index-panel__list">
        {filteredEntries.map((entry) => {
          const firstOccurrence = entry.occurrences[0];
          const isSelected = selectedWord === entry.word;

          return (
            <li key={entry.word}>
              <button
                type="button"
                className={`word-index-panel__item${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedWord(entry.word);
                  onNavigateToOccurrence(firstOccurrence);
                }}
              >
                <span>{entry.word}</span>
                <small>{entry.frequency}</small>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedEntry ? (
        <section className="word-index-panel__tooltip" aria-live="polite">
          <h4>{selectedEntry.word}</h4>
          <p>
            {isTranslating && !selectedTranslation
              ? '번역 불러오는 중...'
              : selectedTranslation?.text ?? '번역 결과 없음'}
          </p>
          <p>
            위치: {selectedEntry.occurrences[0].page}페이지 · {selectedEntry.occurrences[0].context}
          </p>
          {wordBookSaver ? (
            <button
              type="button"
              onClick={() =>
                wordBookSaver.saveWord({
                  word: selectedEntry.word,
                  translation: selectedTranslation,
                  metadata: {
                    frequency: selectedEntry.frequency,
                    occurrence: selectedEntry.occurrences[0],
                  },
                })
              }
            >
              단어장 저장
            </button>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

export default WordIndexPanel;
