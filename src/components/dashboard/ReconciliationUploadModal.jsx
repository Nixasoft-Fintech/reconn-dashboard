import { useEffect, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { getReconciliationCounts } from "../../utils/reconciliation";
import { submitReconciliation } from "../../services/reconciliationApi";

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadStep({
  step,
  title,
  description,
  files,
  onAddFiles,
  onRemoveFile,
  disabled,
}) {
  return (
    <section className="upload-step">
      <div className="upload-step-heading">
        <span className="upload-step-number">{step}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <label className="upload-picker">
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          multiple
          disabled={disabled}
          onChange={(event) => {
            onAddFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Upload size={18} />
        <span>Choose files</span>
        <small>CSV, XLS, XLSX · Multiple files allowed</small>
      </label>

      {files.length > 0 && (
        <ul className="selected-files">
          {files.map((file, index) => (
            <li
              className="selected-file"
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              <FileText size={17} />
              <span className="selected-file-details">
                <span className="selected-file-name">{file.name}</span>
                <span className="selected-file-size">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <button
                className="remove-file-button"
                type="button"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveFile(index)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SNAKE_GRID = { columns: 16, rows: 9, cellSize: 18 };
const SNAKE_DIRECTIONS = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const SNACK_POSITIONS = [
  { x: 11, y: 4 },
  { x: 13, y: 2 },
  { x: 9, y: 7 },
  { x: 2, y: 2 },
  { x: 6, y: 5 },
  { x: 14, y: 6 },
  { x: 4, y: 7 },
];

function createSnakeGame() {
  return {
    snake: [
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ],
    direction: "right",
    snack: SNACK_POSITIONS[0],
    snackIndex: 0,
  };
}

function getNextSnack(snake, snackIndex) {
  for (let offset = 0; offset < SNACK_POSITIONS.length; offset += 1) {
    const position =
      SNACK_POSITIONS[(snackIndex + offset) % SNACK_POSITIONS.length];
    if (!snake.some((segment) => segment.x === position.x && segment.y === position.y)) {
      return position;
    }
  }

  return { x: 14, y: 7 };
}

function advanceSnakeGame(game) {
  const head = game.snake[0];
  const reverseDirection = {
    up: "down",
    right: "left",
    down: "up",
    left: "right",
  }[game.direction];
  const candidates = Object.entries(SNAKE_DIRECTIONS)
    .filter(([direction]) => direction !== reverseDirection)
    .map(([direction, delta]) => ({
      direction,
      x: head.x + delta.x,
      y: head.y + delta.y,
    }))
    .filter(
      ({ x, y }) =>
        x >= 0 &&
        x < SNAKE_GRID.columns &&
        y >= 0 &&
        y < SNAKE_GRID.rows,
    )
    .sort((first, second) => {
      const firstDistance =
        Math.abs(first.x - game.snack.x) + Math.abs(first.y - game.snack.y);
      const secondDistance =
        Math.abs(second.x - game.snack.x) + Math.abs(second.y - game.snack.y);
      if (firstDistance !== secondDistance) {
        return firstDistance - secondDistance;
      }

      return (
        Number(second.direction === game.direction) -
        Number(first.direction === game.direction)
      );
    });
  const nextHead = candidates.find(({ x, y }) => {
    const willEat = x === game.snack.x && y === game.snack.y;
    const occupied = willEat ? game.snake : game.snake.slice(0, -1);
    return !occupied.some((segment) => segment.x === x && segment.y === y);
  });

  if (!nextHead) {
    return createSnakeGame();
  }

  const willEat = nextHead.x === game.snack.x && nextHead.y === game.snack.y;
  const snake = [
    { x: nextHead.x, y: nextHead.y },
    ...game.snake.slice(0, willEat ? undefined : -1),
  ];
  const snackIndex = willEat ? game.snackIndex + 1 : game.snackIndex;

  return {
    snake,
    direction: nextHead.direction,
    snack: willEat ? getNextSnack(snake, snackIndex) : game.snack,
    snackIndex,
  };
}

function getGridPosition(position) {
  return {
    left: `${position.x * SNAKE_GRID.cellSize + 1}px`,
    top: `${position.y * SNAKE_GRID.cellSize + 1}px`,
  };
}

function SnakeGame() {
  const [game, setGame] = useState(createSnakeGame);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGame(advanceSnakeGame);
    }, 190);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="snake-game">
      <div className="snake-game-hud">
        <span>FILE UPLOAD</span>
        <span className="snake-game-autoplay">AUTO PLAY</span>
      </div>
      <div
        className="snake-game-board"
        role="img"
        aria-label="Auto-playing snake game collecting snacks"
      >
        {game.snake.slice(1).map((segment, index) => (
          <span
            className="snake-game-segment"
            key={`snake-${index}`}
            style={getGridPosition(segment)}
          />
        ))}
        <span
          className={`snake-game-head direction-${game.direction}`}
          style={getGridPosition(game.snake[0])}
        />
        <span
          className="snake-game-snack"
          style={getGridPosition(game.snack)}
          aria-hidden="true"
        >
          <span />
        </span>
      </div>
    </div>
  );
}

function UploadProgressOverlay({ isAwaitingResult }) {
  return (
    <div className="upload-progress-overlay">
      <section className="upload-progress-card" aria-busy="true">
        <span className="upload-modal-eyebrow">RECONCILIATION IN PROGRESS</span>
        <h2>
          {isAwaitingResult ? "Getting everything ready" : "Uploading your files"}
        </h2>
        <SnakeGame />
        <p className="upload-progress-message" role="status" aria-live="polite">
          {isAwaitingResult
            ? "Files are in. We’re preparing your reconciliation."
            : "Your files are uploading. The snake is collecting snacks!"}
        </p>
        <span className="upload-progress-hint">
          Hang on — the game keeps going while we get things ready.
        </span>
      </section>
    </div>
  );
}

export default function ReconciliationUploadModal({
  isOpen,
  onClose,
  onSubmitted,
  onNotify,
}) {
  const [vaFiles, setVaFiles] = useState([]);
  const [fundFiles, setFundFiles] = useState([]);
  const [statementFiles, setStatementFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAwaitingResult, setIsAwaitingResult] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  const canSubmit =
    vaFiles.length > 0 && fundFiles.length > 0 && statementFiles.length > 0;

  const addFiles = (setFiles, newFiles) => {
    setFiles((currentFiles) => [...currentFiles, ...newFiles]);
  };
  const removeFile = (setFiles, indexToRemove) => {
    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setResult(null);

    if (!canSubmit) {
      const message = "Select at least one file in each section.";
      setSubmitError(message);
      onNotify?.("error", message);
      return;
    }

    setIsSubmitting(true);
    setIsAwaitingResult(false);

    try {
      const responseData = await submitReconciliation({
        fundFiles,
        vaFiles,
        statementFiles,
        onUploadProgress: (progress) => {
          if (progress >= 100) {
            setIsAwaitingResult(true);
          }
        },
      });
      if (typeof responseData.job_id !== "string" || !responseData.job_id) {
        throw new Error("The reconciliation API response did not include a job ID.");
      }

      setIsAwaitingResult(true);
      setResult(responseData);
      onSubmitted({
        jobId: responseData.job_id,
        submittedAt: new Date().toISOString(),
        files: [
          ...vaFiles.map((file) => ({ type: "VA Transaction", file })),
          ...fundFiles.map((file) => ({ type: "Fund Request", file })),
          ...statementFiles.map((file) => ({
            type: "Account Statement",
            file,
          })),
        ],
        result: responseData,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit reconciliation files.";
      setSubmitError(message);
      onNotify?.("error", `Could not submit reconciliation: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="upload-modal-backdrop">
      <form
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <header className="upload-modal-header">
          <div>
            <span className="upload-modal-eyebrow">TRANSACTION MATCHING</span>
            <h2 id="upload-modal-title">Reconcile transactions</h2>
            <p>Add the files in the order shown to prepare a reconciliation.</p>
          </div>
          <button
            className="upload-modal-close"
            type="button"
            aria-label="Close reconciliation upload"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="upload-modal-content">
          <UploadStep
            step="01"
            title="VA Transaction"
            description="Select one or more VA transaction files."
            files={vaFiles}
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setVaFiles, files)}
            onRemoveFile={(index) => removeFile(setVaFiles, index)}
          />
          <UploadStep
            step="02"
            title="Fund Request"
            description="Select one or more fund request files."
            files={fundFiles}
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setFundFiles, files)}
            onRemoveFile={(index) => removeFile(setFundFiles, index)}
          />
          <UploadStep
            step="03"
            title="Account Statement"
            description="Select one or more account statement files."
            files={statementFiles}
            disabled={isSubmitting}
            onAddFiles={(files) => addFiles(setStatementFiles, files)}
            onRemoveFile={(index) => removeFile(setStatementFiles, index)}
          />
          {submitError && (
            <p className="upload-submit-error" role="alert">
              {submitError}
            </p>
          )}
          {result && (
            <ReconciliationSuccess result={result} />
          )}
        </div>

        <footer className="upload-modal-footer">
          <p>
            {canSubmit
              ? "All three file types are ready to submit."
              : "Select at least one file in each section to submit."}
          </p>
          <div className="upload-modal-actions">
            <button
              className="upload-modal-done"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="upload-modal-submit"
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </footer>
        {isSubmitting && (
          <UploadProgressOverlay isAwaitingResult={isAwaitingResult} />
        )}
      </form>
    </div>
  );
}

function ReconciliationSuccess({ result }) {
  const { sourceCount, matchedCount } = getReconciliationCounts(result.summary);

  return (
    <p className="upload-submit-success" role="status">
      Reconciliation completed: {matchedCount} of {sourceCount} source
      transactions matched.
    </p>
  );
}
