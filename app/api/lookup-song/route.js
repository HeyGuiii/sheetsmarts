import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are a piano sheet music expert. The user wants to practice a specific piece. If you know this piece, return the complete note-by-note transcription.

Return ONLY a JSON object (no markdown, no explanation, no code fences):

If you KNOW the piece:
{
  "found": true,
  "title": "exact title",
  "timeSignature": [4, 4],
  "keySignature": "C",
  "tempo": 100,
  "notes": [
    { "pitch": ["C4"], "duration": "4n", "measure": 1, "beat": 1, "hand": "right" }
  ]
}

If you DO NOT know the piece:
{ "found": false }

Rules for notes:
- pitch: ALWAYS an array. Single notes: ["E4"]. Chords: ["C4", "E4", "G4"]. Rests: ["REST"].
- Use scientific pitch notation. Middle C = "C4". Sharps: "#". Flats: "b".
- duration: "1n"=whole, "2n"=half, "4n"=quarter, "8n"=eighth, "16n"=sixteenth. Dotted: add "."
- hand: "right" for treble clef, "left" for bass clef
- measure: starting at 1. beat: starting at 1.
- Include BOTH hands (treble and bass clef).
- Be precise — this will be played back as audio. Every note matters.
- For beginner arrangements, use the simplified version from the specific book if you know it.`;

export async function POST(request) {
  try {
    const { book, songTitle, notes } = await request.json();

    if (!songTitle) {
      return Response.json({ error: "No song title provided" }, { status: 400 });
    }

    let query = `Find this piano piece and return all the notes:\n\nSong: "${songTitle}"`;
    if (book) query += `\nBook: "${book}"`;
    if (notes) query += `\nAdditional info: ${notes}`;
    query += `\n\nIf you know this exact arrangement (especially from this specific book/level), return the full transcription. If you're not confident you know the exact notes, return { "found": false }.`;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        { role: "user", content: query },
      ],
      system: PROMPT,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let gotFirstToken = false;
        const keepalive = setInterval(() => {
          if (!gotFirstToken) controller.enqueue(encoder.encode(" "));
        }, 3000);

        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              gotFirstToken = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          clearInterval(keepalive);
          controller.close();
        } catch (err) {
          clearInterval(keepalive);
          controller.enqueue(encoder.encode(JSON.stringify({ error: err?.message || "Stream error" })));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (err) {
    const detail = err?.status
      ? `API error ${err.status}: ${err?.error?.error?.message || err?.message}`
      : err?.message || "Unknown error";
    return Response.json({ error: detail }, { status: 500 });
  }
}
