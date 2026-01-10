import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getProfile,
  updateProfile,
  isApiError,
  deactivateAccount,
  requestAccountDeletion,
  cancelAccountDeletion,
  requestDataExport,
  getDataExports,
  type UserProfile,
  type ProfileVisibility,
  type UpdateProfileInput,
  type DataExport,
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
  const [isProfileHidden, setIsProfileHidden] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [wallActivityNotifications, setWallActivityNotifications] = useState(true);
  const [connectionEventNotifications, setConnectionEventNotifications] = useState(true);

  // Account management state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dataExports, setDataExports] = useState<DataExport[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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
      setIsProfileHidden(data.profile.isProfileHidden);
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

  const fetchDataExports = async () => {
    try {
      const data = await getDataExports();
      setDataExports(data.exports);
    } catch (error) {
      console.error("Failed to fetch data exports:", error);
    }
  };

  useEffect(() => {
    void fetchProfile();
    void fetchDataExports();
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
    if (isProfileHidden !== profile.isProfileHidden) updates.isProfileHidden = isProfileHidden;
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
    isProfileHidden !== profile.isProfileHidden ||
    emailNotifications !== profile.emailNotifications ||
    smsNotifications !== profile.smsNotifications ||
    wallActivityNotifications !== profile.wallActivityNotifications ||
    connectionEventNotifications !== profile.connectionEventNotifications
  );

  const handleDeactivate = async () => {
    setLoadingAction("deactivate");
    try {
      await deactivateAccount();
      setShowDeactivateConfirm(false);
      window.location.href = "/login";
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to deactivate account");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestDeletion = async () => {
    setLoadingAction("delete");
    try {
      await requestAccountDeletion();
      setShowDeleteConfirm(false);
      await fetchProfile();
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to request account deletion");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelDeletion = async () => {
    setLoadingAction("cancel-delete");
    try {
      await cancelAccountDeletion();
      await fetchProfile();
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to cancel account deletion");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestExport = async () => {
    setLoadingAction("export");
    try {
      await requestDataExport();
      await fetchDataExports();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to request data export");
      }
    } finally {
      setLoadingAction(null);
    }
  };

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

            {/* Advanced Privacy Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Advanced Privacy</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id="isProfileHidden"
                      checked={isProfileHidden}
                      onChange={(e) => setIsProfileHidden(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="isProfileHidden" className="font-medium text-gray-900 text-sm">
                      Hide My Profile
                    </label>
                    <p className="text-gray-500 text-xs mt-1">
                      When enabled, only your display name will be visible to others. Your profile photo, bio, and location will be hidden regardless of individual field visibility settings.
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Note: You will still appear in event attendee lists, and others can still add private notes about you.
                    </p>
                  </div>
                </div>
                {isProfileHidden && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs text-yellow-800">
                        Your profile is currently hidden. Only your display name is visible to other users.
                      </p>
                    </div>
                  </div>
                )}
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

            {/* Session Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Security</h2>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Active Sessions</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage devices logged into your account
                  </p>
                </div>
                <Link
                  to="/profile/sessions"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Manage Sessions
                  <svg className="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Account Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Account Management</h2>

              {/* Pending Deletion Warning */}
              {profile.deletionScheduledAt && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800">Account Deletion Scheduled</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Your account is scheduled for deletion on {new Date(profile.deletionExecutionAt!).toLocaleDateString()}.
                        You can cancel this deletion at any time before that date.
                      </p>
                      <button
                        onClick={handleCancelDeletion}
                        disabled={loadingAction === "cancel-delete"}
                        className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                      >
                        {loadingAction === "cancel-delete" ? "Cancelling..." : "Cancel Deletion"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Data Export */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Export Your Data</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Download a copy of all your personal data including events, RSVPs, and profile information
                  </p>
                  <button
                    onClick={handleRequestExport}
                    disabled={loadingAction === "export" || dataExports.some(e => e.status === "PENDING" || e.status === "PROCESSING")}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === "export" ? "Requesting..." : "Request Data Export"}
                  </button>
                  {dataExports.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {dataExports.map((exp) => (
                        <div key={exp.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                          <div>
                            <span className="font-medium">{exp.status}</span>
                            <span className="text-gray-500 ml-2">
                              Requested {new Date(exp.requestedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {exp.status === "COMPLETED" && exp.fileUrl && (
                            <a
                              href={exp.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account Deactivation */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Deactivate Account</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Temporarily deactivate your account. You can reactivate by logging in again.
                  </p>
                  {!showDeactivateConfirm ? (
                    <button
                      onClick={() => setShowDeactivateConfirm(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Deactivate Account
                    </button>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 mb-3">
                        Are you sure you want to deactivate your account? You can reactivate it by logging in again.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeactivate}
                          disabled={loadingAction === "deactivate"}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {loadingAction === "deactivate" ? "Deactivating..." : "Yes, Deactivate"}
                        </button>
                        <button
                          onClick={() => setShowDeactivateConfirm(false)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Deletion */}
                {!profile.deletionScheduledAt && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Delete Account</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Permanently delete your account and all associated data. This action has a 14-day grace period.
                    </p>
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                      >
                        Delete Account
                      </button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800 mb-3 font-medium">
                          Warning: This will permanently delete your account after a 14-day grace period.
                        </p>
                        <p className="text-sm text-red-700 mb-3">
                          During this period, you can cancel the deletion by logging in. After 14 days, all your data will be permanently deleted and cannot be recovered.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleRequestDeletion}
                            disabled={loadingAction === "delete"}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                          >
                            {loadingAction === "delete" ? "Scheduling..." : "Yes, Delete My Account"}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
