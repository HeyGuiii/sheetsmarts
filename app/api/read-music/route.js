import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `You are a sheet music reader for a beginner piano app. Analyze this photo of sheet music and extract the notes.

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
- This is beginner sheet music, so expect simple melodies: mostly quarter and half notes in the range C4-C6.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].text;

    // Try to parse, handling possible markdown code fences
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const score = JSON.parse(cleaned);

    return Response.json(score);
  } catch (err) {
    console.error("Error reading music:", err);
    return Response.json(
      { error: "Could not read the sheet music. Try taking a clearer photo." },
      { status: 500 }
    );
  }
}
