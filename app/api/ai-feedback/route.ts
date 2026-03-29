// app/api/ai-feedback/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerUser } from '@/lib/auth/getServerUser';
import { checkRateLimit } from '@/lib/rateLimit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface QuizFeedbackQuestion {
  questionText: string;
  questionType: string;
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  timeSpent: number;
}

export interface QuizFeedbackPayload {
  quizTitle: string;
  score: number;
  questions: QuizFeedbackQuestion[];
}

function buildPrompt(payload: QuizFeedbackPayload): string {
  const incorrectQuestions = payload.questions.filter(q => !q.correct);
  const slowQuestions = payload.questions
    .filter(q => q.timeSpent > 60)
    .sort((a, b) => b.timeSpent - a.timeSpent)
    .slice(0, 3);

  const questionBreakdown = payload.questions
    .map((q, i) => {
      const flag = q.timeSpent > 60 ? ` [took ${q.timeSpent}s]` : '';
      return `Q${i + 1} [${q.questionType}]${flag}: ${q.questionText}
  Student answered: ${q.userAnswer}
  Correct answer:   ${q.correctAnswer}
  Result: ${q.correct ? '✓ Correct' : '✗ Incorrect'}`;
    })
    .join('\n\n');

  return `You are an expert, encouraging tutor providing personalised feedback to a student.

Quiz title: "${payload.quizTitle}"
Final score: ${payload.score}%
Questions attempted: ${payload.questions.length}
Incorrect answers: ${incorrectQuestions.length}

--- Question breakdown ---
${questionBreakdown}
---

Write feedback with exactly these four sections, using these exact markdown headings:

## Overall Assessment
2–3 sentences summarising their performance. Be honest but warm.

## What You Did Well
1–3 specific things they got right — reference actual question content, not generic praise.

## Areas to Work On
For each incorrect answer, explain the likely misconception and the correct reasoning. Be specific to the actual content — do not give generic study tips here.
${slowQuestions.length > 0 ? `Also note that they spent a long time on: ${slowQuestions.map(q => `"${q.questionText}"`).join(', ')} — suggest why this might be and how to build confidence with that type of question.` : ''}

## Suggested Next Steps
2–3 concrete, actionable revision suggestions directly tied to their weak areas.

Keep the total response under 400 words. Use plain language. No bullet points inside sections — write in short paragraphs.`;
}

export async function POST(request: Request) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Login required' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(user.id, 'ai-feedback', {
      maxRequests: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Please wait ${rateLimit.secondsLeft}s before requesting feedback again.` },
        { status: 429 }
      );
    }

    const payload: QuizFeedbackPayload = await request.json();

    if (
      !payload.quizTitle ||
      typeof payload.score !== 'number' ||
      !Array.isArray(payload.questions) ||
      payload.questions.length === 0
    ) {
      return NextResponse.json(
        { error: 'Invalid payload: quizTitle, score, and questions are required.' },
        { status: 400 }
      );
    }

    if (payload.questions.length > 20) payload.questions = payload.questions.slice(0, 20);

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(payload) }],
      max_tokens: 600,
      temperature: 0.7,
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
    console.error('Quiz feedback API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback. Please try again.' },
      { status: 500 }
    );
  }
}