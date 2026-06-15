import React from 'react';
import '../styles/global.css';

function Dashboard() {
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        {/* Sidebar nav will go here */}
      </aside>
      <main className="main-content">
        <h1>Dashboard</h1>
        {/* Dashboard content will go here */}
      </main>
    </div>
  );
}

export default Dashboard;
