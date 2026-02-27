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
const PRACTICE_MODE_KEY = "english-memory-practice-mode-v1";
const SETTINGS_KEY = "english-memory-settings-v1";
const DAILY_STATE_KEY = "english-memory-daily-state-v1";

const QUIZ_MODES = {
  TERM_TO_MEANING: "term_to_meaning",
  MEANING_TO_TERM: "meaning_to_term",
};

const PRACTICE_MODES = {
  NORMAL: "normal",
  DAILY_EXAM: "daily_exam",
};

const SCREENS = {
  HOME: "home",
  SETTINGS: "settings",
  SUMMARY: "summary",
};

const DEFAULT_SETTINGS = {
  dailyQuestionCount: 40,
  timerSeconds: 15,
  sourceMode: "mixed",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomChoices(correctItem, pool, mode, maxChoices = 4) {
  const optionField = mode === QUIZ_MODES.MEANING_TO_TERM ? "term" : "meaning";
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

function defaultDailyState() {
  return {
    dateKey: "",
    queueIds: [],
    completed: false,
    stats: {
      answered: 0,
      correct: 0,
      wrong: 0,
      elapsedSecondsTotal: 0,
      missedIds: [],
      answeredIds: [],
      wrongDetails: [],
    },
  };
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
  const [practiceMode, setPracticeMode] = useState(() => {
    const savedMode = localStorage.getItem(PRACTICE_MODE_KEY);
    return savedMode && Object.values(PRACTICE_MODES).includes(savedMode)
      ? savedMode
      : PRACTICE_MODES.NORMAL;
  });
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
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
  const [dailyState, setDailyState] = useState(() => {
    try {
      const raw = localStorage.getItem(DAILY_STATE_KEY);
      if (!raw) return defaultDailyState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultDailyState(),
        ...parsed,
        stats: {
          ...defaultDailyState().stats,
          ...(parsed.stats || {}),
        },
      };
    } catch {
      return defaultDailyState();
    }
  });
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [remainingSec, setRemainingSec] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, quizMode);
  }, [quizMode]);

  useEffect(() => {
    localStorage.setItem(PRACTICE_MODE_KEY, practiceMode);
  }, [practiceMode]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(dailyState));
  }, [dailyState]);

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

  useEffect(() => {
    if (!inSession || result) {
      setRemainingSec(null);
      return;
    }

    setQuestionStartedAt(Date.now());

    if (practiceMode !== PRACTICE_MODES.DAILY_EXAM || settings.timerSeconds === 0) {
      setRemainingSec(null);
      return;
    }

    setRemainingSec(settings.timerSeconds);
  }, [currentItem?.id, inSession, practiceMode, settings.timerSeconds, result]);

  useEffect(() => {
    if (
      !inSession ||
      result ||
      practiceMode !== PRACTICE_MODES.DAILY_EXAM ||
      settings.timerSeconds === 0 ||
      remainingSec === null
    ) {
      return;
    }

    if (remainingSec <= 0) {
      submitAnswer(null, true);
      return;
    }

    const timer = window.setTimeout(() => {
      setRemainingSec((prev) => (prev === null ? prev : prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [inSession, result, practiceMode, settings.timerSeconds, remainingSec]);

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

  const masteredCount = filtered.filter((item) => (progress[item.id]?.box ?? 1) >= TARGET_BOX).length;

  function updateDailyStats(itemId, isCorrect, elapsedSeconds, selectedAnswer, timedOut) {
    setDailyState((prev) => {
      const answeredIds = prev.stats.answeredIds.includes(itemId)
        ? prev.stats.answeredIds
        : [...prev.stats.answeredIds, itemId];
      const missedIds = isCorrect ? prev.stats.missedIds : [...prev.stats.missedIds, itemId];
      const wrongDetails = isCorrect
        ? prev.stats.wrongDetails
        : [
            ...prev.stats.wrongDetails,
            {
              id: itemId,
              selectedAnswer: selectedAnswer ?? "",
              reason: timedOut ? "timeout" : "wrong",
            },
          ];
      return {
        ...prev,
        stats: {
          ...prev.stats,
          answered: prev.stats.answered + 1,
          correct: prev.stats.correct + (isCorrect ? 1 : 0),
          wrong: prev.stats.wrong + (isCorrect ? 0 : 1),
          elapsedSecondsTotal: prev.stats.elapsedSecondsTotal + elapsedSeconds,
          missedIds,
          answeredIds,
          wrongDetails,
        },
      };
    });
  }

  function buildDailyQueue() {
    const currentDate = todayKey();

    if (
      dailyState.dateKey === currentDate &&
      dailyState.queueIds.length > 0 &&
      dailyState.completed
    ) {
      setScreen(SCREENS.SUMMARY);
      return [];
    }

    if (dailyState.dateKey === currentDate && dailyState.queueIds.length > 0) {
      return dailyState.queueIds
        .map((id) => filtered.find((item) => item.id === id))
        .filter(Boolean);
    }

    const targetCount = settings.dailyQuestionCount;
    const duePool = shuffle(dueItems);
    const freshPool = shuffle(filtered.filter((item) => !isDue(progress[item.id])));

    let selectedQueue = [];

    if (settings.sourceMode === "due_only") {
      selectedQueue = duePool.slice(0, targetCount);
    } else {
      const fromDue = duePool.slice(0, targetCount);
      const missing = targetCount - fromDue.length;
      const fromFresh = missing > 0 ? freshPool.slice(0, missing) : [];
      selectedQueue = shuffle([...fromDue, ...fromFresh]).slice(0, targetCount);
    }

    const nextState = {
      dateKey: currentDate,
      queueIds: selectedQueue.map((item) => item.id),
      completed: false,
      stats: {
        answered: 0,
        correct: 0,
        wrong: 0,
        elapsedSecondsTotal: 0,
        missedIds: [],
        answeredIds: [],
        wrongDetails: [],
      },
    };

    setDailyState(nextState);
    return selectedQueue;
  }

  function startSession() {
    const queue =
      practiceMode === PRACTICE_MODES.DAILY_EXAM
        ? buildDailyQueue()
        : shuffle(dueItems);

    if (queue.length === 0) {
      if (practiceMode === PRACTICE_MODES.DAILY_EXAM) {
        setScreen(SCREENS.SUMMARY);
      }
      return;
    }

    setSessionQueue(queue);
    setIndex(0);
    setSelected("");
    setResult(null);
    setScreen(SCREENS.HOME);
  }

  function submitAnswer(choice, timedOut = false) {
    if (!currentItem || result) return;

    const isCorrect = choice === correctAnswer;
    const now = Date.now();

    setProgress((prev) => ({
      ...prev,
      [currentItem.id]: evaluateAnswer(prev[currentItem.id], isCorrect, now),
    }));

    if (practiceMode === PRACTICE_MODES.DAILY_EXAM) {
      const elapsedSeconds = Math.max(
        1,
        Math.round((now - (questionStartedAt ?? now)) / 1000)
      );
      updateDailyStats(currentItem.id, isCorrect, elapsedSeconds, choice, timedOut);
    }

    setSelected(choice ?? "");
    setResult(timedOut ? "timeout" : isCorrect ? "correct" : "wrong");
  }

  function nextQuestion() {
    const isLast = index + 1 >= sessionQueue.length;

    if (isLast) {
      if (practiceMode === PRACTICE_MODES.DAILY_EXAM) {
        setDailyState((prev) => ({ ...prev, completed: true }));
        setScreen(SCREENS.SUMMARY);
      }
      endSession();
      return;
    }

    setSelected("");
    setResult(null);
    setIndex((prev) => prev + 1);
  }

  function endSession() {
    setSessionQueue([]);
    setIndex(0);
    setSelected("");
    setResult(null);
    setRemainingSec(null);
  }

  function resetProgress() {
    const next = initialProgress(items);
    setProgress(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    endSession();
  }

  const dailyTarget = settings.dailyQuestionCount;
  const avgSeconds =
    dailyState.stats.answered > 0
      ? (dailyState.stats.elapsedSecondsTotal / dailyState.stats.answered).toFixed(1)
      : "0.0";

  const missedTop = useMemo(() => {
    const countMap = new Map();
    for (const id of dailyState.stats.missedIds) {
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
    return [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const item = items.find((it) => it.id === id);
        return item ? `${item.term} (${count})` : id;
      });
  }, [dailyState.stats.missedIds, items]);

  const wrongRows = useMemo(
    () =>
      (dailyState.stats.wrongDetails || []).map((entry) => {
        const item = items.find((it) => it.id === entry.id);
        return {
          id: entry.id,
          term: item?.term || entry.id,
          meaning: item?.meaning || "N/A",
          yourAnswer: entry.selectedAnswer || "No answer",
          reason: entry.reason,
        };
      }),
    [dailyState.stats.wrongDetails, items]
  );

  const unansweredRows = useMemo(() => {
    const answeredSet = new Set(dailyState.stats.answeredIds || []);
    return (dailyState.queueIds || [])
      .filter((id) => !answeredSet.has(id))
      .map((id) => {
        const item = items.find((it) => it.id === id);
        return {
          id,
          term: item?.term || id,
          meaning: item?.meaning || "N/A",
        };
      });
  }, [dailyState.queueIds, dailyState.stats.answeredIds, items]);

  return (
    <div className="page">
      {!inSession && screen !== SCREENS.SETTINGS && (
        <header className="hero">
          <h1>English Memory Builder</h1>
          <p>Question loop + spaced repetition for Words and Phrasal Verbs.</p>
        </header>
      )}

      <main className="container">
        {!inSession && screen === SCREENS.HOME && (
          <>
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
              </div>
              <div className="segmented">
                <button
                  type="button"
                  className={practiceMode === PRACTICE_MODES.NORMAL ? "seg active" : "seg"}
                  onClick={() => setPracticeMode(PRACTICE_MODES.NORMAL)}
                >
                  Normal Mode
                </button>
                <button
                  type="button"
                  className={practiceMode === PRACTICE_MODES.DAILY_EXAM ? "seg active" : "seg"}
                  onClick={() => setPracticeMode(PRACTICE_MODES.DAILY_EXAM)}
                >
                  Daily Exam Mode
                </button>
              </div>
              <div className="actions">
                <button type="button" onClick={startSession}>
                  {practiceMode === PRACTICE_MODES.DAILY_EXAM
                    ? `Start Daily Exam (${dailyTarget})`
                    : `Start Due Session (${dueItems.length})`}
                </button>
                {practiceMode === PRACTICE_MODES.DAILY_EXAM && (
                  <button type="button" className="ghost" onClick={() => setScreen(SCREENS.SETTINGS)}>
                    Settings
                  </button>
                )}
                {dailyState.dateKey === todayKey() && practiceMode === PRACTICE_MODES.DAILY_EXAM && (
                  <button type="button" className="ghost" onClick={() => setScreen(SCREENS.SUMMARY)}>
                    View Today Summary
                  </button>
                )}
                <button type="button" className="ghost" onClick={resetProgress}>
                  Reset All Progress
                </button>
              </div>
            </section>

            <section className="panel stats">
              <p>Total: {filtered.length}</p>
              <p>Due now: {dueItems.length}</p>
              <p>Mastered: {masteredCount}</p>
              <p>Completed: {completed ? "Yes" : "Not yet"}</p>
              <p>Mode: {quizMode.replaceAll("_", " ")}</p>
            </section>
          </>
        )}

        {!inSession && screen === SCREENS.SETTINGS && (
          <section className="panel settings-panel">
            <h2>Daily Exam Settings</h2>
            <label>
              Daily questions (10 - 50)
              <input
                type="number"
                min="10"
                max="50"
                value={settings.dailyQuestionCount}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    dailyQuestionCount: Math.max(10, Math.min(50, Number(event.target.value || 10))),
                  }))
                }
              />
            </label>

            <label>
              Timer per question
              <select
                value={settings.timerSeconds}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, timerSeconds: Number(event.target.value) }))
                }
              >
                <option value={0}>Off</option>
                <option value={10}>10 sec</option>
                <option value={15}>15 sec</option>
                <option value={20}>20 sec</option>
              </select>
            </label>

            <label>
              Daily source
              <select
                value={settings.sourceMode}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, sourceMode: event.target.value }))
                }
              >
                <option value="mixed">Mixed (Due + New)</option>
                <option value="due_only">Due only</option>
              </select>
            </label>

            <div className="actions">
              <button type="button" onClick={() => setScreen(SCREENS.HOME)}>
                Back
              </button>
            </div>
          </section>
        )}

        {!inSession && screen === SCREENS.SUMMARY && (
          <section className="panel settings-panel">
            <h2>Daily Summary</h2>
            <p>Date: {dailyState.dateKey || todayKey()}</p>
            <p>
              Completed: {dailyState.stats.answered} / {dailyTarget}
            </p>
            <p>
              Accuracy: {dailyState.stats.answered > 0
                ? `${Math.round((dailyState.stats.correct / dailyState.stats.answered) * 100)}%`
                : "0%"}
            </p>
            <p>Correct: {dailyState.stats.correct}</p>
            <p>Incorrect: {dailyState.stats.wrong}</p>
            <p>Avg answer time: {avgSeconds}s</p>
            <p>
              Most missed: {missedTop.length > 0 ? missedTop.join(", ") : "No misses today"}
            </p>

            <h3>Missed / Timed Out</h3>
            {wrongRows.length === 0 ? (
              <p>None</p>
            ) : (
              <div>
                {wrongRows.map((row) => (
                  <p key={`${row.id}-${row.reason}-${row.yourAnswer}`}>
                    {row.term}: {row.meaning} | Your answer: {row.yourAnswer} ({row.reason})
                  </p>
                ))}
              </div>
            )}

            <h3>Not Answered</h3>
            {unansweredRows.length === 0 ? (
              <p>None</p>
            ) : (
              <div>
                {unansweredRows.map((row) => (
                  <p key={`unanswered-${row.id}`}>
                    {row.term}: {row.meaning}
                  </p>
                ))}
              </div>
            )}

            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  setScreen(SCREENS.HOME);
                  setPracticeMode(PRACTICE_MODES.DAILY_EXAM);
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setDailyState(defaultDailyState());
                  setScreen(SCREENS.HOME);
                  setPracticeMode(PRACTICE_MODES.DAILY_EXAM);
                }}
              >
                Retake Today
              </button>
            </div>
          </section>
        )}

        {(inSession || screen === SCREENS.HOME) && (
          <section className="panel review">
            {!currentItem && screen === SCREENS.HOME && (
              <div>
                <h2>Ready</h2>
                <p>
                  {practiceMode === PRACTICE_MODES.DAILY_EXAM
                    ? "Tap \"Start Daily Exam\" for today’s session."
                    : 'Tap "Start Due Session" to practice only due questions.'}
                </p>
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
                {practiceMode === PRACTICE_MODES.DAILY_EXAM && remainingSec !== null && (
                  <p className="timer">Time left: {remainingSec}s</p>
                )}
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
                      onClick={() => submitAnswer(choice)}
                      disabled={Boolean(result)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>

                {result && (
                  <div className="feedback">
                    <p>
                      {result === "correct"
                        ? "Correct."
                        : result === "timeout"
                          ? "Time out."
                          : "Incorrect."}{" "}
                      {currentItem.example}
                    </p>
                    <button type="button" onClick={nextQuestion}>
                      {index + 1 < sessionQueue.length ? "Next" : "Finish"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
