import React, { useState } from "react";

// Small shared presentational components for quiz media and hints

export const QuizMedia = ({
  imageUrl,
  imageAlt = "Question image",
  audioUrl,
  containerClass = "",
  imageClass = "",
  audioClass = "",
}) => {
  if (!imageUrl && !audioUrl) return null;
  return (
    <div className={containerClass}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={imageAlt || "Question image"}
          className={imageClass}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      {audioUrl ? (
        <audio controls src={audioUrl} className={audioClass}>
          Your browser does not support the audio element.
        </audio>
      ) : null}
    </div>
  );
};

export const HintBlock = ({
  hint1,
  hint2,
  mode = "collapsible", // 'collapsible' | 'visible'
  containerClass = "",
  hintButtonClass = "",
  hintDisplayClass = "",
  onHintUsed = null, // callback(hintNumber) when a hint is revealed
}) => {
  const [shown, setShown] = useState(null);
  const hasHints = Boolean(hint1) || Boolean(hint2);
  if (!hasHints) return null;

  const handleShowHint = (hintNum) => {
    setShown(hintNum);
    if (onHintUsed) onHintUsed(hintNum);
  };

  if (mode === "visible") {
    return (
      <div className={containerClass}>
        {hint1 ? (
          <div className={hintDisplayClass}>
            <strong>Hint 1:</strong> {hint1}
          </div>
        ) : null}
        {hint2 ? (
          <div className={hintDisplayClass}>
            <strong>Hint 2:</strong> {hint2}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {hint1 ? (
        <button
          type="button"
          className={hintButtonClass}
          onClick={() => handleShowHint(1)}
          disabled={shown === 1}
        >
          Hint 1
        </button>
      ) : null}
      {hint2 ? (
        <button
          type="button"
          className={hintButtonClass}
          onClick={() => handleShowHint(2)}
          disabled={shown === 2}
        >
          Hint 2
        </button>
      ) : null}
      {shown ? (
        <div className={hintDisplayClass}>
          <strong>Hint {shown}:</strong> {shown === 1 ? hint1 : hint2}
        </div>
      ) : null}
    </div>
  );
};

export default { QuizMedia, HintBlock };
