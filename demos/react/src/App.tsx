import React from 'react';
import 'aura-ai-chat';
import { createComponent } from '@lit/react';
import { AuraChat } from 'aura-ai-chat';

const AuraChatReact = createComponent({
  tagName: 'aura-chat',
  elementClass: AuraChat,
  react: React,
  events: {
    onAuraEvent: 'auraEvent'
  }
});

const styles = `
  body {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1d3143;
    background: #f3f7fb;
  }
  .dashboard-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at top left, rgba(15, 125, 145, 0.18), transparent 45%), #f3f7fb;
  }
  .top-bar {
    height: 64px;
    padding: 0 1rem;
    border-bottom: 1px solid #d8e2ea;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .logo {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 0.78rem;
    font-weight: 700;
    background: linear-gradient(155deg, #0f7d91, #29af8f);
    color: #f8fffd;
  }
  .title {
    font-size: 0.97rem;
    font-weight: 700;
  }
  .subtitle {
    margin-top: 0.07rem;
    font-size: 0.73rem;
    color: #66798a;
  }
  .workspace-split {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .canvas {
    flex: 1;
    min-width: 680px;
    padding: 2rem;
    overflow-y: auto;
  }
  .assistant-sidebar {
    width: 420px;
    min-width: 320px;
    border-left: 1px solid #d8e2ea;
    background: #fff;
    display: flex;
    flex-direction: column;
  }
  .panel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  .panel-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }
  .panel-header {
    font-weight: 600;
    font-size: 1.1rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.8rem;
    margin-bottom: 1rem;
    color: #1d3143;
  }
  .panel-content {
    flex: 1;
    display: grid;
    place-items: center;
    color: #8c98a4;
    font-size: 0.9rem;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px dashed #d8e2ea;
  }
`;

function App() {
  return (
    <div className="dashboard-shell">
      <style>{styles}</style>
      <header className="top-bar">
        <div className="brand">
          <div className="logo">AA</div>
          <div>
            <div className="title">Aura Analytics</div>
            <div className="subtitle">React host demo</div>
          </div>
        </div>
      </header>
      <div className="workspace-split">
        <main className="canvas">
          <div className="panel-grid">
            <div className="panel-card">
              <div className="panel-header">User Growth</div>
              <div className="panel-content">Mock Line Chart</div>
            </div>
            <div className="panel-card">
              <div className="panel-header">Revenue</div>
              <div className="panel-content">Mock Bar Chart</div>
            </div>
            <div className="panel-card">
              <div className="panel-header">Traffic Sources</div>
              <div className="panel-content">Mock Pie Chart</div>
            </div>
          </div>
        </main>
        <aside className="assistant-sidebar">
          <AuraChatReact
            onAuraEvent={(e: any) => console.log('React caught event:', e.detail)}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
