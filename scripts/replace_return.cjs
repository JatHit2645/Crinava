const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

const returnStart = content.lastIndexOf('return (', content.lastIndexOf('export default function App()') + 5000); // Find the return in App
// Actually, let's find it more reliably
const appFuncStart = content.indexOf('export default function App()');
const mainReturnStart = content.indexOf('return (', appFuncStart);

const mainReturnEnd = content.lastIndexOf(');', content.lastIndexOf('}')) + 2;

const newReturn = `  return (
    <div className="min-h-screen bg-void selection:bg-aurora/30 selection:text-white">
      <PremiumHeader 
        user={session?.user} 
        coins={coinBalance}
        onAuthClick={() => setShowAuthModal(true)}
        onProfileClick={() => setActiveTab('profile')}
        onNotificationsClick={() => setShowNotifications(true)}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      <MobileNav 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={session?.user}
        coins={coinBalance}
        onAuthClick={() => setShowAuthModal(true)}
        onProfileClick={() => setActiveTab('profile')}
        onNotificationsClick={() => setShowNotifications(true)}
      />

      <main>
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            <PremiumHero onGetStarted={() => setShowAuthModal(true)} />
            
            <div className="section-divider"></div>
            
            <FeaturesSection />
            
            <div className="section-divider"></div>
            
            <SimulationTerminal />

            <div className="section-divider"></div>

            {/* Matches Preview Section */}
            <section id="matches" className="py-24 px-6">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8">
                  <div className="max-w-2xl">
                    <div className="badge-live mb-6">Live Match Center</div>
                    <h2 className="text-section md:text-5xl font-bold tracking-tighter text-gradient-white mb-6">
                      REAL-TIME <br />
                      <span className="text-gradient-aurora">TELEMETRY.</span>
                    </h2>
                  </div>
                  <button 
                    onClick={() => setActiveTab('matches')}
                    className="btn-secondary group"
                  >
                    View All Matches
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="card-grid">
                  {matches.slice(0, 3).map((match, idx) => (
                    <MatchCard 
                      key={idx} 
                      match={match} 
                      onPredict={(m) => {
                        setSelectedMatch(m.id);
                        setActiveTab('verdict');
                      }} 
                    />
                  ))}
                </div>
              </div>
            </section>

            <div className="section-divider"></div>

            <TestimonialsSection />
          </div>
        )}

        {/* Other Tabs Content */}
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-24">
          <AnimatePresence mode="wait">
            {activeTab === 'matches' && (
              <motion.div key="matches" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="animate-fade-in">
                <MatchesSection 
                  onTournamentSelect={setSelectedTournament}
                  onTournamentBack={() => setSelectedTournament(null)}
                  selectedTournament={selectedTournament}
                />
              </motion.div>
            )}

            {activeTab === 'prediction' && (
              <motion.div key="prediction" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="animate-fade-in">
                <PredictionGame 
                  onMatchSelect={(m) => {
                    setSelectedMatch(m.id);
                    setActiveTab('verdict');
                  }}
                />
              </motion.div>
            )}

            {/* Placeholder for other tabs - they can be added back as needed */}
            {['verdict', 'momentum', 'smartxi', 'stories', 'raffle', 'store', 'blog', 'debate', 'admin', 'profile'].includes(activeTab) && (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-20">
                <h2 className="text-3xl font-bold mb-4 uppercase tracking-widest text-gradient-aurora">{activeTab}</h2>
                <p className="text-white/40">This section is being redesigned for the Aurora experience. Please check back soon.</p>
                <button onClick={() => setActiveTab('home')} className="btn-secondary mt-8">Back to Dashboard</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <PremiumFooter />

      {/* Modals */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      <UsernameModal 
        isOpen={showUsernameModal} 
        onClose={() => setShowUsernameModal(false)} 
      />
      
      {/* Notifications Modal/Dropdown handled in Header, but we can add a global one if needed */}
    </div>
  );`;

const updatedContent = content.substring(0, mainReturnStart) + newReturn + content.substring(mainReturnEnd);
fs.writeFileSync(appPath, updatedContent);
console.log('App.tsx return statement replaced successfully.');
