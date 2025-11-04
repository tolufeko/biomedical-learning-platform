import H5PPlayer from '@/components/H5PPlayer';

export default function QuizPage() {
  return (
    <div>
      <h1>Bio Quiz</h1>
      <H5PPlayer path="/h5p-content/practice-questions" />
    </div>
  );
}