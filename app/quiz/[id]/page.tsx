'use client';

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

// =============== TYPE DEFINITIONS ===============

interface HotspotAnswer {
  x: number;
  y: number;
}

function isStringArray(value: any): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isHotspotArray(value: any): value is HotspotAnswer[] {
  return Array.isArray(value) && value.every(item => 
    typeof item === 'object' && 
    item !== null && 
    'x' in item && 
    'y' in item && 
    typeof item.x === 'number' && 
    typeof item.y === 'number'
  );
}

function isHotspotAnswer(obj: any): obj is HotspotAnswer {
  return obj && typeof obj === 'object' && 'x' in obj && 'y' in obj;
}

type QuestionType = 'text' | 'multiple-choice' | 'checkbox' | 'hotspot';

interface BaseQuizQuestion {
  id: string;
  question_type: QuestionType;
  question_text: string;
  image_path?: string;
  image_url?: string;
}

interface TextQuestion extends BaseQuizQuestion {
  question_type: 'text';
  correct_answer: string;
}

interface MultipleChoiceQuestion extends BaseQuizQuestion {
  question_type: 'multiple-choice';
  options: string[];
  correct_answer: string[];
}

interface CheckboxQuestion extends BaseQuizQuestion {
  question_type: 'checkbox';
  options: string[];
  correct_answer: string[];
}

interface HotspotQuestion extends BaseQuizQuestion {
  question_type: 'hotspot';
  correct_answer: HotspotAnswer[];
}

type QuizQuestion = TextQuestion | MultipleChoiceQuestion | CheckboxQuestion | HotspotQuestion;

interface QuizData {
  id: string;
  title: string;
  description?: string;
  quiz_questions: QuizQuestion[];
}

interface TextAnswerState {
  type: 'text';
  userAnswer: string | null;
}

interface ChoiceAnswerState {
  type: 'multiple-choice' | 'checkbox';
  userAnswer: string[] | null;
}

interface HotspotAnswerState {
  type: 'hotspot';
  userAnswer: HotspotAnswer[] | null;
}

type AnswerState = TextAnswerState | ChoiceAnswerState | HotspotAnswerState;

interface QuestionState {
  answerState: AnswerState;
  isSubmitted: boolean;
  isCorrect: boolean | null;
  showSolution: boolean;
  startTime: number;
}

// =============== MAIN COMPONENT ===============

export default function QuizPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { id } = useParams();
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, role, username, loading: authLoading } = useAuth();

  const questions = quizData?.quiz_questions || [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionState = questionStates[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  // Helper: Check if user has provided an answer
  const hasUserAnswer = (state: QuestionState | undefined): boolean => {
    if (!state || !state.answerState) return false;
    const { answerState } = state;
    
    if (answerState.type === 'text') {
      return !!answerState.userAnswer?.trim();
    }
    
    if (answerState.type === 'multiple-choice' || answerState.type === 'checkbox') {
      return Array.isArray(answerState.userAnswer) && answerState.userAnswer.length > 0;
    }
    
    if (answerState.type === 'hotspot') {
      return Array.isArray(answerState.userAnswer) && answerState.userAnswer.length > 0;
    }
    
    return false;
  };

  // Calculate score
  const calculateScore = () => {
    const correctAnswers = questionStates.filter(state => state.isCorrect).length;
    return {
      correct: correctAnswers,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    };
  };

  // Save analytics to database
  const saveAnalytics = async (questionId: string, isCorrect: boolean, timeSpent: number) => {
    console.log(user.id)
    console.log(user.username)
    try {
      await fetch('/api/quiz-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          user_id: user.id,
          correct: isCorrect,
          time_spent: Math.round(timeSpent / 1000), // Convert ms to seconds
        }),
      });
    } catch (error) {
      console.error('Error saving analytics:', error);
      // Don't block user flow if analytics fail
    }
  };

  // Initialize question states
  useEffect(() => {
    if (questions.length > 0) {
      const initialStates: QuestionState[] = questions.map((q) => {
        let answerState: AnswerState;
        switch (q.question_type) {
          case 'text':
            answerState = { type: 'text', userAnswer: null };
            break;
          case 'multiple-choice':
          case 'checkbox':
            answerState = { type: 'multiple-choice', userAnswer: null };
            break;
          case 'hotspot':
            answerState = { type: 'hotspot', userAnswer: null };
            break;
          default:
            answerState = { type: 'text', userAnswer: null };
        }
        return {
          answerState,
          isSubmitted: false,
          isCorrect: null,
          showSolution: false,
          startTime: Date.now()
        };
      });
      setQuestionStates(initialStates);
    }
  }, [questions.length]);

  // Reset timer when question changes
  useEffect(() => {
    if (questionStates.length > 0 && currentQuestionIndex < questionStates.length) {
      const newStates = [...questionStates];
      if (!newStates[currentQuestionIndex].isSubmitted) {
        newStates[currentQuestionIndex] = {
          ...newStates[currentQuestionIndex],
          startTime: Date.now()
        };
        setQuestionStates(newStates);
      }
    }
  }, [currentQuestionIndex]);

  // Fetch quiz data
  useEffect(() => {
    if (!id) return;
  
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/quizzes/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch quiz');
        }
        
        const data = await response.json();
        setQuizData(data);
        
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
    fetchQuiz();
  }, [id]);

  // =============== HANDLERS ===============
  
  const handleTextAnswerChange = (text: string) => {
    if (currentQuestionState?.isSubmitted) return;
    if (!currentQuestion || currentQuestion.question_type !== 'text') return;

    const newStates = [...questionStates];
    const currentState = newStates[currentQuestionIndex].answerState;

    if (currentState.type === 'text') {
      newStates[currentQuestionIndex] = {
        ...newStates[currentQuestionIndex],
        answerState: {
          ...currentState,
          userAnswer: text
        }
      };
    }
    setQuestionStates(newStates);
  };

  const handleAnswerSelect = (answer: string) => {
    if (currentQuestionState?.isSubmitted) return;
    if (!currentQuestion || 
        (currentQuestion.question_type !== 'multiple-choice' && 
         currentQuestion.question_type !== 'checkbox')) return;

    const newStates = [...questionStates];
    const currentState = newStates[currentQuestionIndex].answerState;

    if (currentState.type === 'multiple-choice' || currentState.type === 'checkbox') {
      const currentAnswers = currentState.userAnswer || [];
      let newAnswers: string[];
      if (currentAnswers.includes(answer)) {
        newAnswers = currentAnswers.filter(a => a !== answer);
      } else {
        newAnswers = [...currentAnswers, answer];
      }

      newStates[currentQuestionIndex] = {
        ...newStates[currentQuestionIndex],
        answerState: {
          ...currentState,
          userAnswer: newAnswers
        }
      };
    }
    setQuestionStates(newStates);
  };

  const handleCheckboxAnswerSelect = (option: string, checked: boolean) => {
    if (currentQuestionState?.isSubmitted) return;
    if (!currentQuestion || currentQuestion.question_type !== 'checkbox') return;

    const newStates = [...questionStates];
    const currentState = newStates[currentQuestionIndex].answerState;

    if (currentState.type === 'checkbox') {
      const currentAnswers = currentState.userAnswer || [];
      let newAnswers: string[];
      if (checked) {
        newAnswers = [...currentAnswers, option];
      } else {
        newAnswers = currentAnswers.filter(answer => answer !== option);
      }

      newStates[currentQuestionIndex] = {
        ...newStates[currentQuestionIndex],
        answerState: {
          ...currentState,
          userAnswer: newAnswers
        }
      };
    }
    setQuestionStates(newStates);
  };

  const handleHotspotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentQuestionState?.isSubmitted) return;
    if (!currentQuestion?.image_url || currentQuestion.question_type !== 'hotspot') return;
  
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
  
    const newSpot: HotspotAnswer = { x, y };
    const currentState = currentQuestionState?.answerState;
  
    if (currentState?.type === 'hotspot') {
      const currentSpots = currentState.userAnswer || [];
      let newSpots = [...currentSpots];
  
      const existingIndex = currentSpots.findIndex(spot => {
        const dx = spot.x - x;
        const dy = spot.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 3;
      });
  
      if (existingIndex !== -1) {
        newSpots = currentSpots.filter((_, i) => i !== existingIndex);
      } else {
        newSpots = [...currentSpots, newSpot];
      }
  
      const newStates = [...questionStates];
      newStates[currentQuestionIndex] = {
        ...newStates[currentQuestionIndex],
        answerState: {
          ...currentState,
          userAnswer: newSpots
        }
      };
      setQuestionStates(newStates);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || !currentQuestionState || !hasUserAnswer(currentQuestionState)) return;
  
    const isCorrect = gradeQuestion(currentQuestion, currentQuestionState);
    const timeSpent = Date.now() - currentQuestionState.startTime;

    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      isSubmitted: true,
      isCorrect,
      showSolution: false
    };
    setQuestionStates(newStates);
  };

  const retryQuestion = () => {
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      isSubmitted: false,
      isCorrect: null,
      showSolution: false,
      startTime: Date.now()
    };
    setQuestionStates(newStates);
  };

  const showSolution = () => {
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      showSolution: true
    };
    setQuestionStates(newStates);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index);
    }
  };

  const finishQuiz = async () => {
    const newStates = [...questionStates];
    let hasChanges = false;
  
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const state = newStates[i];
  
      if (!state.isSubmitted && hasUserAnswer(state)) {
        const isCorrect = gradeQuestion(question, state);
        const timeSpent = Date.now() - state.startTime;
        
        // Save analytics
        await saveAnalytics(question.id, isCorrect, timeSpent);

        newStates[i] = {
          ...state,
          isSubmitted: true,
          isCorrect,
          showSolution: false
        };
        hasChanges = true;
      } else if (!state.isSubmitted) {
        const timeSpent = Date.now() - state.startTime;
        
        // Save analytics for unanswered questions
        await saveAnalytics(question.id, false, timeSpent);

        newStates[i] = {
          ...state,
          isSubmitted: true,
          isCorrect: false,
          showSolution: false
        };
        hasChanges = true;
      }
    }
  
    if (hasChanges) {
      setQuestionStates(newStates);
    }
    setShowResults(true);
  };

  const restartQuiz = () => {
    const newStates = questions.map((q) => {
      let answerState: AnswerState;
      switch (q.question_type) {
        case 'text':
          answerState = { type: 'text', userAnswer: null };
          break;
        case 'multiple-choice':
        case 'checkbox':
          answerState = { type: 'multiple-choice', userAnswer: null };
          break;
        case 'hotspot':
          answerState = { type: 'hotspot', userAnswer: null };
          break;
        default:
          answerState = { type: 'text', userAnswer: null };
      }
      return {
        answerState,
        isSubmitted: false,
        isCorrect: null,
        showSolution: false,
        startTime: Date.now()
      };
    });
    setQuestionStates(newStates);
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

  // Helper: Grade a single question
  const gradeQuestion = (
    question: QuizQuestion,
    state: QuestionState
  ): boolean => {
    if (question.question_type === 'hotspot' && state.answerState.type === 'hotspot') {
      const userSpots = state.answerState.userAnswer || [];
      const correctSpots = question.correct_answer || [];
      const toleranceRadius = 8; // in percentage units (since x/y are %)
  
      // Build list of valid matches within tolerance
      const matches: { userIdx: number; correctIdx: number; distance: number }[] = [];
      for (let i = 0; i < userSpots.length; i++) {
        for (let j = 0; j < correctSpots.length; j++) {
          const dx = userSpots[i].x - correctSpots[j].x;
          const dy = userSpots[i].y - correctSpots[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= toleranceRadius) {
            matches.push({ userIdx: i, correctIdx: j, distance });
          }
        }
      }
  
      // Greedy match: sort by closest distance, then assign 1:1
      matches.sort((a, b) => a.distance - b.distance);
      const usedUser = new Set<number>();
      const usedCorrect = new Set<number>();
      let matchCount = 0;

      for (const match of matches) {
        if (!usedUser.has(match.userIdx) && !usedCorrect.has(match.correctIdx)) {
          usedUser.add(match.userIdx);
          usedCorrect.add(match.correctIdx);
          matchCount++;
        }
      }

      // Must match all correct spots AND user must not have extra spots
      return matchCount === correctSpots.length && matchCount === userSpots.length;
    }
    else if (
      (question.question_type === 'multiple-choice' || question.question_type === 'checkbox') && 
      (state.answerState.type === 'multiple-choice' || state.answerState.type === 'checkbox')
    ) {
      // Both should be arrays
      const userAnswers = [...(state.answerState.userAnswer || [])].sort();
      const correctAnswers = [...(question.correct_answer || [])].sort();
      return userAnswers.length === correctAnswers.length && 
             userAnswers.every((ans, i) => ans === correctAnswers[i]);
    } 
    else if (question.question_type === 'text' && state.answerState.type === 'text') {
      // Now guaranteed to be string
      const userAnswer = (state.answerState.userAnswer || '').toString().toLowerCase().trim();
      const correctAnswer = (question.correct_answer || '').toLowerCase().trim();
      return userAnswer === correctAnswer;
    }
    return false;
  };

  // =============== UI RENDERING ===============
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading quiz...</div>
        </div>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Quiz not found'}</div>
          <Link href="/home" className="text-blue-600 hover:text-blue-800 underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // =============== RESULTS SCREEN ===============
  
  if (showResults) {
    const score = calculateScore();
    
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
          <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
          <div className="flex gap-6 items-center">
            {username ? `${username}` : "Guest"}
            {role === 'admin' && (
              <Link href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
                Admin View
              </Link>
            )}
            {(role === 'teacher' || role === 'admin') && (
              <Link href="/teacher" className="text-gray-700 hover:text-blue-600 font-medium">
                Teacher View
              </Link>
            )}
            <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
              Home
            </Link>
            <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
              Guide
            </Link>
            <button onClick={async () => {
              await logout();
              router.push('/');
            }} className="text-gray-700 hover:text-blue-600 font-medium">
              Sign Out
            </button>
          </div>
        </nav>

        <main className="flex flex-col items-center mt-8 px-6 pb-8">
          <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Quiz Completed!</h2>
            
            <div className="mb-8">
              <div className={`text-6xl font-bold mb-4 ${
                score.percentage >= 80 ? 'text-green-600' :
                score.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {score.percentage}%
              </div>
              <p className="text-xl text-gray-600">
                You got {score.correct} out of {score.total} questions correct
              </p>
            </div>

            <div className="mb-8 p-4 rounded-lg bg-gray-50">
              <p className="text-lg font-medium text-gray-800">
                {score.percentage >= 90 ? 'Excellent! 🎉' :
                 score.percentage >= 80 ? 'Great job! 👍' :
                 score.percentage >= 70 ? 'Good work! 😊' :
                 score.percentage >= 60 ? 'Not bad! 📚' : 'Keep practicing! 💪'}
              </p>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={restartQuiz}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Retry Quiz
              </button>
              <Link
                href="/home"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Back to Home
              </Link>
            </div>

            <details className="mt-8 text-left">
              <summary className="cursor-pointer font-semibold text-gray-700 text-lg">
                Review Your Answers
              </summary>
              <div className="mt-4 space-y-4">
                {questions.map((question, index) => {
                  const state = questionStates[index];
                  let userAnswerDisplay = 'No answer';
                  let correctAnswerDisplay = '';

                  if (question.question_type === 'hotspot') {
                    const userSpots = state.answerState.type === 'hotspot'
                      ? state.answerState.userAnswer || []
                      : [];
                    const correctSpots = question.correct_answer || [];

                    userAnswerDisplay = userSpots.length > 0
                      ? userSpots.map((s, i) => `(${Math.round(s.x)}%,${Math.round(s.y)}%)`).join(', ')
                      : 'No answer';

                    correctAnswerDisplay = correctSpots.length > 0
                      ? correctSpots.map((s, i) => `(${Math.round(s.x)}%,${Math.round(s.y)}%)`).join(', ')
                      : '–';
                  }
                  else if (question.question_type === 'multiple-choice' || question.question_type === 'checkbox') {
                    userAnswerDisplay = state.answerState.type === 'multiple-choice'
                      ? (state.answerState.userAnswer?.join(', ') || 'No answer')
                      : 'No answer';
                    correctAnswerDisplay = question.correct_answer.join(', ');
                  } 
                  else if (question.question_type === 'text') {
                    userAnswerDisplay = state.answerState.type === 'text'
                      ? (state.answerState.userAnswer || 'No answer')
                      : 'No answer';
                    correctAnswerDisplay = question.correct_answer;
                  }
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-start gap-3 mb-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
                          state.isCorrect ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {state.isCorrect ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className="font-medium">Question {index + 1}: {question.question_text}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Your answer: <span className={state.isCorrect ? 'text-green-600' : 'text-red-600'}>
                              {userAnswerDisplay}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Correct answer: {correctAnswerDisplay}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        </main>
      </div>
    );
  }

  // =============== QUIZ TAKING SCREEN ===============
  
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm border-b">
        <h1 className="text-2xl font-bold text-blue-600">BioLearn</h1>
        <div className="flex gap-6 items-center">
          {username ? `${username}` : "Guest"}
          {role === 'admin' && (
            <Link href="/admin" className="text-gray-700 hover:text-blue-600 font-medium">
              Admin View
            </Link>
          )}
          {(role === 'teacher' || role === 'admin') && (
            <Link href="/teacher" className="text-gray-700 hover:text-blue-600 font-medium">
              Teacher View
            </Link>
          )}
          <Link href="/home" className="text-gray-700 hover:text-blue-600 font-medium">
            Home
          </Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button onClick={async () => {
              await logout();
              router.push('/');
            }} className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex flex-col items-center mt-8 px-6 pb-8">
        <h2 className="text-3xl font-semibold mb-2 text-gray-800 text-center">
          {quizData.title}
        </h2>

        {quizData.description && (
          <p className="text-gray-600 mb-6 text-center max-w-2xl">
            {quizData.description}
          </p>
        )}

        <div className="mb-6 text-lg text-gray-700 font-medium">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </div>

        {totalQuestions > 1 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : questionStates[index]?.isSubmitted
                    ? questionStates[index]?.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={`Go to question ${index + 1}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}

        <div className="w-full max-w-4xl mb-8">
          {currentQuestion ? (
            <div className="bg-white rounded-lg shadow-md p-6 border">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {currentQuestion.question_text}
              </h3>

              {/* Multiple Choice */}
              {currentQuestion.question_type === 'multiple-choice' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => {
                    const isUserAnswer = currentQuestionState?.answerState.type === 'multiple-choice' 
                      ? currentQuestionState.answerState.userAnswer?.includes(option)
                      : false;
                    const isCorrectAnswer = currentQuestion.correct_answer.includes(option);
                    const showCorrectAnswer = currentQuestionState?.showSolution;
                    
                    return (
                      <label
                        key={index}
                        className={`flex items-center p-4 rounded-lg border transition-colors cursor-pointer ${
                          currentQuestionState?.isSubmitted
                            ? isUserAnswer
                              ? isCorrectAnswer
                                ? 'bg-green-100 border-green-500 text-green-800'
                                : 'bg-red-100 border-red-500 text-red-800'
                              : showCorrectAnswer && isCorrectAnswer
                              ? 'bg-green-100 border-green-500 text-green-800'
                              : 'bg-gray-50 border-gray-300'
                            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                        } ${currentQuestionState?.isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!isUserAnswer}
                          onChange={() => handleAnswerSelect(option)}
                          disabled={currentQuestionState?.isSubmitted}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 flex-1">{option}</span>
                        {showCorrectAnswer && isCorrectAnswer && (
                          <span className="ml-auto text-green-600 font-medium">Correct</span>
                        )}
                        {currentQuestionState?.isSubmitted && isUserAnswer && !isCorrectAnswer && (
                          <span className="ml-auto text-red-600 font-medium">Incorrect</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Checkbox */}
              {currentQuestion.question_type === 'checkbox' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option, index) => {
                    const isUserAnswer = currentQuestionState?.answerState.type === 'multiple-choice' 
                      ? currentQuestionState.answerState.userAnswer?.includes(option)
                      : false;
                    const isCorrectAnswer = currentQuestion.correct_answer.includes(option);
                    const showCorrectAnswer = currentQuestionState?.showSolution;
                    
                    return (
                      <label
                        key={index}
                        className={`flex items-center p-4 rounded-lg border transition-colors cursor-pointer ${
                          currentQuestionState?.isSubmitted
                            ? isUserAnswer
                              ? isCorrectAnswer
                                ? 'bg-green-100 border-green-500 text-green-800'
                                : 'bg-red-100 border-red-500 text-red-800'
                              : showCorrectAnswer && isCorrectAnswer
                              ? 'bg-green-100 border-green-500 text-green-800'
                              : 'bg-gray-50 border-gray-300'
                            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                        } ${currentQuestionState?.isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!isUserAnswer}
                          onChange={(e) => handleCheckboxAnswerSelect(option, e.target.checked)}
                          disabled={currentQuestionState?.isSubmitted}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-3 flex-1">{option}</span>
                        {showCorrectAnswer && isCorrectAnswer && (
                          <span className="ml-auto text-green-600 font-medium">Correct</span>
                        )}
                        {currentQuestionState?.isSubmitted && isUserAnswer && !isCorrectAnswer && (
                          <span className="ml-auto text-red-600 font-medium">Incorrect</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Text */}
              {currentQuestion.question_type === 'text' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={currentQuestionState?.answerState.type === 'text' 
                      ? currentQuestionState.answerState.userAnswer || '' 
                      : ''}
                    onChange={(e) => handleTextAnswerChange(e.target.value)}
                    disabled={currentQuestionState?.isSubmitted}
                    placeholder="Type your answer here..."
                    className={`w-full p-4 border rounded-lg focus:outline-none focus:ring-2 ${
                      currentQuestionState?.isSubmitted
                        ? currentQuestionState?.isCorrect
                          ? 'bg-green-50 border-green-500 text-green-800'
                          : currentQuestionState?.showSolution
                          ? 'bg-green-50 border-green-500 text-green-800'
                          : 'bg-red-50 border-red-500 text-red-800'
                        : 'bg-white border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {currentQuestionState?.showSolution && (
                    <div className="mt-2 text-green-600">
                      <strong>Correct answer:</strong> {currentQuestion.correct_answer}
                    </div>
                  )}
                </div>
              )}

              {/* Hotspot */}
              {currentQuestion.question_type === 'hotspot' && (
                <div className="mb-6">
                  {currentQuestion.image_url ? (
                    <div 
                      className="relative inline-block border rounded-lg bg-gray-100 overflow-hidden cursor-crosshair"
                      onClick={handleHotspotClick}
                    >
                      <img
                        src={currentQuestion.image_url}
                        alt="Hotspot question"
                        className="max-w-full h-auto"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.png';
                        }}
                      />
                      
                      {currentQuestionState?.answerState.type === 'hotspot' && 
                        Array.isArray(currentQuestionState.answerState.userAnswer) && 
                        currentQuestionState.answerState.userAnswer.map((spot, idx) => {
                          if (!isHotspotAnswer(spot)) return null;
                          return (
                            <div
                              key={idx}
                              className="absolute w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow"
                              style={{
                                left: `${spot.x}%`,
                                top: `${spot.y}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            />
                          );
                        })}

                      {currentQuestionState?.showSolution &&
                        currentQuestion.correct_answer.map((spot, idx) => (
                          <div
                            key={`correct-${idx}`}
                            className="absolute w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow"
                            style={{
                              left: `${spot.x}%`,
                              top: `${spot.y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                            title="Correct answer"
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="bg-red-100 text-red-800 p-4 rounded-lg">
                      ⚠️ No image provided for hotspot question.
                    </div>
                  )}

                  <div className="mt-3 text-sm text-gray-600">
                    {!currentQuestionState?.isSubmitted
                      ? "Click on the image to add hotspots. Click an existing hotspot to remove it."
                      : currentQuestionState.isCorrect
                      ? "✅ Perfect! You clicked all the correct locations."
                      : "❌ Not quite. Make sure you clicked all (and only) the correct locations."}
                  </div>
                </div>
              )}

              {currentQuestionState?.isSubmitted && (
                <div className={`p-4 rounded-lg mb-4 ${
                  currentQuestionState.isCorrect
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {currentQuestionState.isCorrect ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎉</span>
                      <span className="font-medium">Correct! Well done!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">❌</span>
                      <span className="font-medium">Incorrect. Try again or show solution!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-white rounded-lg border">
              No question available
            </div>
          )}
        </div>

        {totalQuestions > 1 && (
          <div className="flex justify-between w-full max-w-4xl gap-4">
            <button
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                currentQuestionIndex === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              ← Previous
            </button>

            <button
              onClick={goToNextQuestion}
              disabled={isLastQuestion}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isLastQuestion
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next →
            </button>
          </div>
        )}
        
        <div className="flex gap-3 flex-wrap justify-center mt-4">
          {!currentQuestionState?.isSubmitted ? (
            <>
              <button
                onClick={submitAnswer}
                disabled={!hasUserAnswer(currentQuestionState)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  hasUserAnswer(currentQuestionState)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Check Answer
              </button>
              <button
                onClick={finishQuiz}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Finish Quiz
              </button>
            </>
          ) : (
            <>
              {!currentQuestionState.showSolution && (
                <button
                  onClick={retryQuestion}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Retry
                </button>
              )}
              {!currentQuestionState.isCorrect && !currentQuestionState.showSolution && (
                <button
                  onClick={showSolution}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Show Solution
                </button>
              )}
              <button
                onClick={finishQuiz}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Finish Quiz
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}