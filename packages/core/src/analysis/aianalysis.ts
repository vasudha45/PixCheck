import Anthropic from '@anthropic-ai/sdk';
import { AIAnalysisResult, AIIssue, AIIssueCategory, SeverityLevel, BoundingBox } from '../types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a senior UI/UX quality assurance engineer specializing in design-to-development verification. 
Your task is to compare a design mockup (from Figma or Zeplin) with a developer's implementation screenshot.

Analyze both images carefully and identify ALL discrepancies. Be thorough and specific.

You MUST respond with ONLY a valid JSON object in this exact schema (no markdown, no explanation outside JSON):

{
  "issues": [
    {
      "id": "issue_1",
      "severity": "critical|major|minor|info",
      "category": "color|typography|spacing|layout|missing_element|extra_element|wrong_copy|wrong_icon|alignment|sizing|border_radius|shadow|other",
      "description": "Clear description of what is wrong",
      "suggestedFix": "How the developer should fix this",
      "confidence": 0.0-1.0,
      "affectedElement": "Button / Header / Card / etc",
      "boundingBox": {
        "x": 0, "y": 0, "width": 100, "height": 50,
        "label": "Short label",
        "severity": "critical|major|minor|info",
        "source": "ai"
      }
    }
  ],
  "overallAssessment": "One paragraph summary of the overall fidelity",
  "positives": ["List of things that are correctly implemented"],
  "confidenceScore": 0.0-1.0
}

Severity guide:
- critical: Core functionality affected, major visual break, wrong primary color, completely missing key element
- major: Noticeable visual difference, wrong font size, significant spacing error, wrong secondary color
- minor: Small spacing differences, subtle color variations, minor alignment issues
- info: Very minor suggestions, almost-correct implementations

Bounding boxes: Use approximate pixel coordinates relative to the screenshot dimensions.
If you cannot determine a bounding box, omit the boundingBox field entirely.`;

export async function runAIAnalysis(
  designImageBuffer: Buffer,
  screenshotImageBuffer: Buffer,
  screenName: string,
  platform: string,
  width: number,
  height: number
): Promise<AIAnalysisResult> {
  const designBase64 = designImageBuffer.toString('base64');
  const screenshotBase64 = screenshotImageBuffer.toString('base64');

  const userPrompt = `Compare these two images for screen: "${screenName}" (Platform: ${platform}, Dimensions: ${width}×${height}px)

IMAGE 1: Design mockup (Figma/Zeplin) — this is the REFERENCE/EXPECTED state
IMAGE 2: Developer's implementation screenshot — this is what was BUILT

Identify every visual discrepancy, no matter how small. Check:
1. Colors (exact shades, opacity, gradients)
2. Typography (font size, weight, family, line-height, letter-spacing, color)
3. Spacing (padding, margin, gap between elements)
4. Layout (element positions, flex/grid alignment)
5. Missing or extra elements
6. Text content/copy differences
7. Icons (wrong icon, wrong size, wrong color)
8. Border radius, borders, outlines
9. Shadows and elevation
10. Component states (if visible)

Be precise with bounding box coordinates — they will be used to draw annotation boxes on the screenshot.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: designBase64,
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  return parseAIResponse(rawText);
}

function parseAIResponse(raw: string): AIAnalysisResult {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const issues: AIIssue[] = (parsed.issues ?? []).map((issue: Record<string, unknown>, idx: number) => {
      const bb = issue.boundingBox as Record<string, unknown> | undefined;
      const boundingBox: BoundingBox | undefined = bb
        ? {
            x: Number(bb.x ?? 0),
            y: Number(bb.y ?? 0),
            width: Number(bb.width ?? 100),
            height: Number(bb.height ?? 50),
            label: String(bb.label ?? issue.affectedElement ?? 'AI Issue'),
            severity: (bb.severity ?? issue.severity ?? 'minor') as SeverityLevel,
            source: 'ai',
          }
        : undefined;

      return {
        id: String(issue.id ?? `ai_issue_${idx + 1}`),
        severity: (issue.severity ?? 'minor') as SeverityLevel,
        category: (issue.category ?? 'other') as AIIssueCategory,
        description: String(issue.description ?? ''),
        suggestedFix: issue.suggestedFix ? String(issue.suggestedFix) : undefined,
        confidence: Number(issue.confidence ?? 0.7),
        affectedElement: issue.affectedElement ? String(issue.affectedElement) : undefined,
        boundingBox,
      };
    });

    return {
      issues,
      overallAssessment: String(parsed.overallAssessment ?? 'Analysis completed.'),
      positives: Array.isArray(parsed.positives) ? parsed.positives.map(String) : [],
      confidenceScore: Number(parsed.confidenceScore ?? 0.8),
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      issues: [
        {
          id: 'ai_parse_error',
          severity: 'info',
          category: 'other',
          description: 'AI analysis returned an unparseable response. Manual review recommended.',
          confidence: 0.5,
        },
      ],
      overallAssessment: 'AI analysis encountered a parsing error. Results may be incomplete.',
      positives: [],
      confidenceScore: 0.5,
    };
  }
}
