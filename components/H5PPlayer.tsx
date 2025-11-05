'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    H5PStandalone: any;
  }
}

interface H5PPlayerProps {
  path: string;
}

export default function H5PPlayer({ path }: H5PPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadH5P = async () => {
      if (!containerRef.current) return;

      try {
        // Wait a bit to ensure H5PStandalone is available
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!window.H5PStandalone) {
          setError('H5P library failed to load');
          setIsLoading(false);
          return;
        }

        // Clear container
        containerRef.current.innerHTML = '';
        
        console.log('Initializing H5P with path:', path);
        
        // FIXED: Remove /h5p.json from the path since the library appends it automatically
        new window.H5PStandalone.H5P(containerRef.current, {
          h5pJsonPath: `/h5p-content/${path}`,
          contentJsonPath: `/h5p-content/${path}/content`,
          frameJs: '/h5p/frame.bundle.js',
          frameCss: '/h5p/styles/h5p.css',
          fullScreen: false,
          copyright: false,
          embed: false,
          download: false,
          icon: false,
          export: false,
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading H5P:', error);
        setError('Failed to load quiz content');
        setIsLoading(false);
      }
    };

    // Check if H5P standalone is already loaded
    if (window.H5PStandalone) {
      loadH5P();
    } else {
      // Load H5P standalone script dynamically
      const script = document.createElement('script');
      script.src = '/lib/h5p-standalone.min.js';
      script.onload = loadH5P;
      script.onerror = () => {
        setError('Failed to load H5P library');
        setIsLoading(false);
      };
      document.head.appendChild(script);

      return () => {
        // Cleanup
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, [path]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded">
        <p className="text-red-700">Error: {error}</p>
        <p className="text-sm text-red-600 mt-2">
          Check browser console for details and ensure all H5P files are properly placed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {isLoading && (
        <div className="p-4 text-center">
          <p>Loading quiz...</p>
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ minHeight: '400px' }}
        className="border rounded-lg"
      />
    </div>
  );
}