const STORAGE_KEY = "sheetsmarts-library";

export function getSavedSongs() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSong(score, imageBase64 = null) {
  const songs = getSavedSongs();
  const song = {
    id: Date.now().toString(),
    title: score.title || `Song ${songs.length + 1}`,
    score,
    image: imageBase64,
    savedAt: new Date().toISOString(),
  };
  songs.unshift(song); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  return song;
}

export function deleteSong(id) {
  const songs = getSavedSongs().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}
