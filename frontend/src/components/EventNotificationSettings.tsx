import { useEffect, useState } from "react";
import {
  getEventNotificationSettings,
  updateEventNotificationSettings,
  isApiError,
  type EventNotificationSettings,
} from "../services/api";

interface EventNotificationSettingsProps {
  eventId: string;
}

export function EventNotificationSettings({ eventId }: EventNotificationSettingsProps) {
  const [settings, setSettings] = useState<EventNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getEventNotificationSettings(eventId);
        setSettings(data.settings);
      } catch (err) {
        if (isApiError(err)) {
          if (err.statusCode === 403) {
            // Not an attendee, don't show error
            setSettings(null);
          } else {
            setError(err.message);
          }
        } else {
          setError("Failed to load notification settings");
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, [eventId]);

  const handleToggle = async (field: "muteAll" | "muteWallOnly", value: boolean) => {
    if (!settings) return;

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const data = await updateEventNotificationSettings(eventId, {
        [field]: value,
      });
      setSettings(data.settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to update notification settings");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (!settings) {
    // User is not an attendee
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
        <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Notification Settings
      </h3>

      <div className="space-y-3">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id="muteAll"
              checked={settings.muteAll}
              onChange={(e) => handleToggle("muteAll", e.target.checked)}
              disabled={saving}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded disabled:opacity-50"
            />
          </div>
          <div className="ml-3">
            <label htmlFor="muteAll" className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              Mute all notifications
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Stop receiving any notifications about this event
            </p>
          </div>
        </div>

        {!settings.muteAll && (
          <div className="flex items-start ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="muteWallOnly"
                checked={settings.muteWallOnly}
                onChange={(e) => handleToggle("muteWallOnly", e.target.checked)}
                disabled={saving}
                className="h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded disabled:opacity-50"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="muteWallOnly" className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                Mute wall notifications only
              </label>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Stop notifications about new wall posts and replies
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {success && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Settings updated
        </p>
      )}
    </div>
  );
}

export default EventNotificationSettings;
