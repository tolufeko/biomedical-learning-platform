'use client';

import React, { useState, useEffect, useRef } from 'react';

// Interface for the form data we send to the API
interface QuestionInput {
  type: string;
  question: string;
  options: string[];
  correctAnswer: string | string[] | Hotspot[];
  image_path?: string; // ✅ Send image_path to API
}

interface Hotspot {
  x: number;
  y: number;
}

interface QuestionFormProps {
  onFormSubmit?: (formData: { title: string; questions: QuestionInput[]; description?: string }) => void;
  initialData?: {
    id?: string;
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
  correctAnswer: string | string[] | Hotspot[];
  image_url?: string;
  imageFile?: File | null;
  filePath?: string;
}

// Type guard to check if an array contains only strings
const isStringArray = (arr: any[]): arr is string[] => {
  return Array.isArray(arr) && arr.every(item => typeof item === 'string');
};

// Type guard to check if an array contains only Hotspots
const isHotspotArray = (arr: any[]): arr is Hotspot[] => {
  return Array.isArray(arr) && arr.every(item => 
    typeof item === 'object' && 
    item !== null && 
    'x' in item && 
    'y' in item &&
    typeof item.x === 'number' &&
    typeof item.y === 'number'
  );
};

const QuestionForm: React.FC<QuestionFormProps> = ({ onFormSubmit, initialData, isEditing = false }) => {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [uploadingImages, setUploadingImages] = useState<{[key: string]: boolean}>({});
  const [imageLoadedStates, setImageLoadedStates] = useState<{[key: string]: boolean}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with initialData when in edit mode
  useEffect(() => {
    if (initialData) {
      setFormTitle(initialData.title);
      setFormDescription(initialData.description || '');
      
      const convertedQuestions: LocalQuestion[] = initialData.questions.map((q, index) => ({
        id: `question-${index}`,
        type: q.type,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer || [],
        image_url: q.image_url || '',
        filePath: q.image_path || undefined,
      }));
      setQuestions(convertedQuestions);
  
      // ✅ Initialize imageLoadedStates for existing images
      const initialImageStates: { [key: string]: boolean } = {};
      initialData.questions.forEach((q, index) => {
        const id = `question-${index}`;
        initialImageStates[id] = !!q.image_url; // true if image_url exists
      });
      setImageLoadedStates(initialImageStates);
    }
  }, [initialData]);

  const questionTypes = [
    { value: 'text', label: 'Text' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'hotspot', label: 'Hotspot' }
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

  const handleHotspotAnswerChange = (questionId: string, hotspots: Hotspot[]) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, correctAnswer: hotspots } : q
    ));
  };

  const handleImageUpload = async (questionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, GIF, etc.)');
      return;
    }
  
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image size must be less than 5MB');
      return;
    }
  
    try {
      setUploadingImages(prev => ({ ...prev, [questionId]: true }));
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Upload failed with status: ${response.status}`);
      }
      
      setQuestions(questions.map(q => 
        q.id === questionId ? { 
          ...q, 
          image_url: result.imageUrl,
          imageFile: null,
          filePath: result.filePath
        } : q
      ));
      
      setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImages(prev => ({ ...prev, [questionId]: false }));
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle expired signed URLs
  const handleImageError = async (questionId: string) => {
    try {
      const question = questions.find(q => q.id === questionId);
      if (!question?.filePath) return;

      const response = await fetch('/api/refresh-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: question.filePath }),
      });

      const result = await response.json();
      
      if (response.ok && result.imageUrl) {
        updateQuestion(questionId, 'image_url', result.imageUrl);
        setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
      } else {
        console.error('Failed to refresh image URL:', result.error);
        alert('Image failed to load. Please re-upload the image.');
      }
    } catch (error) {
      console.error('Error refreshing image URL:', error);
      alert('Image failed to load. Please re-upload the image.');
    }
  };

  const handleImageLoad = (questionId: string) => {
    setImageLoadedStates(prev => ({ ...prev, [questionId]: true }));
  };

  const handleImageLoadStart = (questionId: string) => {
    setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
  };

  const handleImageClick = (questionId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const question = questions.find(q => q.id === questionId);
    if (!question || !question.image_url) return;

    const imageContainer = event.currentTarget;
    const rect = imageContainer.getBoundingClientRect();
    
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const currentHotspots = Array.isArray(question.correctAnswer) && isHotspotArray(question.correctAnswer) 
      ? question.correctAnswer 
      : [];

    const existingHotspotIndex = currentHotspots.findIndex(hotspot => 
      Math.sqrt(Math.pow(hotspot.x - x, 2) + Math.pow(hotspot.y - y, 2)) < 3
    );

    let newHotspots: Hotspot[];
    if (existingHotspotIndex !== -1) {
      newHotspots = currentHotspots.filter((_, index) => index !== existingHotspotIndex);
    } else {
      newHotspots = [...currentHotspots, { x, y }];
    }

    handleHotspotAnswerChange(questionId, newHotspots);
  };

  const removeImage = (questionId: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { 
        ...q, 
        image_url: undefined,
        imageFile: null,
        filePath: undefined,
        correctAnswer: []
      } : q
    ));
    setImageLoadedStates(prev => ({ ...prev, [questionId]: false }));
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

  const validateQuestion = (question: LocalQuestion): string | null => {
    if (!question.question.trim()) {
      return 'Question text is required';
    }

    switch (question.type) {
      case 'text':
        if (!question.correctAnswer || (question.correctAnswer as string).trim() === '') {
          return 'Correct answer is required for text questions';
        }
        break;
      
      case 'multiple-choice':
        if (question.options.length < 2) {
          return 'Multiple choice questions need at least 2 options';
        }
        if (question.options.some(opt => !opt.trim())) {
          return 'All options must have text';
        }
        if (!Array.isArray(question.correctAnswer) || (question.correctAnswer as string[]).length === 0) {
          return 'Please select at least one correct answer';
        }
        break;
      
      case 'hotspot':
        if (!question.image_url) {
          return 'Image is required for hotspot questions';
        }
        if (!Array.isArray(question.correctAnswer) || (question.correctAnswer as Hotspot[]).length === 0) {
          return 'Please add at least one hotspot';
        }
        break;
    }

    return null;
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

    const validationResults = questions.map(q => validateQuestion(q));
    const invalidQuestions = validationResults.filter(result => result !== null);
    
    if (invalidQuestions.length > 0) {
      alert(`Please fix the following issues:\n\n${invalidQuestions.join('\n')}`);
      return;
    }

    const isUploading = Object.values(uploadingImages).some(status => status);
    if (isUploading) {
      alert('Please wait for images to finish uploading');
      return;
    }

    try {
      if (onFormSubmit) {
        const formDataForCallback = {
          title: formTitle,
          description: formDescription,
          questions: questions.map(q => ({
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            image_path: q.filePath // ✅ Send filePath as image_path
          }))
        };
        onFormSubmit(formDataForCallback);
      } else {
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing && initialData?.id ? `/api/quizzes/${initialData.id}` : '/api/quizzes';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formTitle,
            description: formDescription,
            questions: questions.map(q => ({
              type: q.type,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              image_url: q.image_url
            })),
            userId: "user-id-here"
          }),
        });

        if (response.ok) {
          alert(isEditing ? 'Quiz updated successfully!' : 'Quiz created successfully!');
          if (!isEditing) {
            setFormTitle('');
            setFormDescription('');
            setQuestions([]);
            setCurrentQuestionIndex(0);
            setImageLoadedStates({});
          }
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

  const renderHotspotQuestion = (question: LocalQuestion) => {
    const hotspots = Array.isArray(question.correctAnswer) && isHotspotArray(question.correctAnswer) 
      ? question.correctAnswer 
      : [];
  
    const isUploading = uploadingImages[question.id];
    const isImageLoaded = imageLoadedStates[question.id] || false;
  
    return (
      <div className="hotspot-section mt-3">
        <label className="block text-sm font-medium mb-2">Image Upload:</label>
        
        {!question.image_url ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(question.id, e)}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`px-4 py-2 rounded text-white ${
                isUploading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Supported formats: JPG, PNG, GIF, WEBP (Max 5MB)
            </p>
          </div>
        ) : (
          <div className="relative">
            <div 
              className="border-2 border-gray-300 rounded-lg cursor-crosshair bg-gray-50 max-w-2xl mx-auto relative"
              style={{ aspectRatio: '16/9' }}
              onClick={(e) => handleImageClick(question.id, e)}
            >
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
                  <div className="text-gray-500">Loading image...</div>
                </div>
              )}
              
              <img 
                src={question.image_url} 
                alt="Hotspot question background"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  console.error('Image failed to load:', question.image_url);
                  handleImageError(question.id);
                }}
                onLoad={() => handleImageLoad(question.id)}
                onLoadStart={() => handleImageLoadStart(question.id)}
              />
              
              {isImageLoaded && hotspots.map((hotspot, index) => (
                <div
                  key={index}
                  className="absolute w-6 h-6 bg-red-500 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 animate-pulse z-20"
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                  }}
                  title={`Hotspot ${index + 1}: ${Math.round(hotspot.x)}%, ${Math.round(hotspot.y)}%`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => removeImage(question.id)}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
              >
                Remove Image
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`px-3 py-1 rounded text-sm ${
                  isUploading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Change Image
              </button>
            </div>
          </div>
        )}
  
        <div className="mt-3">
          <label className="block text-sm font-medium mb-2">Hotspot Instructions:</label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              • Click on the image to add hotspots
              <br />
              • Click existing hotspots to remove them
            </p>
          </div>
        </div>
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
        const selectedOptions = Array.isArray(question.correctAnswer) && isStringArray(question.correctAnswer) 
          ? question.correctAnswer 
          : [];

        return (
          <div className="form-group mt-3">
            <label className="block text-sm font-medium mb-2">
              Select Correct Answer(s) - Click to toggle:
            </label>
            
            <div className="border border-gray-300 rounded-lg p-3 bg-white min-h-[120px] max-h-60 overflow-y-auto">
              {question.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option);
                
                return (
                  <div
                    key={index}
                    onClick={() => {
                      const newAnswers = isSelected
                        ? selectedOptions.filter(ans => ans !== option)
                        : [...selectedOptions, option];
                      
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

            {selectedOptions.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-blue-800 text-sm">
                  <strong>Selected answers:</strong> {selectedOptions.join(', ')}
                </div>
              </div>
            )}
          </div>
        );

      case 'hotspot':
        return renderHotspotQuestion(question);

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

        {questions.length > 0 && (
          <div className="navigation-section mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h3>
              
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