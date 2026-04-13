import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are an expert sheet music reader for a piano practice app. Your job is to accurately extract every note from the photo so the app can play back the piece correctly.

IMPORTANT: Read very carefully. Take your time to identify each note precisely. Getting notes wrong will make the playback sound wrong.

Return ONLY a JSON object with this exact structure (no markdown, no explanation, no code fences):

{
  "title": "string or null",
  "timeSignature": [4, 4],
  "keySignature": "C",
  "tempo": 100,
  "notes": [
    { "pitch": ["C4"], "duration": "4n", "measure": 1, "beat": 1, "hand": "right" }
  ]
}

STEP 1 — READ THE KEY SIGNATURE FIRST:
- Count the sharps or flats at the beginning of the staff next to the clef.
- Sharps order: F# C# G# D# A# E# B#
- Flats order: Bb Eb Ab Db Gb Cb Fb
- The key signature applies to ALL notes of that letter name in every octave unless cancelled by a natural sign.
- Example: Key of G (1 sharp) means every F is played as F#, so write "F#4" not "F4".
- Example: Key of F (1 flat) means every B is played as Bb, so write "Bb4" not "B4".

STEP 2 — READ EACH NOTE:
- pitch: ALWAYS an array. Single notes: ["E4"]. Chords (stacked notes): ["C4", "E4", "G4"]. Rests: ["REST"].
- Use scientific pitch notation. Middle C (on the ledger line below treble staff) = "C4".
- Treble clef lines bottom to top: E4, G4, B4, D5, F5. Spaces: F4, A4, C5, E5.
- Bass clef lines bottom to top: G2, B2, D3, F3, A3. Spaces: A2, C3, E3, G3.
- Apply accidentals: # (sharp), b (flat), natural (cancels key signature). An accidental lasts for the rest of that measure.
- BOTH CLEFS: Read treble (hand="right") AND bass (hand="left"). Notes on the same beat get separate entries.

STEP 3 — DURATION:
- "1n" = whole (4 beats), "2n" = half (2 beats), "4n" = quarter (1 beat), "8n" = eighth (half beat), "16n" = sixteenth.
- Dotted notes: add ".": "2n." = 3 beats, "4n." = 1.5 beats.
- Tied notes: merge into combined duration. Two tied quarter notes = "2n".

STEP 4 — STRUCTURE:
- Number measures starting at 1, beats starting at 1.
- If time signature is not visible, assume 4/4.
- If key signature is not visible, assume C major (no sharps or flats).
- If tempo is not marked, assume 100 BPM.
- Ignore dynamics (p, f, mf), fingering numbers, pedal marks, and expression text.
- Do NOT skip pickup measures (anacrusis) — include them as measure 1.`;

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    // Detect image type from base64 header bytes
    const mediaType = image.startsWith("/9j/") ? "image/jpeg"
      : image.startsWith("iVBOR") ? "image/png"
      : "image/jpeg";

    // Use streaming to avoid Vercel's 10s timeout on Hobby plan.
    // Streaming keeps the connection alive as long as data is flowing.
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    // Stream the response chunks back to the client.
    // Send a space every 3s as a keepalive to prevent Vercel from
    // killing the function during Claude's initial image processing.
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let gotFirstToken = false;
        const keepalive = setInterval(() => {
          if (!gotFirstToken) {
            controller.enqueue(encoder.encode(" "));
          }
        }, 3000);

        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta"
            ) {
              gotFirstToken = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          clearInterval(keepalive);
          controller.close();
        } catch (err) {
          clearInterval(keepalive);
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: err?.message || "Stream error" }))
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const detail = err?.status
      ? `API error ${err.status}: ${err?.error?.error?.message || err?.message}`
      : err?.message || "Unknown error";
    return Response.json({ error: detail }, { status: 500 });
  }
}
