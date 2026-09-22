"use client";

import { useEffect, useRef, useState } from "react";

interface StatusResponse {
  status: string;
  paperCount: number | null;
  error: string | null;
  downloadUrl: string | null;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/status/${jobId}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      if (data.status === "complete" || data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setStatus(null);
    setJobId(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitError(data.error ?? "Request failed");
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Research-to-Deck Generator</h1>
      <p>Enter a research topic. This runs RAG over ~50 papers and generates a cited PPTX deck.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. retrieval-augmented generation for code synthesis"
          style={{ flex: 1, padding: 8 }}
          required
        />
        <button type="submit" style={{ padding: "8px 16px" }}>
          Generate
        </button>
      </form>

      {submitError && <p style={{ color: "crimson" }}>{submitError}</p>}

      {jobId && (
        <div style={{ marginTop: 24 }}>
          <p>Job: {jobId}</p>
          <p>Status: {status?.status ?? "queued"}</p>
          {status?.paperCount != null && <p>Papers ingested: {status.paperCount}</p>}
          {status?.error && <p style={{ color: "crimson" }}>Error: {status.error}</p>}
          {status?.downloadUrl && (
            <a href={status.downloadUrl} download>
              Download deck (.pptx)
            </a>
          )}
        </div>
      )}
    </main>
  );
}
