import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { InvitePage } from "./pages/InvitePage";
import { DashboardPage } from "./pages/DashboardPage";
import { PastEventsPage } from "./pages/PastEventsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { EventPage } from "./pages/EventPage";
import { CreateEventPage } from "./pages/CreateEventPage";
import { EditEventPage } from "./pages/EditEventPage";
import "./App.css";

/**
 * Wrapper component to extract token from URL params
 */
function InvitePageWrapper() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invalid Invitation</h1>
          <p className="mt-2 text-gray-600">No invitation token provided.</p>
          <a
            href="/"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return <InvitePage token={token} />;
}

/**
 * Wrapper component to extract event ID from URL params
 */
function EventPageWrapper() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invalid Event</h1>
          <p className="mt-2 text-gray-600">No event ID provided.</p>
          <a
            href="/"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return <EventPage eventId={id} />;
}

/**
 * Home page placeholder
 */
function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Gather</h1>
        <p className="text-lg text-gray-600 mb-8">Privacy-focused event planning</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * 404 Not Found page
 */
function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Page Not Found</h2>
        <p className="mt-2 text-gray-600">The page you are looking for does not exist.</p>
        <a
          href="/"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Home
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/past-events" element={<PastEventsPage />} />
        <Route path="/events/new" element={<CreateEventPage />} />
        <Route path="/events/:id" element={<EventPageWrapper />} />
        <Route path="/events/:id/edit" element={<EditEventPage />} />
        <Route path="/invite/:token" element={<InvitePageWrapper />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
