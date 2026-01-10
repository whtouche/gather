import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProfile,
  updateProfile,
  isApiError,
  type UserProfile,
  type ProfileVisibility,
  type UpdateProfileInput,
} from "../services/api";

type LoadingState = "loading" | "success" | "error";

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; description: string }[] = [
  { value: "CONNECTIONS", label: "Connections", description: "Visible to people you've attended events with" },
  { value: "ORGANIZERS_ONLY", label: "Organizers Only", description: "Only visible to event organizers" },
  { value: "PRIVATE", label: "Private", description: "Not visible to others" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-6 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
}

interface VisibilitySelectProps {
  value: ProfileVisibility;
  onChange: (value: ProfileVisibility) => void;
  disabled?: boolean;
}

function VisibilitySelect({ value, onChange, disabled }: VisibilitySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProfileVisibility)}
      disabled={disabled}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100"
    >
      {VISIBILITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoVisibility, setPhotoVisibility] = useState<ProfileVisibility>("CONNECTIONS");
  const [bioVisibility, setBioVisibility] = useState<ProfileVisibility>("CONNECTIONS");
  const [locationVisibility, setLocationVisibility] = useState<ProfileVisibility>("CONNECTIONS");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [wallActivityNotifications, setWallActivityNotifications] = useState(true);
  const [connectionEventNotifications, setConnectionEventNotifications] = useState(true);

  const fetchProfile = async () => {
    setLoadingState("loading");
    setErrorMessage("");

    try {
      const data = await getProfile();
      setProfile(data.profile);
      // Initialize form state
      setDisplayName(data.profile.displayName);
      setBio(data.profile.bio || "");
      setLocation(data.profile.location || "");
      setPhotoUrl(data.profile.photoUrl || "");
      setPhotoVisibility(data.profile.photoVisibility);
      setBioVisibility(data.profile.bioVisibility);
      setLocationVisibility(data.profile.locationVisibility);
      setEmailNotifications(data.profile.emailNotifications);
      setSmsNotifications(data.profile.smsNotifications);
      setWallActivityNotifications(data.profile.wallActivityNotifications);
      setConnectionEventNotifications(data.profile.connectionEventNotifications);
      setLoadingState("success");
    } catch (error) {
      setLoadingState("error");
      if (isApiError(error)) {
        if (error.statusCode === 401) {
          setErrorMessage("Please log in to view your profile.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Failed to load profile. Please try again.");
      }
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");

    const updates: UpdateProfileInput = {};

    // Only include changed fields
    if (displayName !== profile.displayName) updates.displayName = displayName;
    if (bio !== (profile.bio || "")) updates.bio = bio || null;
    if (location !== (profile.location || "")) updates.location = location || null;
    if (photoUrl !== (profile.photoUrl || "")) updates.photoUrl = photoUrl || null;
    if (photoVisibility !== profile.photoVisibility) updates.photoVisibility = photoVisibility;
    if (bioVisibility !== profile.bioVisibility) updates.bioVisibility = bioVisibility;
    if (locationVisibility !== profile.locationVisibility) updates.locationVisibility = locationVisibility;
    if (emailNotifications !== profile.emailNotifications) updates.emailNotifications = emailNotifications;
    if (smsNotifications !== profile.smsNotifications) updates.smsNotifications = smsNotifications;
    if (wallActivityNotifications !== profile.wallActivityNotifications) updates.wallActivityNotifications = wallActivityNotifications;
    if (connectionEventNotifications !== profile.connectionEventNotifications) updates.connectionEventNotifications = connectionEventNotifications;

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      return;
    }

    try {
      const data = await updateProfile(updates);
      setProfile(data.profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to save profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = profile && (
    displayName !== profile.displayName ||
    bio !== (profile.bio || "") ||
    location !== (profile.location || "") ||
    photoUrl !== (profile.photoUrl || "") ||
    photoVisibility !== profile.photoVisibility ||
    bioVisibility !== profile.bioVisibility ||
    locationVisibility !== profile.locationVisibility ||
    emailNotifications !== profile.emailNotifications ||
    smsNotifications !== profile.smsNotifications ||
    wallActivityNotifications !== profile.wallActivityNotifications ||
    connectionEventNotifications !== profile.connectionEventNotifications
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your profile information and privacy settings
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingState === "loading" && <LoadingSkeleton />}

        {loadingState === "error" && (
          <ErrorState message={errorMessage} onRetry={fetchProfile} />
        )}

        {loadingState === "success" && profile && (
          <div className="space-y-6">
            {/* Profile Photo Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h2>
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-3xl font-medium text-gray-600">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                      Photo URL
                    </label>
                    <input
                      type="url"
                      id="photoUrl"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Enter a URL for your profile photo (JPEG or PNG, max 5MB)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Photo Visibility
                    </label>
                    <VisibilitySelect value={photoVisibility} onChange={setPhotoVisibility} />
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Info Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">This is how you appear to others (1-100 characters)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Information
                  </label>
                  <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-600">
                    {profile.phone && (
                      <p>Phone: {profile.phone}</p>
                    )}
                    {profile.email && (
                      <p>Email: {profile.email}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">Contact information is never shared with other users</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">About You</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Tell others a bit about yourself..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">{bio.length}/500 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio Visibility
                  </label>
                  <VisibilitySelect value={bioVisibility} onChange={setBioVisibility} />
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Location</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    City / Region
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., San Francisco, CA"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">General location (not precise coordinates)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location Visibility
                  </label>
                  <VisibilitySelect value={locationVisibility} onChange={setLocationVisibility} />
                </div>
              </div>
            </div>

            {/* Notification Preferences Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h2>
              <p className="text-sm text-gray-600 mb-4">
                Control how you receive notifications from Gather
              </p>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="emailNotifications" className="font-medium text-gray-900 text-sm">
                      Email Notifications
                    </label>
                    <p className="text-gray-500 text-xs">
                      Receive event updates, RSVP changes, and invitations via email
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="smsNotifications"
                      checked={smsNotifications}
                      onChange={(e) => setSmsNotifications(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="smsNotifications" className="font-medium text-gray-900 text-sm">
                      SMS Notifications
                    </label>
                    <p className="text-gray-500 text-xs">
                      Receive important event updates via text message
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="wallActivityNotifications"
                      checked={wallActivityNotifications}
                      onChange={(e) => setWallActivityNotifications(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="wallActivityNotifications" className="font-medium text-gray-900 text-sm">
                      Wall Activity Notifications
                    </label>
                    <p className="text-gray-500 text-xs">
                      Get notified about new posts and replies on event walls
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="connectionEventNotifications"
                      checked={connectionEventNotifications}
                      onChange={(e) => setConnectionEventNotifications(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="connectionEventNotifications" className="font-medium text-gray-900 text-sm">
                      New Event Notifications from Connections
                    </label>
                    <p className="text-gray-500 text-xs">
                      Be notified when people you've attended events with create new events
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-600">
                  You can also mute notifications for individual events from the event page.
                </p>
              </div>
            </div>

            {/* Privacy Settings Legend */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Privacy Settings</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <span className="font-medium">{opt.label}:</span> {opt.description}
                  </li>
                ))}
              </ul>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
              <div>
                {errorMessage && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}
                {saveSuccess && (
                  <p className="text-sm text-green-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Profile saved successfully
                  </p>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges || !displayName.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProfilePage;
