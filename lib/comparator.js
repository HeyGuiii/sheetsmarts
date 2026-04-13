import { semitoneDifference } from "./noteUtils";

export function comparePerformance(expectedNotes, recordedNotes) {
  const results = [];
  const filteredExpected = expectedNotes.filter((n) => n.pitch !== "REST");

  for (let i = 0; i < filteredExpected.length; i++) {
    const expected = filteredExpected[i];
    const played = recordedNotes[i] || null;

    if (!played) {
      results.push({
        expected: expected.pitch,
        played: null,
        status: "missed",
        pitchCorrect: false,
        message: `You missed the ${expected.pitch.replace(/\d/, "")} — try again!`,
      });
      continue;
    }

    const diff = semitoneDifference(expected.pitch, played.pitch);

    if (diff === 0) {
      results.push({
        expected: expected.pitch,
        played: played.pitch,
        status: "perfect",
        pitchCorrect: true,
        message: "Perfect!",
      });
    } else if (diff <= 1) {
      results.push({
        expected: expected.pitch,
        played: played.pitch,
        status: "close",
        pitchCorrect: false,
        message: `So close! You played ${played.pitch.replace(/\d/, "")} instead of ${expected.pitch.replace(/\d/, "")}`,
      });
    } else {
      results.push({
        expected: expected.pitch,
        played: played.pitch,
        status: "wrong",
        pitchCorrect: false,
        message: `Watch this one — it should be ${expected.pitch.replace(/\d/, "")} but you played ${played.pitch.replace(/\d/, "")}`,
      });
    }
  }

  // Extra notes played beyond what was expected
  if (recordedNotes.length > filteredExpected.length) {
    const extraCount = recordedNotes.length - filteredExpected.length;
    results.push({
      expected: null,
      played: `${extraCount} extra`,
      status: "extra",
      pitchCorrect: false,
      message: `You played ${extraCount} extra note${extraCount > 1 ? "s" : ""} — try to stop at the end!`,
    });
  }

  return results;
}

export function getOverallFeedback(results) {
  const total = results.filter((r) => r.status !== "extra").length;
  const perfect = results.filter((r) => r.status === "perfect").length;
  const close = results.filter((r) => r.status === "close").length;
  const percentage = total > 0 ? (perfect / total) * 100 : 0;

  let stars, message;
  if (percentage >= 90) {
    stars = 3;
    message = "Amazing! You nailed it!";
  } else if (percentage >= 70) {
    stars = 2;
    message = "Great job! Almost there!";
  } else if (percentage >= 50) {
    stars = 2;
    message = "Good effort! Keep practicing!";
  } else {
    stars = 1;
    message = "Nice try! Let's keep working on it!";
  }

  return {
    stars,
    message,
    perfect,
    close,
    missed: results.filter((r) => r.status === "missed").length,
    wrong: results.filter((r) => r.status === "wrong").length,
    total,
    percentage: Math.round(percentage),
  };
}
