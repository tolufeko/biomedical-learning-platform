// app/api/ai-question-feedback/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/getServerUser';
import { checkRateLimit } from '@/lib/utility/rateLimit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface QuestionFeedbackPayload {
  questionText: string;
  questionType: string;
  options?: string[];
  correctAnswer: string | string[];
  quizTitle?: string;
  questionTopic?: string;
}

function buildPrompt(payload: QuestionFeedbackPayload): string {
  const optionsText =
    payload.options && payload.options.length > 0
      ? `\nAnswer options:\n${payload.options.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`
      : '';

  const correctText = Array.isArray(payload.correctAnswer)
    ? payload.correctAnswer.join(', ')
    : payload.correctAnswer;

  return `You are an expert educational content creator writing concise, helpful feedback for a quiz question.

${payload.quizTitle ? `Quiz: "${payload.quizTitle}"` : ''}
${payload.questionTopic ? `Topic: ${payload.questionTopic}` : ''}
Question type: ${payload.questionType}
Question: ${payload.questionText}${optionsText}
Correct answer: ${correctText}

Write SHORT feedback (2–4 sentences max) that a student will see AFTER answering this question.

Rules:
- If they got it RIGHT: briefly affirm why the correct answer is correct and add one interesting/useful fact.
- If they got it WRONG: explain the correct answer clearly, address the likely misconception, and give a memory hook or tip.
- Write it as a single block of text — no headings, no bullet points.
- Keep it under 80 words.
- Be warm, specific to the actual content, and educationally valuable.
- Do NOT start with "Great job", "Well done", or similar generic openers.
- Write it so it works for both correct and incorrect cases (it will be shown to all students after answering).

Output only the feedback text. Nothing else.`;
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id, 'ai-question-feedback', {
      maxRequests: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit reached. Try again in ${rateLimit.secondsLeft}s.` },
        { status: 429 }
      );
    }

    const payload: QuestionFeedbackPayload = await request.json();

    if (!payload.questionText || !payload.correctAnswer) {
      return NextResponse.json(
        { error: 'questionText and correctAnswer are required.' },
        { status: 400 }
      );
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(payload) }],
      max_tokens: 150,
      temperature: 0.65,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('AI question feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback. Please try again.' },
      { status: 500 }
    );
  }
}