'use client';

import React, { useState, useEffect } from 'react';

// Interface for the form data we send to the API
interface QuestionInput {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[];
}

interface QuestionFormProps {
  onFormSubmit?: (formData: { title: string; questions: QuestionInput[]; description?: string }) => void;
  initialData?: {
    title: string;
    description: string;
    questions: any[];
  };
  isEditing?: boolean;
}

// Interface for local state management
interface LocalQuestion {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[];
}

const QuestionForm: React.FC<QuestionFormProps> = ({ onFormSubmit, initialData, isEditing = false }) => {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Initialize form with initialData when in edit mode
  useEffect(() => {
    if (initialData) {
      setFormTitle(initialData.title);
      setFormDescription(initialData.description || '');
      
      // Convert initial data questions to LocalQuestion format
      const convertedQuestions: LocalQuestion[] = initialData.questions.map((q, index) => ({
        id: `question-${index}`,
        type: q.type,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer || []
      }));
      setQuestions(convertedQuestions);
    }
  }, [initialData]);

  const questionTypes = [
    { value: 'text', label: 'Text' },
    { value: 'multiple-choice', label: 'Multiple Choice' }
  ];

  const addQuestion = () => {
    const newQuestion: LocalQuestion = {
      id: Date.now().toString(),
      type: 'text',
      question: '',
      options: [''],
      correctAnswer: []
    };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionIndex(questions.length);
  };

  const updateQuestion = (id: string, field: keyof LocalQuestion, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { ...q, options: [...q.options, ''] }
        : q
    ));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options.map((opt, idx) => 
              idx === optionIndex ? value : opt
            )
          }
        : q
    ));
  };

  const removeQuestion = (id: string) => {
    const newQuestions = questions.filter(q => q.id !== id);
    setQuestions(newQuestions);
    
    if (currentQuestionIndex >= newQuestions.length) {
      setCurrentQuestionIndex(Math.max(0, newQuestions.length - 1));
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            options: q.options.filter((_, idx) => idx !== optionIndex)
          }
        : q
    ));
  };

  const handleMultipleChoiceAnswerChange = (questionId: string, selectedOptions: string[]) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, correctAnswer: selectedOptions } : q
    ));
  };

  const handleTextAnswerChange = (questionId: string, value: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, correctAnswer: value } : q
    ));
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formTitle.trim()) {
      alert('Please enter a form title');
      return;
    }

    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Validate all questions have text and correct answers
    const invalidQuestions = questions.filter(q => {
      if (!q.question.trim()) return true;
      
      // Validate correct answer based on question type
      switch (q.type) {
        case 'text':
          return !q.correctAnswer || (q.correctAnswer as string).trim() === '';
        
        case 'multiple-choice':
          return !Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0;
        
        default:
          return true;
      }
    });

    if (invalidQuestions.length > 0) {
      alert('Please fill in all question texts and provide valid correct answers');
      return;
    }

    const formData = {
      title: formTitle,
      description: formDescription,
      questions: questions.map(q => ({
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer
      }))
    };

    try {
      if (onFormSubmit) {
        onFormSubmit(formData);
      } else {
        const response = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          alert('Quiz created successfully!');
          setFormTitle('');
          setFormDescription('');
          setQuestions([]);
          setCurrentQuestionIndex(0);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save quiz');
        }
      }
    } catch (error) {
      console.error('Error saving quiz:', error);
      alert(`Error saving quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const renderQuestionOptions = (question: LocalQuestion) => {
    if (question.type !== 'multiple-choice') {
      return null;
    }

    return (
      <div className="options-section mt-3 p-3 bg-gray-50 rounded">
        <label className="block text-sm font-medium mb-2">Options:</label>
        {question.options.map((option, index) => (
          <div key={index} className="option-input flex items-center mb-2">
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(question.id, index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 border p-2 rounded mr-2"
            />
            {question.options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOption(question.id, index)}
                className="remove-option-btn bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addOption(question.id)}
          className="add-option-btn bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
        >
          Add Option
        </button>
      </div>
    );
  };

  const renderCorrectAnswerField = (question: LocalQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Correct Answer:
            </label>
            <input
              type="text"
              value={question.correctAnswer as string}
              onChange={(e) => handleTextAnswerChange(question.id, e.target.value)}
              placeholder="Enter the correct answer"
              className="w-full border p-2 rounded"
              required
            />
          </div>
        );

        case 'multiple-choice':
          return (
            <div className="form-group mt-3">
              <label className="block text-sm font-medium mb-2">
                Select Correct Answer(s) - Click to toggle:
              </label>
              
              <div className="border border-gray-300 rounded-lg p-3 bg-white min-h-[120px] max-h-60 overflow-y-auto">
                {question.options.map((option, index) => {
                  const isSelected = Array.isArray(question.correctAnswer) && 
                                  question.correctAnswer.includes(option);
                  
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        const currentAnswers = Array.isArray(question.correctAnswer) 
                          ? question.correctAnswer 
                          : [];
                        
                        const newAnswers = isSelected
                          ? currentAnswers.filter(ans => ans !== option)
                          : [...currentAnswers, option];
                        
                        handleMultipleChoiceAnswerChange(question.id, newAnswers);
                      }}
                      className={`m-1 px-3 py-2 rounded-full text-sm font-medium transition-all inline-block cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500 text-white border border-blue-600 shadow-sm'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {option || `Option ${index + 1}`}
                      {isSelected && <span className="ml-1">✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Selection Summary */}
              {Array.isArray(question.correctAnswer) && question.correctAnswer.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-blue-800 text-sm">
                    <strong>Selected answers:</strong> {question.correctAnswer.join(', ')}
                  </div>
                </div>
              )}
            </div>
          );
          
      default:
        return null;
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="form-container bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isEditing ? 'Edit Quiz' : 'Create Quiz Form'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group mb-4">
          <label htmlFor="formTitle" className="block text-sm font-medium mb-2">
            Quiz Title:
          </label>
          <input
            type="text"
            id="formTitle"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Enter quiz title"
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div className="form-group mb-4">
          <label htmlFor="formDescription" className="block text-sm font-medium mb-2">
            Quiz Description (Optional):
          </label>
          <textarea
            id="formDescription"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Enter quiz description"
            className="w-full border p-2 rounded"
            rows={3}
          />
        </div>

        {/* Question Navigation */}
        {questions.length > 0 && (
          <div className="navigation-section mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h3>
              
              {/* Question Progress Dots */}
              <div className="flex space-x-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === currentQuestionIndex 
                        ? 'bg-blue-500' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    title={`Go to question ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mb-4">
              <button
                type="button"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <button
                type="button"
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Current Question Display */}
        <div className="questions-section mb-6">
          {currentQuestion ? (
            <div key={currentQuestion.id} className="question-card border border-gray-200 rounded-lg p-4 mb-4 bg-white">
              <div className="question-header flex justify-between items-center mb-4 pb-2 border-b">
                <h4 className="text-lg font-medium">Question {currentQuestionIndex + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeQuestion(currentQuestion.id)}
                  className="remove-question-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="question-controls space-y-3">
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Question Type:</label>
                  <select
                    value={currentQuestion.type}
                    onChange={(e) => updateQuestion(currentQuestion.id, 'type', e.target.value)}
                    className="w-full border p-2 rounded"
                  >
                    {questionTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Question Text:</label>
                  <input
                    type="text"
                    value={currentQuestion.question}
                    onChange={(e) => updateQuestion(currentQuestion.id, 'question', e.target.value)}
                    placeholder="Enter your question"
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>

                {renderQuestionOptions(currentQuestion)}
                {renderCorrectAnswerField(currentQuestion)}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No questions yet. Click "Add Question" to get started.
            </div>
          )}
        </div>

        <div className="form-actions flex justify-between">
          <button 
            type="button" 
            onClick={addQuestion}
            className="add-question-btn bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {questions.length === 0 ? 'Add First Question' : 'Add Another Question'}
          </button>
          
          {questions.length > 0 && (
            <button 
              type="submit" 
              className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
            >
              {isEditing ? 'Update Quiz' : 'Save Quiz'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default QuestionForm;