import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface ClaudeResult {
  energy: number;
  celtics_rep: number;
  originality: number;
  safety: number;
  safety_flagged: boolean;
  vision_description: string;
  roast_candidates: string[];
}

export async function scoreAndRoast(
  thumbnailBase64: string
): Promise<ClaudeResult> {
  const mediaType = thumbnailBase64.startsWith("data:image/png")
    ? "image/png"
    : "image/jpeg";

  const base64Data = thumbnailBase64.includes(",")
    ? thumbnailBase64.split(",")[1]
    : thumbnailBase64;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: `You are scoring a selfie photo from a Boston Celtics fan submitted for the in-arena jumbotron.

Score 0–100 on each dimension:
- energy: visible expression intensity, clear hype, excitement
- celtics_rep: green/white/Celtics gear, signs, team colors visible
- originality: unique pose, celebration, dance vs. generic smile
- safety: 100 = clean; 0 = profanity, gestures, anything you wouldn't show on a family-friendly jumbotron

Also return:
- vision_description: A hilarious, over-the-top 1-sentence sports-announcer-style description of what you see. Be dramatic, exaggerated, and funny — like a color commentator who's had way too much coffee. Examples: "This absolute LEGEND showed up in what appears to be three layers of Celtics merch and the confidence of a man who's never missed a free throw in his LIFE." or "We've got a fan here who looks like they just found out courtside seats were free and they're STILL processing it."
- safety_flagged: true if safety < 70

And generate 3 playful PA-announcer roast lines about this fan. Rules:
- Punching up or sideways, never down.
- No comments on body, weight, race, gender, age, or anything they can't change.
- No profanity. Family-friendly.
- Affectionate, not cruel. The fan should laugh and want to share it.
- 15 words or fewer each. Specific to what you see.

Return ONLY valid JSON in this exact shape:
{
  "energy": <number>,
  "celtics_rep": <number>,
  "originality": <number>,
  "safety": <number>,
  "safety_flagged": <boolean>,
  "vision_description": "<string>",
  "roast_candidates": ["<string>", "<string>", "<string>"]
}`,
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as ClaudeResult;
}
