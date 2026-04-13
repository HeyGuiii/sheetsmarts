import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are a sheet music reader for a beginner piano app. Analyze this photo of sheet music and extract the notes.

Return ONLY a JSON object with this exact structure (no markdown, no explanation, no code fences):

{
  "title": "string or null",
  "timeSignature": [4, 4],
  "keySignature": "C",
  "tempo": 100,
  "notes": [
    { "pitch": "C4", "duration": "4n", "measure": 1, "beat": 1 }
  ]
}

Rules:
- pitch: Use scientific notation. Middle C = "C4". Use sharps as "#" and flats as "b". For rests, use "REST".
- duration: Use Tone.js notation: "1n" = whole, "2n" = half, "4n" = quarter, "8n" = eighth, "16n" = sixteenth. Add "." for dotted notes (e.g. "4n.").
- Tied notes: Merge into a single note with combined duration. Two tied quarter notes = "2n".
- If the time signature is not visible, assume 4/4.
- If the key signature is not visible, assume C major.
- If tempo marking is not visible, assume 100 BPM.
- Only extract the treble clef (right hand). Ignore bass clef if present.
- Number measures starting at 1. Number beats starting at 1.
- This is beginner sheet music, so expect simple melodies: mostly quarter and half notes in the range C4-C6.`;

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
      max_tokens: 2048,
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

    // Stream the response chunks back to the client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
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
