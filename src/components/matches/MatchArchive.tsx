import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  Trophy,
  ChevronRight,
  Search,
  History,
} from "lucide-react";

interface Match {
  match_id: string;
  match_date: string;
  venue: string;
  city: string;
  match_type: string;
  ball_count: string;
}

export const MatchArchive: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/matches/archive?limit=50")
      .then((res) => res.json())
      .then((data) => {
        setMatches(data);
        setLoading(false);
        return data;
      })
      .catch((err) => console.error(err));
  }, []);

  const filteredMatches = matches.filter(
    (m) =>
      m.match_id.includes(searchQuery) ||
      m.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.city.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <History className="text-indigo-400" />
              Match Archive
            </h1>
            <p className="text-slate-400 mt-2">
              Browse through 21,665 historical matches in our database.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
            <input
              type="text"
              placeholder="Search by ID, Venue or City..."
              className="bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Match Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="size-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">Accessing Historical Vault...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredMatches.map((match, index) => (
                <motion.div
                  key={match.match_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 bg-indigo-500/10 rounded-bl-xl text-xs font-mono text-indigo-400">
                    ID: {match.match_id}
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-500/20 p-3 rounded-lg">
                      <Trophy className="size-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-indigo-400 transition-colors">
                        Match #{match.match_id}
                      </h3>
                      <div className="flex flex-col gap-2 mt-3 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4" />
                          {new Date(match.match_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4" />
                          {match.venue}, {match.city}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-0.5 bg-slate-700 rounded text-xs text-indigo-300">
                            {match.match_type.toUpperCase()}
                          </div>
                          <span className="text-slate-500">•</span>
                          <span>
                            {Number(match.ball_count).toLocaleString()}{" "}
                            Deliveries
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-700/50">
                    <span className="text-xs text-slate-500 font-mono italic">
                      Source: Crinava Master DB
                    </span>
                    <button className="flex items-center gap-1 text-indigo-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                      View Full Scorecard
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
