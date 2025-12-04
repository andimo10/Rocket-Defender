import React from 'react';
import RocketDefender from './components/RocketDefender';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen flex justify-center items-center bg-zinc-950">
      {/* 
        Container mimics a mobile device in portrait mode on desktop, 
        or fills the screen on mobile.
      */}
      <div className="w-full h-full sm:max-w-[420px] sm:h-[90vh] sm:border-4 sm:border-zinc-800 sm:rounded-3xl overflow-hidden shadow-2xl relative bg-black ring-1 ring-white/10">
        <RocketDefender />
      </div>
    </div>
  );
};

export default App;