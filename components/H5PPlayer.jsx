"use client";

import { useEffect, useRef } from "react";

export default function H5PPlayer({ path }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    function renderH5P() {
      if (containerRef.current && window.H5P?.H5PStandalone) {
        window.H5P.H5PStandalone({
          path,                // path to the extracted folder
          container: containerRef.current,
        });
      }
    }

    // Check if script is already loaded
    if (!window.H5P?.H5PStandalone) {
      const script = document.createElement("script");
      script.src = "/js/h5p-standalone.min.js";
      script.onload = renderH5P;
      document.body.appendChild(script);
    } else {
      renderH5P();
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [path]);

  return <div ref={containerRef} style={{ width: "100%", minHeight: "600px" }} />;
}