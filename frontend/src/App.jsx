import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CreateListing from './pages/CreateListing.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import ChatList from './pages/ChatList.jsx';
import ChatRoom from './pages/ChatRoom.jsx';
import Profile from './pages/Profile.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/listings/:id" element={<ListingDetail />} />

        <Route path="/new"        element={<Private><CreateListing /></Private>} />
        <Route path="/chats"      element={<Private><ChatList /></Private>} />
        <Route path="/chats/:id"  element={<Private><ChatRoom /></Private>} />
        <Route path="/profile"    element={<Private><Profile /></Private>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
