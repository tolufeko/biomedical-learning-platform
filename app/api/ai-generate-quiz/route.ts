// app/api/ai-generate-quiz/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/getServerUser';
import { checkRateLimit } from '@/lib/utility/rateLimit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface GenerateQuizPayload {
  title: string;
  module: string;
  description?: string;
  maxQuestions?: number;
  questions: {
    id: string;
    type: string;
    question: string;
    topic?: string;
    options?: string[];
  }[];
}

export interface GenerateQuizResponse {
  selectedIds: string[];
  reasoning: string;
}

function buildPrompt(payload: GenerateQuizPayload): string {
  const limit = payload.maxQuestions ?? 10;
  const questionList = payload.questions
    .map((q, i) =>
      `${i + 1}. [ID: ${q.id}] [Type: ${q.type}]${q.topic ? ` [Topic: ${q.topic}]` : ''}
   Question: ${q.question}${q.options?.length ? `\n   Options: ${q.options.join(' | ')}` : ''}`
    )
    .join('\n\n');

  return `You are an expert teacher building a quiz. Your job is to select the most relevant questions from a question bank to match a quiz's topic and purpose.

QUIZ DETAILS:
- Title: "${payload.title}"
- Module: "${payload.module}"
${payload.description ? `- Description: "${payload.description}"` : ''}

QUESTION BANK (${payload.questions.length} questions available):
${questionList}

TASK:
Select the questions from the bank that are most relevant to this quiz's title, module, and description.

Rules:
- Select AT MOST ${limit} questions (select fewer if not enough relevant ones exist)
- Prioritise questions whose topic or content closely matches the quiz title/module/description
- Include a good mix of question types if available
- Do NOT include questions that are clearly off-topic
- Order the selected questions logically (easier/foundational first, harder/application last)

Respond with ONLY a JSON object in this exact format — no markdown, no explanation outside the JSON:
{
  "selectedIds": ["id1", "id2", "id3"],
  "reasoning": "One sentence explaining what topics you selected and why."
}`;
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id, 'ai-generate-quiz', {
      maxRequests: 3,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. Try again in ${rateLimit.secondsLeft}s.` },
        { status: 429 }
      );
    }

    const payload: GenerateQuizPayload = await request.json();

    if (!payload.title || !payload.module) {
      return NextResponse.json(
        { error: 'title and module are required.' },
        { status: 400 }
      );
    }

    if (!payload.questions || payload.questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions in the bank to select from.' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(payload) }],
      max_tokens: 500,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed: GenerateQuizResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', raw);
      return NextResponse.json(
        { error: 'AI returned an unexpected response. Please try again.' },
        { status: 500 }
      );
    }

    const validIds = new Set(payload.questions.map(q => q.id));
    const filteredIds = (parsed.selectedIds ?? []).filter(id => validIds.has(id));

    return NextResponse.json({
      selectedIds: filteredIds,
      reasoning: parsed.reasoning ?? '',
    } satisfies GenerateQuizResponse);

  } catch (error: any) {
    console.error('AI generate quiz error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz. Please try again.' },
      { status: 500 }
    );
  }
}