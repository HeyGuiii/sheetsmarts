import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are reading sheet music from a photo. Your goal: produce a perfectly accurate JSON representation of every note so a piano app can play it back and it sounds exactly right.

IGNORE everything that is not musical notation:
- Colored stickers, dots, or highlights (practice aids)
- Finger numbers (1-5 near notes)
- Text instructions, titles, dynamics (p, f, mf), pedal marks
- Pencil marks or annotations

HOW TO READ — go slowly, one note at a time:

1. IDENTIFY THE CLEF AND KEY SIGNATURE
   - Treble clef (𝄞): lines from bottom = E4, G4, B4, D5, F5. Spaces = F4, A4, C5, E5.
   - Bass clef (𝄢): lines from bottom = G2, B2, D3, F3, A3. Spaces = A2, C3, E3, G3.
   - Count sharps/flats in the key signature. Apply them to ALL notes of that letter.

2. GO MEASURE BY MEASURE, LEFT TO RIGHT
   For each note or chord:
   - Look at WHERE the note head sits. Is it ON a line or IN a space?
   - Count from a known reference line. The middle line of treble staff = B4. The middle line of bass staff = D3.
   - If the note head is BELOW the staff, count down using ledger lines. The first ledger line below treble staff = C4 (middle C).
   - For chords: read every stacked note head from bottom to top.
   - For rests: identify the rest symbol type (whole, half, quarter, eighth).

3. DETERMINE DURATION by the note's appearance:
   - Whole note: open oval, no stem (4 beats)
   - Half note: open oval WITH stem (2 beats)
   - Quarter note: filled (black) oval WITH stem (1 beat)
   - Eighth note: filled oval with stem and ONE flag or beam (0.5 beats)
   - Dotted: adds 50% more duration
   - Tied notes: merge durations

OUTPUT FORMAT — return ONLY this JSON (no markdown, no explanation, no code fences):

{
  "title": "string or null",
  "timeSignature": [4, 4],
  "keySignature": "C",
  "tempo": 100,
  "notes": [
    { "pitch": ["C4"], "duration": "4n", "measure": 1, "beat": 1, "hand": "right" }
  ]
}

- pitch: ALWAYS an array. Use scientific notation. Middle C = "C4". Sharps: "#". Flats: "b". Rests: ["REST"].
- duration: "1n"=whole, "2n"=half, "4n"=quarter, "8n"=eighth, "16n"=sixteenth. Dotted: add "."
- hand: "right" for treble clef, "left" for bass clef
- measure: starting at 1. beat: starting at 1.
- If key/time not visible, assume C major, 4/4, 100 BPM.`;

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    const mediaType = image.startsWith("/9j/") ? "image/jpeg"
      : image.startsWith("iVBOR") ? "image/png"
      : "image/jpeg";

    // Use extended thinking so Claude can reason through each note carefully.
    // Then stream the final JSON output.
    const stream = await client.messages.stream({
      model: "claude-opus-4-20250514",
      max_tokens: 16000,
      thinking: {
        type: "enabled",
        budget_tokens: 10000,
      },
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

    // Stream only the text output (not the thinking blocks) back to the client.
    // Send keepalive spaces during thinking phase to prevent Vercel timeout.
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let gotFirstTextToken = false;
        const keepalive = setInterval(() => {
          if (!gotFirstTextToken) {
            controller.enqueue(encoder.encode(" "));
          }
        }, 3000);

        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta") {
              // Only stream text deltas, skip thinking deltas
              if (event.delta?.type === "text_delta") {
                gotFirstTextToken = true;
                controller.enqueue(encoder.encode(event.delta.text));
              }
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
