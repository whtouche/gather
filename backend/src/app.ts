import express from "express";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import invitationRoutes from "./routes/invitations.js";
import rsvpRoutes from "./routes/rsvps.js";
import dashboardRoutes from "./routes/dashboard.js";
import notificationRoutes from "./routes/notifications.js";
import profileRoutes from "./routes/profile.js";
import wallRoutes from "./routes/wall.js";
import waitlistRoutes from "./routes/waitlist.js";
import messagesRoutes from "./routes/messages.js";
import previousAttendeesRoutes from "./routes/previousAttendees.js";
import questionnaireRoutes from "./routes/questionnaire.js";
import connectionsRoutes from "./routes/connections.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", rsvpRoutes);
app.use("/api/events", wallRoutes);
app.use("/api/events", waitlistRoutes);
app.use("/api/events", messagesRoutes);
app.use("/api/events", questionnaireRoutes);
app.use("/api", invitationRoutes);
app.use("/api", previousAttendeesRoutes);
app.use("/api/connections", connectionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", profileRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
