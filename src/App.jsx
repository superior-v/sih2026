import React, { useState } from 'react';
import { RoleSelection } from './components/RoleSelection';
import { Chat } from './components/Chat';

function App() {
  const [user, setUser] = useState(null);

  const handleRoleSelect = (role, name) => {
    setUser({
      id: Math.random().toString(36).substr(2, 9),
      name,
      role
    });
  };

  const handleBack = () => {
    setUser(null);
  };

  return (
    <div className="min-h-screen">
      {user ? (
        <Chat user={user} onBack={handleBack} />
      ) : (
        <RoleSelection onRoleSelect={handleRoleSelect} />
      )}
    </div>
  );
}

export default App;