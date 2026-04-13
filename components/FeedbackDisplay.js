"use client";

import { comparePerformance, getOverallFeedback } from "../lib/comparator";
import { getNoteColor } from "../lib/noteUtils";

export default function FeedbackDisplay({ expectedNotes, recordedNotes, onTryAgain }) {
  const results = comparePerformance(expectedNotes, recordedNotes);
  const overall = getOverallFeedback(results);

  const starDisplay = "⭐".repeat(overall.stars) + "☆".repeat(3 - overall.stars);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md">
      {/* Star rating */}
      <div className="text-center">
        <div className="text-4xl mb-2">{starDisplay}</div>
        <h2 className="text-2xl font-bold">{overall.message}</h2>
        <p className="text-gray-500 mt-1">
          {overall.perfect} out of {overall.total} notes perfect
        </p>
      </div>

      {/* Note-by-note breakdown */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-md">
        <h3 className="font-bold text-sm text-gray-500 uppercase mb-3">Note by Note</h3>
        <div className="flex flex-col gap-2">
          {results.filter((r) => r.status !== "extra").map((result, i) => (
            <div
              key={i}
              className={`
                flex items-center gap-3 rounded-xl px-3 py-2
                ${result.status === "perfect" ? "bg-green-50" : ""}
                ${result.status === "close" ? "bg-yellow-50" : ""}
                ${result.status === "wrong" ? "bg-red-50" : ""}
                ${result.status === "missed" ? "bg-gray-50" : ""}
              `}
            >
              {/* Status icon */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                  ${result.status === "perfect" ? "bg-green-500 animate-sparkle" : ""}
                  ${result.status === "close" ? "bg-yellow-500" : ""}
                  ${result.status === "wrong" ? "bg-red-500" : ""}
                  ${result.status === "missed" ? "bg-gray-400" : ""}
                `}
              >
                {result.status === "perfect" && "✓"}
                {result.status === "close" && "~"}
                {result.status === "wrong" && "✗"}
                {result.status === "missed" && "?"}
              </div>

              {/* Expected note block */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: getNoteColor(result.expected) }}
              >
                {result.expected?.replace(/\d/, "") || "–"}
              </div>

              {/* Arrow + played note */}
              <span className="text-gray-400">→</span>
              <div
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                  ${result.played ? "text-white" : "text-gray-400 border-2 border-dashed border-gray-300"}
                `}
                style={result.played ? { backgroundColor: getNoteColor(result.played) } : {}}
              >
                {result.played?.replace(/\d/, "") || "–"}
              </div>

              {/* Message */}
              <span className="text-xs text-gray-600 flex-1">{result.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Try again button */}
      <button
        onClick={onTryAgain}
        className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-10 py-4 text-xl font-bold active:scale-95 transition-all shadow-lg"
      >
        🔄 Try Again
      </button>
    </div>
  );
}
