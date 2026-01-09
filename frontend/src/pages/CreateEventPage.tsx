import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createEvent, publishEvent, isAuthenticated, isApiError } from "../services/api";

/**
 * Event form data structure
 */
interface EventFormData {
  title: string;
  description: string;
  dateTime: string;
  endDateTime: string;
  timezone: string;
  location: string;
  imageUrl: string;
  capacity: string;
  rsvpDeadline: string;
  category: string;
  dressCode: string;
  notes: string;
  attendeeListVisibility: "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  allowInviteSharing: boolean;
}

/**
 * Form validation errors
 */
interface FormErrors {
  title?: string;
  description?: string;
  dateTime?: string;
  endDateTime?: string;
  location?: string;
  capacity?: string;
  rsvpDeadline?: string;
}

/**
 * Common timezones for the selector
 */
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "UTC", label: "UTC" },
];

/**
 * Event categories
 */
const CATEGORIES = [
  { value: "", label: "Select a category (optional)" },
  { value: "Party", label: "Party" },
  { value: "Dinner", label: "Dinner" },
  { value: "Meeting", label: "Meeting" },
  { value: "Conference", label: "Conference" },
  { value: "Workshop", label: "Workshop" },
  { value: "Celebration", label: "Celebration" },
  { value: "Sports", label: "Sports" },
  { value: "Concert", label: "Concert" },
  { value: "Outdoor", label: "Outdoor" },
  { value: "Other", label: "Other" },
];

/**
 * Get the user's timezone
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Format date for datetime-local input
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get default start time (next hour)
 */
function getDefaultStartTime(): string {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return formatDateForInput(now);
}

/**
 * Create Event Page component
 */
export function CreateEventPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    dateTime: getDefaultStartTime(),
    endDateTime: "",
    timezone: getUserTimezone(),
    location: "",
    imageUrl: "",
    capacity: "",
    rsvpDeadline: "",
    category: "",
    dressCode: "",
    notes: "",
    attendeeListVisibility: "ATTENDEES_ONLY",
    allowInviteSharing: true,
  });

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login?redirect=/events/new");
    }
  }, [navigate]);

  /**
   * Handle input changes
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const newValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be 200 characters or less";
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length > 5000) {
      newErrors.description = "Description must be 5000 characters or less";
    }

    // Date/time validation
    if (!formData.dateTime) {
      newErrors.dateTime = "Start date and time is required";
    } else {
      const startDate = new Date(formData.dateTime);
      if (isNaN(startDate.getTime())) {
        newErrors.dateTime = "Invalid date and time";
      }
    }

    // End date/time validation
    if (formData.endDateTime) {
      const startDate = new Date(formData.dateTime);
      const endDate = new Date(formData.endDateTime);
      if (isNaN(endDate.getTime())) {
        newErrors.endDateTime = "Invalid end date and time";
      } else if (endDate <= startDate) {
        newErrors.endDateTime = "End time must be after start time";
      }
    }

    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }

    // Capacity validation
    if (formData.capacity) {
      const capacity = parseInt(formData.capacity, 10);
      if (isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
        newErrors.capacity = "Capacity must be a positive whole number";
      }
    }

    // RSVP deadline validation
    if (formData.rsvpDeadline) {
      const deadline = new Date(formData.rsvpDeadline);
      if (isNaN(deadline.getTime())) {
        newErrors.rsvpDeadline = "Invalid RSVP deadline";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Build the API request body
   */
  const buildRequestBody = () => {
    const body: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      dateTime: new Date(formData.dateTime).toISOString(),
      timezone: formData.timezone,
      location: formData.location.trim(),
      attendeeListVisibility: formData.attendeeListVisibility,
      allowInviteSharing: formData.allowInviteSharing,
    };

    if (formData.endDateTime) {
      body.endDateTime = new Date(formData.endDateTime).toISOString();
    }
    if (formData.imageUrl.trim()) {
      body.imageUrl = formData.imageUrl.trim();
    }
    if (formData.capacity) {
      body.capacity = parseInt(formData.capacity, 10);
    }
    if (formData.rsvpDeadline) {
      body.rsvpDeadline = new Date(formData.rsvpDeadline).toISOString();
    }
    if (formData.category) {
      body.category = formData.category;
    }
    if (formData.dressCode.trim()) {
      body.dressCode = formData.dressCode.trim();
    }
    if (formData.notes.trim()) {
      body.notes = formData.notes.trim();
    }

    return body;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (publish: boolean) => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const body = buildRequestBody();
      const response = await createEvent(body);
      const eventId = response.event.id;

      if (publish) {
        await publishEvent(eventId);
      }

      navigate(`/events/${eventId}`);
    } catch (error) {
      if (isApiError(error)) {
        if (error.statusCode === 401) {
          navigate("/login?redirect=/events/new");
          return;
        }
        setSubmitError(error.message);
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleLength = formData.title.length;
  const descriptionLength = formData.description.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
              <p className="mt-1 text-sm text-gray-500">
                Fill in the details for your new event
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          {/* Error message */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg
                  className="w-5 h-5 text-red-400 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            </div>
          )}

          {/* Basic Info Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>

            {/* Title */}
            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                maxLength={200}
                placeholder="Give your event a name"
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.title ? "border-red-300" : "border-gray-300"
                }`}
              />
              <div className="flex justify-between mt-1">
                {errors.title ? (
                  <p className="text-sm text-red-600">{errors.title}</p>
                ) : (
                  <span />
                )}
                <span
                  className={`text-sm ${
                    titleLength > 180 ? "text-orange-600" : "text-gray-500"
                  }`}
                >
                  {titleLength}/200
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                maxLength={5000}
                rows={5}
                placeholder="Tell people what your event is about"
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
                  errors.description ? "border-red-300" : "border-gray-300"
                }`}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-sm text-red-600">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span
                  className={`text-sm ${
                    descriptionLength > 4500 ? "text-orange-600" : "text-gray-500"
                  }`}
                >
                  {descriptionLength}/5000
                </span>
              </div>
            </div>
          </section>

          {/* Date & Time Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Date & Time</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Start Date/Time */}
              <div>
                <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="dateTime"
                  name="dateTime"
                  value={formData.dateTime}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.dateTime ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.dateTime && (
                  <p className="text-sm text-red-600 mt-1">{errors.dateTime}</p>
                )}
              </div>

              {/* End Date/Time */}
              <div>
                <label htmlFor="endDateTime" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  id="endDateTime"
                  name="endDateTime"
                  value={formData.endDateTime}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.endDateTime ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.endDateTime && (
                  <p className="text-sm text-red-600 mt-1">{errors.endDateTime}</p>
                )}
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Location Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Event Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter address or location name"
                className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.location ? "border-red-300" : "border-gray-300"
                }`}
              />
              {errors.location && (
                <p className="text-sm text-red-600 mt-1">{errors.location}</p>
              )}
            </div>
          </section>

          {/* Optional Details Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Optional Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Capacity */}
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  min="1"
                  placeholder="Max attendees"
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.capacity ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.capacity && (
                  <p className="text-sm text-red-600 mt-1">{errors.capacity}</p>
                )}
              </div>

              {/* RSVP Deadline */}
              <div>
                <label htmlFor="rsvpDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                  RSVP Deadline
                </label>
                <input
                  type="datetime-local"
                  id="rsvpDeadline"
                  name="rsvpDeadline"
                  value={formData.rsvpDeadline}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.rsvpDeadline ? "border-red-300" : "border-gray-300"
                  }`}
                />
                {errors.rsvpDeadline && (
                  <p className="text-sm text-red-600 mt-1">{errors.rsvpDeadline}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dress Code */}
              <div>
                <label htmlFor="dressCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Dress Code
                </label>
                <input
                  type="text"
                  id="dressCode"
                  name="dressCode"
                  value={formData.dressCode}
                  onChange={handleChange}
                  placeholder="e.g., Casual, Formal, Costume"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="mb-4">
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Cover Image URL
              </label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any other information for attendees"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </section>

          {/* Privacy Settings Section */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h2>

            {/* Attendee List Visibility */}
            <div className="mb-4">
              <label
                htmlFor="attendeeListVisibility"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Attendee List Visibility
              </label>
              <select
                id="attendeeListVisibility"
                name="attendeeListVisibility"
                value={formData.attendeeListVisibility}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ATTENDEES_ONLY">Visible to all attendees</option>
                <option value="ORGANIZERS_ONLY">Visible to organizers only</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Choose who can see the list of people attending this event.
              </p>
            </div>

            {/* Allow Invite Sharing */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="allowInviteSharing"
                  name="allowInviteSharing"
                  checked={formData.allowInviteSharing}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="allowInviteSharing" className="text-sm font-medium text-gray-700">
                  Allow invite sharing
                </label>
                <p className="text-sm text-gray-500">
                  Attendees can share the event invite link with others.
                </p>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save as Draft"
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Publishing...
                </span>
              ) : (
                "Publish Event"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default CreateEventPage;
