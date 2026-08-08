import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GamePage } from './pages/GamePage.js';
import { HomePage } from './pages/HomePage.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/g/:code" element={<GamePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
