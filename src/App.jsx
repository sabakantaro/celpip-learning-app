import { useEffect, useMemo, useState } from "react";
import dataset from "./data/learning-content.json";
import {
  defaultProgressState,
  evaluateAnswer,
  isCompleted,
  isDue,
  TARGET_BOX,
} from "./lib/spacedRepetition";

const STORAGE_KEY = "english-memory-progress-v1";
const MODE_STORAGE_KEY = "english-memory-mode-v1";
const QUIZ_MODES = {
  TERM_TO_MEANING: "term_to_meaning",
  MEANING_TO_TERM: "meaning_to_term",
};

function shuffle(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomChoices(correctItem, pool, mode, maxChoices = 4) {
  const optionField =
    mode === QUIZ_MODES.MEANING_TO_TERM ? "term" : "meaning";
  const correctValue = correctItem[optionField];
  const distractors = shuffle(
    pool
      .filter((item) => item.id !== correctItem.id)
      .map((item) => item[optionField])
  ).slice(0, Math.max(0, maxChoices - 1));

  return shuffle([correctValue, ...distractors]);
}

function initialProgress(items) {
  return items.reduce((acc, item) => {
    acc[item.id] = defaultProgressState(item.id);
    return acc;
  }, {});
}

export default function App() {
  const items = useMemo(
    () => dataset.items.filter((item) => ["Words", "Phrasal Verbs"].includes(item.category)),
    []
  );

  const [category, setCategory] = useState("All");
  const [quizMode, setQuizMode] = useState(() => {
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    return savedMode && Object.values(QUIZ_MODES).includes(savedMode)
      ? savedMode
      : QUIZ_MODES.TERM_TO_MEANING;
  });
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return initialProgress(items);
      }
      const saved = JSON.parse(raw);
      return { ...initialProgress(items), ...saved };
    } catch {
      return initialProgress(items);
    }
  });
  const [sessionQueue, setSessionQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, quizMode);
  }, [quizMode]);

  const filtered = useMemo(
    () => items.filter((item) => category === "All" || item.category === category),
    [category, items]
  );

  const dueItems = useMemo(
    () => filtered.filter((item) => isDue(progress[item.id])),
    [filtered, progress]
  );

  const completed = useMemo(() => isCompleted(progress, filtered), [filtered, progress]);

  const currentItem = sessionQueue[index] ?? null;
  const inSession = Boolean(currentItem);
  const correctAnswer = useMemo(() => {
    if (!currentItem) return "";
    return quizMode === QUIZ_MODES.MEANING_TO_TERM
      ? currentItem.term
      : currentItem.meaning;
  }, [currentItem, quizMode]);
  const choices = useMemo(() => {
    if (!currentItem) return [];
    return randomChoices(currentItem, filtered, quizMode, 4);
  }, [currentItem, filtered, quizMode]);

  function startSession() {
    setSessionQueue(shuffle(dueItems));
    setIndex(0);
    setSelected("");
    setResult(null);
  }

  function answer(choice) {
    if (!currentItem || result) return;

    const isCorrect = choice === correctAnswer;
    const now = Date.now();

    setProgress((prev) => ({
      ...prev,
      [currentItem.id]: evaluateAnswer(prev[currentItem.id], isCorrect, now),
    }));
    setSelected(choice);
    setResult(isCorrect ? "correct" : "wrong");
  }

  function nextQuestion() {
    setSelected("");
    setResult(null);
    setIndex((prev) => prev + 1);
  }

  function endSession() {
    setSessionQueue([]);
    setIndex(0);
    setSelected("");
    setResult(null);
  }

  function resetProgress() {
    const next = initialProgress(items);
    setProgress(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    endSession();
  }

  const masteredCount = filtered.filter((item) => (progress[item.id]?.box ?? 1) >= TARGET_BOX).length;

  return (
    <div className="page">
      {!inSession && (
        <header className="hero">
          <h1>English Memory Builder</h1>
          <p>Question loop + spaced repetition for Words and Phrasal Verbs.</p>
        </header>
      )}

      <main className="container">
        {!inSession && (
          <section className="panel controls">
            <div className="segmented">
              {["All", "Words", "Phrasal Verbs"].map((label) => (
                <button
                  key={label}
                  className={category === label ? "seg active" : "seg"}
                  onClick={() => {
                    setCategory(label);
                    endSession();
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="actions">
              <button
                type="button"
                className={quizMode === QUIZ_MODES.TERM_TO_MEANING ? "seg active" : "seg"}
                onClick={() => {
                  setQuizMode(QUIZ_MODES.TERM_TO_MEANING);
                  endSession();
                }}
              >
                Term -&gt; Meaning
              </button>
              <button
                type="button"
                className={quizMode === QUIZ_MODES.MEANING_TO_TERM ? "seg active" : "seg"}
                onClick={() => {
                  setQuizMode(QUIZ_MODES.MEANING_TO_TERM);
                  endSession();
                }}
              >
                Meaning -&gt; Term
              </button>
              <button type="button" onClick={startSession}>
                Start Due Session ({dueItems.length})
              </button>
              <button type="button" className="ghost" onClick={resetProgress}>
                Reset All Progress
              </button>
            </div>
          </section>
        )}

        {!inSession && (
          <section className="panel stats">
            <p>Total: {filtered.length}</p>
            <p>Due now: {dueItems.length}</p>
            <p>Mastered: {masteredCount}</p>
            <p>Completed: {completed ? "Yes" : "Not yet"}</p>
            <p>Mode: {quizMode.replaceAll("_", " ")}</p>
          </section>
        )}

        <section className="panel review">
          {!currentItem && (
            <div>
              <h2>Ready</h2>
              <p>Tap "Start Due Session" to practice only due questions.</p>
            </div>
          )}

          {currentItem && (
            <div>
              <div className="review-toolbar">
                <button type="button" onClick={endSession}>
                  End Session
                </button>
              </div>
              <p className="progress-label">
                Question {index + 1} / {sessionQueue.length}
              </p>
              <h2>
                {quizMode === QUIZ_MODES.MEANING_TO_TERM
                  ? currentItem.meaning
                  : currentItem.term}
              </h2>
              <p className="helper">
                {quizMode === QUIZ_MODES.MEANING_TO_TERM
                  ? "Choose the correct term."
                  : "Choose the correct meaning."}
              </p>

              <div className="option-list">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={
                      selected === choice
                        ? choice === correctAnswer
                          ? "option right"
                          : "option wrong"
                        : "option"
                    }
                    onClick={() => answer(choice)}
                    disabled={Boolean(result)}
                  >
                    {choice}
                  </button>
                ))}
              </div>

              {result && (
                <div className="feedback">
                  <p>
                    {result === "correct" ? "Correct." : "Incorrect."} {currentItem.example}
                  </p>
                  {index + 1 < sessionQueue.length ? (
                    <button type="button" onClick={nextQuestion}>
                      Next
                    </button>
                  ) : (
                    <button type="button" onClick={startSession}>
                      Restart Due Session
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
