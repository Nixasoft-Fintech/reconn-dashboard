
import { BrowserRouter } from "react-router-dom";
import Dashboard from "./components/pages/Dashboard";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}
