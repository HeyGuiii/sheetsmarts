import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPT = `You are a piano practice assistant. The user will describe notes in a simple text format. Convert their description into structured JSON for playback.

The user may write notes like:
- "A A A A G E E(2) E(w) E(w)" meaning A quarter, A quarter, A quarter, A quarter, G quarter, E quarter, E half, E whole, E whole
- Letters A-G are note names. Default octave is 4 for right hand, 3 for left hand.
- Numbers in parentheses indicate beats: (2)=half, (w)=whole, (d)=dotted quarter
- No parentheses = quarter note
- "rest" or "-" = a rest
- They may also say "nothing" for empty measures in one hand

Return ONLY a JSON object (no markdown, no code fences):

{
  "title": "string or null",
  "timeSignature": [4, 4],
  "keySignature": "C",
  "tempo": 100,
  "notes": [
    { "pitch": ["C4"], "duration": "4n", "measure": 1, "beat": 1, "hand": "right" }
  ]
}

Rules:
- pitch: ALWAYS an array. ["E4"] for single notes. ["REST"] for rests.
- duration: "1n"=whole, "2n"=half, "4n"=quarter, "8n"=eighth. Dotted: add "."
- hand: "right" or "left"
- Automatically calculate measure and beat numbers based on the time signature.
- Be precise about beat placement — beats must add up correctly per measure.`;

export async function POST(request) {
  try {
    const { rightHand, leftHand, songTitle, timeSignature, tempo } = await request.json();

    if (!rightHand && !leftHand) {
      return Response.json({ error: "No notes provided" }, { status: 400 });
    }

    let query = `Convert these piano notes to structured JSON for playback:\n\n`;
    if (songTitle) query += `Title: "${songTitle}"\n`;
    if (timeSignature) query += `Time signature: ${timeSignature}\n`;
    if (tempo) query += `Tempo: ${tempo} BPM\n`;
    if (rightHand) query += `Right hand: ${rightHand}\n`;
    if (leftHand) query += `Left hand: ${leftHand}\n`;
    query += `\nConvert to the JSON format. Make sure beats add up correctly per measure.`;

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
