'use client';

import React, { useState } from 'react';

interface Question {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[];
}

interface QuestionFormProps {
  onFormSubmit?: (formData: { title: string; questions: Question[] }) => void;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ onFormSubmit }) => {
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

  const questionTypes = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'rating', label: 'Rating' }
  ];

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: 'text',
      question: '',
      options: [''],
      correctAnswer: ''
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
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
    setQuestions(questions.filter(q => q.id !== id));
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

  const handleCorrectAnswerChange = (questionId: string, value: string | string[]) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, correctAnswer: value } : q
    ));
  };

  const handleCheckboxCorrectAnswerChange = (questionId: string, optionIndex: number, checked: boolean) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const currentAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
        let newAnswers: string[];
        
        if (checked) {
          newAnswers = [...currentAnswers, q.options[optionIndex]];
        } else {
          newAnswers = currentAnswers.filter((_, idx) => idx !== optionIndex);
        }
        
        return { ...q, correctAnswer: newAnswers };
      }
      return q;
    }));
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
        case 'textarea':
          return !q.correctAnswer || (q.correctAnswer as string).trim() === '';
        
        case 'multiple-choice':
        case 'dropdown':
          return !q.correctAnswer || q.options.indexOf(q.correctAnswer as string) === -1;
        
        case 'checkbox':
          return !Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0;
        
        case 'rating':
          return !q.correctAnswer || isNaN(Number(q.correctAnswer));
        
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
      questions: questions
    };

    try {
      if (onFormSubmit) {
        onFormSubmit(formData);
      } else {
        const response = await fetch('/api/custom-forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          alert('Quiz created successfully!');
          setFormTitle('');
          setQuestions([]);
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

  const renderQuestionOptions = (question: Question) => {
    if (!['multiple-choice', 'checkbox', 'dropdown'].includes(question.type)) {
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
            <button
              type="button"
              onClick={() => removeOption(question.id, index)}
              className="remove-option-btn bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
            >
              ×
            </button>
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

  const renderCorrectAnswerField = (question: Question) => {
    switch (question.type) {
      case 'text':
      case 'textarea':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Correct Answer:
            </label>
            <input
              type="text"
              value={question.correctAnswer as string}
              onChange={(e) => handleCorrectAnswerChange(question.id, e.target.value)}
              placeholder="Enter the correct answer"
              className="w-full border p-2 rounded"
              required
            />
          </div>
        );

      case 'multiple-choice':
      case 'dropdown':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Select Correct Answer:
            </label>
            <select
              value={question.correctAnswer as string}
              onChange={(e) => handleCorrectAnswerChange(question.id, e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">Choose correct option</option>
              {question.options.map((option, index) => (
                <option key={index} value={option}>
                  {option || `Option ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Select Correct Answers (multiple):
            </label>
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Array.isArray(question.correctAnswer) && question.correctAnswer.includes(option)}
                    onChange={(e) => handleCheckboxCorrectAnswerChange(question.id, index, e.target.checked)}
                    className="mr-2"
                  />
                  <span>{option || `Option ${index + 1}`}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'rating':
        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Correct Rating (1-5):
            </label>
            <select
              value={question.correctAnswer as string}
              onChange={(e) => handleCorrectAnswerChange(question.id, e.target.value)}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">Select rating</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating.toString()}>
                  {rating} {rating === 1 ? 'star' : 'stars'}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="form-container bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Quiz Form</h2>
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

        <div className="questions-section mb-6">
          <h3 className="text-xl font-semibold mb-4">Quiz Questions</h3>
          {questions.map((question, index) => (
            <div key={question.id} className="question-card border border-gray-200 rounded-lg p-4 mb-4 bg-white">
              <div className="question-header flex justify-between items-center mb-4 pb-2 border-b">
                <h4 className="text-lg font-medium">Question {index + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="remove-question-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="question-controls space-y-3">
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Question Type:</label>
                  <select
                    value={question.type}
                    onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
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
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                    placeholder="Enter your question"
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>

                {renderQuestionOptions(question)}
                {renderCorrectAnswerField(question)}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions flex justify-between">
          <button 
            type="button" 
            onClick={addQuestion}
            className="add-question-btn bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add Question
          </button>
          <button 
            type="submit" 
            className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            Save Quiz
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionForm;