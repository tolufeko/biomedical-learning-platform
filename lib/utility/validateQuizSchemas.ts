// lib/utility/validateQuizSchemas.ts
import { z } from 'zod';

const MAX_TEXT_LENGTH = 2000;
const MAX_OPTION_LENGTH = 500;
const MAX_OPTIONS = 10;
const MAX_QUESTIONS = 100;

const hotspotAnswerSchema = z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
});

const questionSchema = z.object({
    question: z.string()
        .min(1, 'Question text is required')
        .max(MAX_TEXT_LENGTH, `Question text must be under ${MAX_TEXT_LENGTH} characters`)
        .trim(),

    type: z.enum(['multiple_choice', 'multi_select', 'true_false', 'text', 'hotspot'], {
        message: 'Invalid question type',
        }),

    options: z.array(
        z.string()
        .max(MAX_OPTION_LENGTH, `Each option must be under ${MAX_OPTION_LENGTH} characters`)
        .trim()
    )
        .max(MAX_OPTIONS, `Maximum ${MAX_OPTIONS} options allowed`)
        .nullable()
        .optional(),

    correctAnswer: z.union([
        z.string().max(MAX_OPTION_LENGTH),
        z.array(z.string().max(MAX_OPTION_LENGTH)),
        z.array(hotspotAnswerSchema),
    ]),

    image_path: z.string().max(500).nullable().optional(),
    question_topic: z.string().max(200).trim().nullable().optional(),
    question_feedback: z.string().max(1000).trim().nullable().optional(),
});

export const putQuizBodySchema = z.object({
    title: z.string()
        .min(1, 'Title is required')
        .max(200, 'Title must be under 200 characters')
        .trim(),

    module: z.string()
        .min(1, 'Module is required')
        .max(100, 'Module must be under 100 characters')
        .trim(),

    description: z.string()
        .max(1000, 'Description must be under 1000 characters')
        .trim()
        .nullable()
        .optional(),

    questions: z.array(questionSchema)
        .max(MAX_QUESTIONS, `Maximum ${MAX_QUESTIONS} questions allowed`)
        .optional(),
});

export type PutQuizBody = z.infer<typeof putQuizBodySchema>;