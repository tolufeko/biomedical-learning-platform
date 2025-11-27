export interface H5PQuestion {
    type: string;
    question: string;
    options: string[];
    correctAnswer: string | string[];
  }
  
  export interface H5PContent {
    title: string;
    questions: H5PQuestion[];
  }
  
  export function convertToH5PJSON(formData: {
    title: string;
    questions: H5PQuestion[];
  }): any {
    // This converts your custom form to H5P Quiz format
    const h5pContent = {
      "quiz": {
        "questions": formData.questions.map((q, index) => {
          const baseQuestion = {
            "text": q.question,
            "type": mapQuestionTypeToH5P(q.type),
            "weight": 1,
            "tipsAndFeedback": {
              "tip": "",
              "chosenFeedback": "",
              "notChosenFeedback": ""
            }
          };
  
          switch (q.type) {
            case 'multiple-choice':
              return {
                ...baseQuestion,
                "answers": q.options.map((option, optIndex) => ({
                  "text": option,
                  "correct": option === q.correctAnswer,
                  "weight": option === q.correctAnswer ? 1 : 0
                }))
              };
  
            case 'checkbox':
              return {
                ...baseQuestion,
                "answers": q.options.map((option, optIndex) => ({
                  "text": option,
                  "correct": Array.isArray(q.correctAnswer) && q.correctAnswer.includes(option),
                  "weight": Array.isArray(q.correctAnswer) && q.correctAnswer.includes(option) ? 1 : 0
                }))
              };
  
            case 'text':
            case 'textarea':
              return {
                ...baseQuestion,
                "answers": [{
                  "text": q.correctAnswer as string,
                  "correct": true,
                  "weight": 1
                }]
              };
  
            case 'dropdown':
              return {
                ...baseQuestion,
                "answers": q.options.map((option, optIndex) => ({
                  "text": option,
                  "correct": option === q.correctAnswer,
                  "weight": option === q.correctAnswer ? 1 : 0
                }))
              };
  
            case 'rating':
              return {
                ...baseQuestion,
                "answers": [{
                  "text": q.correctAnswer as string,
                  "correct": true,
                  "weight": 1
                }]
              };
  
            default:
              return baseQuestion;
          }
        })
      },
      "title": formData.title,
      "language": "en",
      "mainLibrary": "H5P.Quiz",
      "license": "U"
    };
  
    return h5pContent;
  }
  
  function mapQuestionTypeToH5P(type: string): string {
    const typeMap: { [key: string]: string } = {
      'multiple-choice': 'multiple-choice',
      'checkbox': 'multiple-choice', // H5P uses multiple-choice for checkboxes too
      'text': 'fill-in',
      'textarea': 'fill-in',
      'dropdown': 'multiple-choice',
      'rating': 'fill-in'
    };
    return typeMap[type] || 'multiple-choice';
  }