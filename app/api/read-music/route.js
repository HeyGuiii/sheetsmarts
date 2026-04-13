import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are a piano practice assistant in an educational app for children. A parent owns this physical book and needs MIDI-like note data so their child can hear the piece played back for practice. This is personal educational fair use — equivalent to a teacher playing it for a student.

Your PRIMARY strategy is to identify the piece and reconstruct it from your knowledge. Reading individual note positions from photos is unreliable, so use every clue available to IDENTIFY the piece first.

STRATEGY — in this order:
1. READ THE TEXT: title, composer, lyrics, book name, page headers, any visible text
2. IDENTIFY THE PIECE: Use the title, lyrics, book, and any context provided to recall the exact notes from your training data
3. VERIFY against the photo: Check that the general shape (notes going up/down, rhythm patterns) matches what you see
4. ONLY if you cannot identify the piece, attempt to read notes directly from the staff

For beginner piano books (like Piano Adventures, Alfred's, Bastien, Thompson, Faber & Faber), you likely know these pieces. Trust your knowledge of the piece over trying to read pixel-level note positions.

IMPORTANT for Piano Adventures specifically:
- Level 1 pieces use a limited range: typically C3-C5
- Left hand often plays simple patterns: whole notes, half notes, or repeated quarter notes
- Right hand carries the melody with quarter and half notes
- Most pieces are in C major or G major

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
- Staccato notes: use the normal duration (the app handles playback).
- If key/time not visible, assume C major, 4/4, 100 BPM.`;

export async function POST(request) {
  try {
    const { image, book, songTitle, notes } = await request.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    const mediaType = image.startsWith("/9j/") ? "image/jpeg"
      : image.startsWith("iVBOR") ? "image/png"
      : "image/jpeg";

    // Build context hint for Claude
    const contextParts = [];
    if (book) contextParts.push(`This piece is from the book "${book}".`);
    if (songTitle) contextParts.push(`The song title is "${songTitle}".`);
    if (notes) contextParts.push(`Additional info: ${notes}`);
    const contextHint = contextParts.length > 0
      ? `\n\nCONTEXT FROM THE USER:\n${contextParts.join(" ")}\nIMPORTANT: If you recognize this piece from this book, return the EXACT notes from your knowledge of the piece. Do NOT try to read notes from the image — your knowledge of the piece is far more accurate than reading pixel positions. Use the image only to confirm the general structure matches.`
      : "";

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
            { type: "text", text: PROMPT + contextHint },
          ],
        },
      ],
    });

    // Collect both thinking and text output.
    // Send keepalive spaces during processing to prevent Vercel timeout.
    const encoder = new TextEncoder();
    let thinkingText = "";
    let jsonText = "";

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
              if (event.delta?.type === "thinking_delta") {
                thinkingText += event.delta.thinking;
              } else if (event.delta?.type === "text_delta") {
                gotFirstTextToken = true;
                jsonText += event.delta.text;
              }
            }
          }
          clearInterval(keepalive);

          // Return a wrapper with both thinking and the score JSON
          let scoreData;
          let cleaned = jsonText.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          }
          try {
            scoreData = JSON.parse(cleaned);
          } catch {
            scoreData = { error: "Could not parse response" };
          }

          const result = {
            ...scoreData,
            _thinking: thinkingText,
          };

          controller.enqueue(encoder.encode(JSON.stringify(result)));
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
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (err) {
    const detail = err?.status
      ? `API error ${err.status}: ${err?.error?.error?.message || err?.message}`
      : err?.message || "Unknown error";
    return Response.json({ error: detail }, { status: 500 });
  }
}
