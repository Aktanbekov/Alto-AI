import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import Simulator from './components/Simulator';
import PricingPage from './components/PricingPage';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);

  const startSimulator = () => {
    setAppState(AppState.SIMULATOR);
  };

  const closeSimulator = () => {
    setAppState(AppState.LANDING);
  };

  const goToPricing = () => {
    setAppState(AppState.PRICING);
  };

  const backToHome = () => {
    setAppState(AppState.LANDING);
  };

  return (
    <div className="bg-background text-foreground min-h-screen selection:bg-blue-500/30">
      {appState === AppState.LANDING && (
        <LandingPage onStart={startSimulator} onPricing={goToPricing} />
      )}
      
      {appState === AppState.PRICING && (
        <PricingPage onBack={backToHome} onStart={startSimulator} />
      )}
      
      {appState === AppState.SIMULATOR && (
        <Simulator onClose={closeSimulator} />
      )}
      
      {/* @ts-ignore */}
      <elevenlabs-convai agent-id="agent_3201khj9k3jnesyvx670qawjrwvc"></elevenlabs-convai>
    </div>
  );
};

export default App;