'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/public/lib/utils";
import { useAuth } from "@/public/lib/AuthContext";

interface QuizData {
  id: string;
  title: string;
  description?: string;
  quiz_questions: any[];
}

interface QuestionState {
  userAnswer: string | string[] | null;
  isSubmitted: boolean;
  isCorrect: boolean | null;
  showSolution: boolean;
}

export default function QuizPage() {
  const { id } = useParams();
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { username, role } = useAuth();

  // Filter only supported questions
  const supportedQuestions = quizData?.quiz_questions?.filter(q => 
    q.question_type === 'multiple-choice' || 
    q.question_type === 'text' || 
    q.question_type === 'checkbox'
  ) || [];

  const totalQuestions = supportedQuestions.length;
  const currentQuestion = supportedQuestions[currentQuestionIndex];
  const currentQuestionState = questionStates[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  // Calculate score
  const calculateScore = () => {
    const correctAnswers = questionStates.filter(state => state.isCorrect).length;
    return {
      correct: correctAnswers,
      total: totalQuestions,
      percentage: Math.round((correctAnswers / totalQuestions) * 100)
    };
  };

  // Initialize question states when quiz data loads
  useEffect(() => {
    if (supportedQuestions.length > 0) {
      const initialStates: QuestionState[] = supportedQuestions.map(() => ({
        userAnswer: null,
        isSubmitted: false,
        isCorrect: null,
        showSolution: false
      }));
      setQuestionStates(initialStates);
    }
  }, [supportedQuestions.length]);

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

  const handleAnswerSelect = (answer: string) => {
    if (currentQuestionState?.isSubmitted) return;
    
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      userAnswer: answer
    };
    setQuestionStates(newStates);
  };

  const handleCheckboxAnswerSelect = (option: string, checked: boolean) => {
    if (currentQuestionState?.isSubmitted) return;
    
    const newStates = [...questionStates];
    const currentAnswers = Array.isArray(currentQuestionState?.userAnswer) 
      ? currentQuestionState.userAnswer 
      : [];
    
    let newAnswers: string[];
    if (checked) {
      newAnswers = [...currentAnswers, option];
    } else {
      newAnswers = currentAnswers.filter(answer => answer !== option);
    }
    
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      userAnswer: newAnswers
    };
    setQuestionStates(newStates);
  };

  const handleTextAnswerChange = (text: string) => {
    if (currentQuestionState?.isSubmitted) return;
    
    const newStates = [...questionStates];
    newStates[currentQuestionIndex] = {
      ...newStates[currentQuestionIndex],
      userAnswer: text
    };
    setQuestionStates(newStates);
  };

  const submitAnswer = () => {
    if (!currentQuestion || !currentQuestionState?.userAnswer) return;
    
    const newStates = [...questionStates];
    let isCorrect = false;
    
    if (currentQuestion.question_type === 'checkbox') {
      // For checkbox questions, compare arrays
      const userAnswers = Array.isArray(currentQuestionState.userAnswer) 
        ? currentQuestionState.userAnswer.sort() 
        : [];
      const correctAnswers = Array.isArray(currentQuestion.correct_answer) 
        ? currentQuestion.correct_answer.sort() 
        : [];
      
      isCorrect = userAnswers.length === correctAnswers.length && 
                  userAnswers.every((answer, index) => answer === correctAnswers[index]);
    } else {
      // For other question types (text, multiple-choice)
      isCorrect = currentQuestionState.userAnswer.toString().toLowerCase().trim() === 
                  currentQuestion.correct_answer.toString().toLowerCase().trim();
    }
    
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
      userAnswer: null,
      isSubmitted: false,
      isCorrect: null,
      showSolution: false
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

  const finishQuiz = () => {
    setShowResults(true);
  };

  const restartQuiz = () => {
    const newStates = supportedQuestions.map(() => ({
      userAnswer: null,
      isSubmitted: false,
      isCorrect: null,
      showSolution: false
    }));
    setQuestionStates(newStates);
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

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

  // Results Screen
  if (showResults) {
    const score = calculateScore();
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
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
            <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
              Change Password
            </Link>
            <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
              Guide
            </Link>
            <button onClick={signOut} className="text-gray-700 hover:text-blue-600 font-medium">
              Sign Out
            </button>
          </div>
        </nav>

        <main className="flex flex-col items-center mt-8 px-6 pb-8">
          <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Quiz Completed!</h2>
            
            {/* Score Display */}
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

            {/* Performance Message */}
            <div className="mb-8 p-4 rounded-lg bg-gray-50">
              <p className="text-lg font-medium text-gray-800">
                {score.percentage >= 90 ? 'Excellent! 🎉' :
                 score.percentage >= 80 ? 'Great job! 👍' :
                 score.percentage >= 70 ? 'Good work! 😊' :
                 score.percentage >= 60 ? 'Not bad! 📚' : 'Keep practicing! 💪'}
              </p>
            </div>

            {/* Action Buttons */}
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

            {/* Question Review */}
            <details className="mt-8 text-left">
              <summary className="cursor-pointer font-semibold text-gray-700 text-lg">
                Review Your Answers
              </summary>
              <div className="mt-4 space-y-4">
                {supportedQuestions.map((question, index) => {
                  const state = questionStates[index];
                  const userAnswer = Array.isArray(state?.userAnswer) 
                    ? state.userAnswer.join(', ') 
                    : state?.userAnswer;
                  const correctAnswer = Array.isArray(question.correct_answer)
                    ? question.correct_answer.join(', ')
                    : question.correct_answer;
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-start gap-3 mb-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
                          state?.isCorrect ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {state?.isCorrect ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className="font-medium">Question {index + 1}: {question.question_text}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Your answer: <span className={state?.isCorrect ? 'text-green-600' : 'text-red-600'}>
                              {userAnswer || 'No answer'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Correct answer: {correctAnswer}
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
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
          <Link href="" className="text-gray-700 hover:text-blue-600 font-medium">
            Change Password
          </Link>
          <Link href="/guide" className="text-gray-700 hover:text-blue-600 font-medium">
            Guide
          </Link>
          <button onClick={signOut} className="text-gray-700 hover:text-blue-600 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex flex-col items-center mt-8 px-6 pb-8">
        {/* Quiz Title */}
        <h2 className="text-3xl font-semibold mb-2 text-gray-800 text-center">
          {quizData.title}
        </h2>

        {/* Quiz Description */}
        {quizData.description && (
          <p className="text-gray-600 mb-6 text-center max-w-2xl">
            {quizData.description}
          </p>
        )}

        {/* Progress Indicator */}
        <div className="mb-6 text-lg text-gray-700 font-medium">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </div>

        {/* Question Navigation Dots */}
        {totalQuestions > 1 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {supportedQuestions.map((_, index) => (
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

        {/* Question Display */}
        <div className="w-full max-w-4xl mb-8">
          {currentQuestion ? (
            <div className="bg-white rounded-lg shadow-md p-6 border">
              {/* Question Text */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {currentQuestion.question_text}
                </h3>
                <div className="text-sm text-gray-500">
                  Type: {currentQuestion.question_type === 'checkbox' ? 'Multiple Select' : 
                         currentQuestion.question_type === 'multiple-choice' ? 'Multiple Choice' : 
                         currentQuestion.question_type}
                </div>
              </div>

              {/* Multiple Choice Question */}
              {currentQuestion.question_type === 'multiple-choice' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option: string, index: number) => {
                    const isUserAnswer = currentQuestionState?.userAnswer === option;
                    const isCorrectAnswer = option === currentQuestion.correct_answer;
                    const showCorrectAnswer = currentQuestionState?.showSolution;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={currentQuestionState?.isSubmitted}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          isUserAnswer
                            ? currentQuestionState?.isSubmitted
                              ? currentQuestionState?.isCorrect
                                ? 'bg-green-100 border-green-500 text-green-800'
                                : 'bg-red-100 border-red-500 text-red-800'
                              : 'bg-blue-100 border-blue-500 text-blue-800'
                            : showCorrectAnswer && isCorrectAnswer
                            ? 'bg-green-100 border-green-500 text-green-800'
                            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                        } ${currentQuestionState?.isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isUserAnswer
                              ? currentQuestionState?.isSubmitted
                                ? currentQuestionState?.isCorrect
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'bg-red-500 border-red-500 text-white'
                                : 'bg-blue-500 border-blue-500 text-white'
                              : showCorrectAnswer && isCorrectAnswer
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-400'
                          }`}>
                            {(isUserAnswer || (showCorrectAnswer && isCorrectAnswer)) && (
                              <span className="text-xs">✓</span>
                            )}
                          </div>
                          <span>{option}</span>
                          {showCorrectAnswer && isCorrectAnswer && (
                            <span className="ml-auto text-green-600 font-medium">Correct Answer</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Checkbox Question */}
              {currentQuestion.question_type === 'checkbox' && (
                <div className="space-y-3 mb-6">
                  {currentQuestion.options.map((option: string, index: number) => {
                    const isUserAnswer = Array.isArray(currentQuestionState?.userAnswer) && 
                                        currentQuestionState.userAnswer.includes(option);
                    const isCorrectAnswer = Array.isArray(currentQuestion.correct_answer) && 
                                           currentQuestion.correct_answer.includes(option);
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
                          checked={Array.isArray(currentQuestionState?.userAnswer) && 
                                  currentQuestionState.userAnswer.includes(option)}
                          onChange={(e) => {
                            if (currentQuestionState?.isSubmitted) return;
                            handleCheckboxAnswerSelect(option, e.target.checked);
                          }}
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

              {/* Text Question */}
              {currentQuestion.question_type === 'text' && (
                <div className="mb-6">
                  <input
                    type="text"
                    value={currentQuestionState?.userAnswer || ''}
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

              {/* Feedback Message */}
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

        {/* Navigation Buttons - Only show Previous/Next, no Finish button here */}
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
        
        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          {!currentQuestionState?.isSubmitted ? (
            <>
              <button
                onClick={submitAnswer}
                disabled={!currentQuestionState?.userAnswer || 
                        (Array.isArray(currentQuestionState.userAnswer) && 
                          currentQuestionState.userAnswer.length === 0)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  currentQuestionState?.userAnswer && 
                  (!Array.isArray(currentQuestionState.userAnswer) || 
                  currentQuestionState.userAnswer.length > 0)
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