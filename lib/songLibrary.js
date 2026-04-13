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

// Shrink a base64 image to a tiny thumbnail for storage
function createThumbnail(imageBase64) {
  return new Promise((resolve) => {
    if (!imageBase64) { resolve(null); return; }
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext("2d");
        // Center crop
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 80, 80);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.4);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/jpeg;base64,${imageBase64}`;
    } catch {
      resolve(null);
    }
  });
}

export async function saveSong(score, imageBase64 = null) {
  try {
    const thumbnail = await createThumbnail(imageBase64);
    const songs = getSavedSongs();
    const song = {
      id: Date.now().toString(),
      title: score.title || `Song ${songs.length + 1}`,
      score,
      image: thumbnail, // tiny 80x80 thumbnail, not full image
      savedAt: new Date().toISOString(),
    };
    songs.unshift(song);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    return song;
  } catch (err) {
    // localStorage full or other error — don't crash the app
    console.warn("Could not save song:", err);
    return null;
  }
}

export function deleteSong(id) {
  try {
    const songs = getSavedSongs().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch {}
}
