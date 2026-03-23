import React, { useState, useRef } from 'react';
import { Upload, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as fflate from 'fflate';
import yaml from 'js-yaml';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export function DataIngestion() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ matches: 0, players: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setStatus('Reading ZIP file...');

    try {
      const buffer = await file.arrayBuffer();
      const zip = fflate.unzipSync(new Uint8Array(buffer));
      
      const files = Object.keys(zip).filter(name => name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml'));
      const totalFiles = files.length;
      
      setStatus(`Found ${totalFiles} match files. Processing...`);
      
      // We will aggregate stats here
      const playerStats: Record<string, any> = {};
      const teamStats: Record<string, any> = {};
      let matchCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const fileName = files[i];
        const fileData = zip[fileName];
        const text = fflate.strFromU8(fileData);
        
        try {
          let matchData: any;
          if (fileName.endsWith('.json')) {
            matchData = JSON.parse(text);
          } else {
            matchData = yaml.load(text);
          }

          // Basic extraction logic (assuming Cricsheet format)
          if (matchData?.info) {
            matchCount++;
            const teams = matchData.info.teams || [];
            teams.forEach((t: string) => {
              if (!teamStats[t]) teamStats[t] = { matches: 0 };
              teamStats[t].matches++;
            });

            // Extract players if available
            if (matchData.info.players) {
              Object.values(matchData.info.players).forEach((teamPlayers: any) => {
                teamPlayers.forEach((p: string) => {
                  if (!playerStats[p]) playerStats[p] = { matches: 0 };
                  playerStats[p].matches++;
                });
              });
            }
            
            // Note: Full ball-by-ball extraction would go here.
            // For MVP, we aggregate basic info to avoid memory crash.
          }
        } catch (err) {
          console.warn(`Failed to parse ${fileName}`, err);
        }

        if (i % 100 === 0) {
          setProgress(Math.round((i / totalFiles) * 100));
          // Yield to main thread
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      setStatus('Saving aggregated data to database...');
      
      // Save to Firestore in chunks or as a single aggregated doc
      // Since it's aggregated, it might fit in a few docs.
      // For MVP, we'll save a summary doc.
      await setDoc(doc(db, 'verdict_engine', 'summary'), {
        totalMatches: matchCount,
        totalPlayers: Object.keys(playerStats).length,
        totalTeams: Object.keys(teamStats).length,
        lastUpdated: new Date().toISOString()
      });

      // Save top players (just an example of storing context)
      const topPlayers = Object.entries(playerStats)
        .sort((a: any, b: any) => b[1].matches - a[1].matches)
        .slice(0, 500)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

      await setDoc(doc(db, 'verdict_engine', 'top_players'), topPlayers);

      setStats({ matches: matchCount, players: Object.keys(playerStats).length });
      setStatus('Upload and processing complete!');
      setProgress(100);
      
    } catch (error: any) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 bg-[#111111] border border-metallic-gold/5 rounded-3xl space-y-6">
      <div className="w-12 h-12 bg-aurora-teal/10 rounded-xl flex items-center justify-center">
        <Database size={24} className="text-aurora-teal" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black text-metallic-gold uppercase italic">Verdict Engine Data</h3>
        <p className="text-xs text-gray-500">Upload Cricsheet JSON/YAML ZIP (21k+ matches) to power the Oracle.</p>
      </div>
      
      <input 
        type="file" 
        accept=".zip" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />
      
      {!isUploading && progress === 0 && (
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 bg-metallic-gold/5 border border-metallic-gold/10 text-metallic-gold text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-metallic-gold/10 transition-all flex items-center justify-center gap-2"
        >
          <Upload size={14} />
          Upload ZIP File
        </button>
      )}

      {isUploading && (
        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-black text-metallic-gold uppercase tracking-widest">
            <span>Processing</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-aurora-teal transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            {status}
          </p>
        </div>
      )}

      {progress === 100 && !isUploading && (
        <div className="p-4 bg-aurora-teal/10 border border-aurora-teal/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-aurora-teal text-[10px] font-black uppercase tracking-widest">
            <CheckCircle size={14} />
            Data Ingested Successfully
          </div>
          <div className="text-[9px] text-gray-400 font-medium">
            Processed {stats.matches.toLocaleString()} matches and {stats.players.toLocaleString()} players.
          </div>
        </div>
      )}
    </div>
  );
}
