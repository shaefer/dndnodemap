import { Route, Routes } from "react-router-dom";
import { MapApp } from "./pages/MapApp";
import { NameGeneratorPage } from "./pages/NameGeneratorPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MapApp />} />
      <Route path="/nameGenerator" element={<NameGeneratorPage />} />
    </Routes>
  );
}

export default App
