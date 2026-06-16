import { useState, useEffect } from 'react';

export function PlayerEnrichmentButton() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  const [showDebug, setShowDebug] = useState(false);

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
            const text = await res.text();
            if (text.includes("<title>Starting Server...</title>")) {
              setMessage("Server is starting up. Please wait...");
            } else {
              console.error("Status fetch failed: Expected JSON, got", contentType, text.substring(0, 200));
              setMessage(`Server returned non-JSON response (${contentType}). Check logs.`);
            }
          }
        } else {
          const text = await res.text();
          console.error("Status fetch failed with status:", res.status, text.substring(0, 200));
          if (res.status >= 500) {
            setMessage("Server error (5xx). It might be crashing or restarting.");
          } else {
            setMessage(`HTTP Error ${res.status}: ${text.substring(0, 50)}`);
          }
        }
      } catch (err: any) {
        console.error("Status fetch failed:", err);
        setMessage(`Connection error: ${err.message || 'Failed to fetch'}`);
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

  const lastHeartbeatStr = status?.lastHeartbeat ? new Date(status.lastHeartbeat).toLocaleTimeString() : 'N/A';
  const isHeartbeatHealthy = status?.lastHeartbeat ? (Date.now() - status.lastHeartbeat < 60000) : false;

  return (
    <div className="p-6 bg-surface backdrop-blur-md border border-border-default rounded-2xl shadow-card space-y-6">
      <div className="flex flex-wrap gap-3">
        {isIdle && (
          <button
            onClick={startEnrichment}
            className="btn-primary"
          >
            Start Player Enrichment
          </button>
        )}
        
        {isRunning && (
          <button
            onClick={pauseEnrichment}
            className="px-6 py-3 bg-accent-bright/20 text-accent-bright border border-accent/40 rounded-lg font-sans tracking-tight text-sm font-bold uppercase tracking-widest hover:bg-accent-bright/30 transition-all"
          >
            Pause
          </button>
        )}

        {isPaused && (
          <button
            onClick={resumeEnrichment}
            className="px-6 py-3 bg-accent/20 text-accent border border-accent/40 rounded-lg font-sans tracking-tight text-sm font-bold uppercase tracking-widest hover:bg-accent/30 transition-all"
          >
            Resume
          </button>
        )}

        {(isRunning || isPaused) && (
          <button
            onClick={stopEnrichment}
            className="btn-danger"
          >
            Stop
          </button>
        )}
        
        <button
          onClick={startEnrichment}
          className="px-4 py-2 bg-surface-hover border border-border-default text-foreground-muted rounded-lg hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest"
          title="Manually trigger a retry or restart"
        >
          Manual Retry / Restart
        </button>

        <button
          onClick={forceReset}
          className="px-4 py-2 bg-status-error/10 border border-status-error/30 text-status-error rounded-lg hover:bg-status-error/20 transition-all text-[10px] font-black uppercase tracking-widest"
          title="Force reset the enrichment status if it gets stuck"
        >
          Force Reset Status
        </button>

        <button
          onClick={debugConnection}
          className="px-4 py-2 bg-surface-hover border border-border-default text-foreground-subtle rounded-lg hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest"
        >
          Debug Connection
        </button>

        <button
          onClick={debugSchema}
          className="px-4 py-2 bg-surface-hover border border-border-default text-foreground-subtle rounded-lg hover:text-foreground transition-all text-[10px] font-black uppercase tracking-widest"
        >
          Debug Schema
        </button>
      </div>
      
      {message && (
        <div className="p-4 bg-background-base/50 border border-border-default rounded-xl text-xs font-mono text-foreground-muted break-words">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-accent animate-pulse' : 'bg-cmd-text-muted'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-accent">System Message</span>
            </div>
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-[8px] font-black uppercase tracking-widest text-foreground-subtle hover:text-foreground transition-all"
            >
              {showDebug ? '[Hide Debug]' : '[Show Debug]'}
            </button>
            {status?.lastHeartbeat && (
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tighter">
                <span className="text-foreground-subtle">Server Heartbeat:</span>
                <span className={isHeartbeatHealthy ? 'text-accent' : 'text-status-error'}>{lastHeartbeatStr}</span>
                <div className={`w-1 h-1 rounded-full ${isHeartbeatHealthy ? 'bg-accent' : 'bg-status-error'} ${isHeartbeatHealthy ? 'animate-ping' : ''}`} />
              </div>
            )}
          </div>
          {message}
          {showDebug && status && (
            <pre className="mt-4 p-2 bg-black/40 rounded border border-border-default/30 text-[9px] overflow-auto max-h-40">
              {JSON.stringify(status, null, 2)}
            </pre>
          )}
          {status?.lastPlayerName && (
            <div className="mt-2 pt-2 border-t border-border-default/50 text-foreground">
              <span className="text-accent-bright font-bold">Last Processed:</span> {status.lastPlayerName} <span className="text-foreground-subtle">({status.lastStyles})</span>
            </div>
          )}
        </div>
      )}
      
      {status && (status.processedCount > 0 || isRunning || isPaused) && (
        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <div className="flex flex-col">
              <span className="text-foreground-muted">Processed: <span className="text-foreground">{status.processedCount}</span></span>
              <span className="text-foreground-subtle">Remaining: <span className="text-accent-bright">{Math.max(0, status.totalCount - status.processedCount)}</span></span>
            </div>
            <div className="text-right">
              <span className="text-accent-bright block">{remainingTime && `Est. remaining: ${remainingTime}`}</span>
              <span className="text-foreground-subtle text-[8px]">{isRunning ? 'Processing batches in parallel...' : 'Process paused'}</span>
            </div>
          </div>
          <div className="w-full bg-surface-hover border border-border-default rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cmd-cyan to-cmd-yellow h-full transition-all duration-500 shadow-glow" 
              style={{ width: `${Math.min(100, (status.processedCount / (status.totalCount || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
