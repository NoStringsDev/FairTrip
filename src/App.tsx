import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Welcome } from "./pages/Welcome";
import { CreateTrip } from "./pages/CreateTrip";
import { TripLayout } from "./pages/TripLayout";
import { AddExpense } from "./pages/AddExpense";
import { Balance } from "./pages/Balance";
import { History } from "./pages/History";
import { EditExpense } from "./pages/EditExpense";
import { EditTrip } from "./pages/EditTrip";
import { HomeGate } from "./pages/HomeGate";
import { AppBrandHeader } from "./components/AppBrandHeader";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <AppBrandHeader />
        <Routes>
          <Route path="/" element={<HomeGate />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/create" element={<CreateTrip />} />
          <Route path="/trip/:tripId" element={<TripLayout />}>
            <Route index element={<Navigate to="balance" replace />} />
            <Route path="add" element={<AddExpense />} />
            <Route path="balance" element={<Balance />} />
            <Route path="history" element={<History />} />
            <Route path="edit" element={<EditTrip />} />
            <Route path="expense/:expenseId" element={<EditExpense />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
