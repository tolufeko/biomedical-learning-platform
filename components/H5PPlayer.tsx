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
  const h5pInstanceRef = useRef<any>(null); // Track H5P instance

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    let isMounted = true;

    const loadH5P = async () => {
      if (!containerRef.current || !isMounted) return;

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!window.H5PStandalone) {
          setError('H5P library failed to load');
          setIsLoading(false);
          return;
        }

        // Clear container first
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        
        console.log('Initializing H5P with path:', path);
        
        // Store the H5P instance
        h5pInstanceRef.current = new window.H5PStandalone.H5P(containerRef.current, {
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

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading H5P:', error);
        if (isMounted) {
          setError('Failed to load quiz content');
          setIsLoading(false);
        }
      }
    };

    // Only initialize if not already loaded
    if (window.H5PStandalone) {
      loadH5P();
    } else {
      script = document.createElement('script');
      script.src = '/lib/h5p-standalone.min.js';
      script.onload = loadH5P;
      script.onerror = () => {
        if (isMounted) {
          setError('Failed to load H5P library');
          setIsLoading(false);
        }
      };
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      
      // Remove script if it was added
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      
      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      // TODO: Add proper H5P instance cleanup if available
      if (h5pInstanceRef.current && typeof h5pInstanceRef.current.destroy === 'function') {
        h5pInstanceRef.current.destroy();
      }
    };
  }, [path]); // Only re-run if path changes

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
        className="border"
      />
    </div>
  );
}