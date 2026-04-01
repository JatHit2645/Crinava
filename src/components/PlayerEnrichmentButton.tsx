import { useState, useEffect } from 'react';

export function PlayerEnrichmentButton() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  // Polling for status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/enrich-status');
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            setStatus(data);
            if (data.lastMessage) setMessage(data.lastMessage);
            if (data.error) setMessage(`Error: ${data.error}`);
          } else {
            console.error("Status fetch failed: Expected JSON, got", contentType);
            // Don't overwrite the message if it's already showing something useful
          }
        } else {
          console.error("Status fetch failed with status:", res.status);
          // If 5xx, server might be restarting or crashing
          if (res.status >= 500) {
            setMessage("Server is currently unavailable. Retrying...");
          }
        }
      } catch (err) {
        console.error("Status fetch failed:", err);
        // This happens on network errors or if the server is down
        setMessage("Connecting to server...");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate remaining time
  useEffect(() => {
    if (status?.status === 'running' && status.startTime) {
      if (status.processedCount > 0) {
        const elapsed = (Date.now() - status.startTime) / 1000;
        const rate = status.processedCount / elapsed;
        const remaining = (status.totalCount - status.processedCount) / rate;
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        setRemainingTime(`${minutes}m ${seconds}s`);
      } else {
        setRemainingTime("Calculating...");
      }
    } else if (status?.status === 'paused') {
      setRemainingTime("Paused");
    } else {
      setRemainingTime(null);
    }
  }, [status]);

  const startEnrichment = async () => {
    try {
      setMessage('Requesting enrichment start...');
      const res = await fetch('/api/enrich-start', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message || 'Enrichment started');
    } catch (error: any) {
      setMessage(`Error: ${error?.message || String(error)}`);
    }
  };

  const pauseEnrichment = async () => {
    try {
      await fetch('/api/enrich-pause', { method: 'POST' });
      setMessage('Pause requested...');
    } catch (error: any) {
      setMessage(`Error: ${error?.message || String(error)}`);
    }
  };

  const resumeEnrichment = async () => {
    try {
      await fetch('/api/enrich-resume', { method: 'POST' });
      setMessage('Resume requested...');
    } catch (error: any) {
      setMessage(`Error: ${error?.message || String(error)}`);
    }
  };

  const stopEnrichment = async () => {
    try {
      await fetch('/api/enrich-stop', { method: 'POST' });
      setMessage('Stop requested...');
    } catch (error: any) {
      setMessage(`Error: ${error?.message || String(error)}`);
    }
  };

  const forceReset = async () => {
    try {
      await fetch('/api/enrich-force-reset', { method: 'POST' });
      setMessage('Force reset successful.');
    } catch (error: any) {
      setMessage(`Error: ${error?.message || String(error)}`);
    }
  };

  const debugConnection = async () => {
    try {
      setMessage("Checking connection...");
      const res = await fetch('/api/debug-connection');
      const data = await res.json();
      if (!data.hasUrl || !data.hasKey) {
        setMessage("CRITICAL: Supabase keys are missing in server environment.");
      } else {
        setMessage(`Supabase OK. Using ${data.activeKeyType}.`);
      }
    } catch (err: any) {
      setMessage(`Failed to reach server debug endpoint: ${err.message}`);
    }
  };

  const debugSchema = async () => {
    try {
      setMessage("Checking schema...");
      const res = await fetch('/api/debug-schema');
      const data = await res.json();
      if (data.error) {
        setMessage(`Schema Error: ${data.error}`);
      } else {
        setMessage(`Columns: ${data.columns?.join(', ')}`);
        console.log("Schema Sample:", data.sample);
      }
    } catch (err: any) {
      setMessage(`Failed to reach schema endpoint: ${err.message}`);
    }
  };

  const isRunning = status?.status === 'running';
  const isPaused = status?.status === 'paused';
  const isIdle = status?.status === 'idle' || status?.status === 'completed' || status?.status === 'error';

  return (
    <div className="p-4 border rounded shadow-sm bg-white">
      <div className="flex flex-wrap gap-2">
        {isIdle && (
          <button
            onClick={startEnrichment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Start Player Enrichment
          </button>
        )}
        
        {isRunning && (
          <button
            onClick={pauseEnrichment}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Pause
          </button>
        )}

        {isPaused && (
          <button
            onClick={resumeEnrichment}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Resume
          </button>
        )}

        {(isRunning || isPaused) && (
          <button
            onClick={stopEnrichment}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        )}
        
        <button
          onClick={startEnrichment}
          className="px-4 py-2 bg-blue-400 text-white rounded hover:bg-blue-500 transition-colors text-sm"
          title="Manually trigger a retry or restart"
        >
          Manual Retry / Restart
        </button>

        <button
          onClick={forceReset}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-sm"
          title="Force reset the enrichment status if it gets stuck"
        >
          Force Reset Status
        </button>

        <button
          onClick={debugConnection}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
        >
          Debug Connection
        </button>

        <button
          onClick={debugSchema}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
        >
          Debug Schema
        </button>
      </div>
      
      {message && (
        <div className="mt-3 p-2 bg-gray-50 rounded border text-sm text-gray-700 break-words">
          {message}
          {status?.lastPlayerName && (
            <div className="mt-1 font-semibold">
              Last: {status.lastPlayerName} ({status.lastStyles})
            </div>
          )}
        </div>
      )}
      
      {status && (status.processedCount > 0 || isRunning || isPaused) && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs font-medium text-gray-500">
            <span>Progress: {status.processedCount} / {status.totalCount}</span>
            <span>{remainingTime && `Est. remaining: ${remainingTime}`}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, (status.processedCount / (status.totalCount || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
