import { useEffect, useState } from "react";
import {
  getEventRetentionSettings,
  updateEventRetentionSettings as updateRetentionSettingsApi,
  archiveEvent,
  scheduleEventForDeletion,
  cancelScheduledDeletion,
  isApiError,
  type EventRetentionSettings as RetentionSettings,
} from "../services/api";

interface RetentionSettingsProps {
  eventId: string;
  isOrganizer: boolean;
}

export function RetentionSettings({ eventId, isOrganizer }: RetentionSettingsProps) {
  const [settings, setSettings] = useState<RetentionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state
  const [dataRetentionMonths, setDataRetentionMonths] = useState("24");
  const [wallRetentionMonths, setWallRetentionMonths] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("30");

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getEventRetentionSettings(eventId);
        setSettings(data);
        setDataRetentionMonths(data.dataRetentionMonths.toString());
        setWallRetentionMonths(data.wallRetentionMonths?.toString() || "");
      } catch (err) {
        if (isApiError(err)) {
          setError(err.message);
        } else {
          setError("Failed to load retention settings");
        }
      } finally {
        setLoading(false);
      }
    };

    if (isOrganizer) {
      void fetchSettings();
    } else {
      setLoading(false);
    }
  }, [eventId, isOrganizer]);

  const handleUpdateRetention = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const dataMonths = parseInt(dataRetentionMonths, 10);
      const wallMonths = wallRetentionMonths ? parseInt(wallRetentionMonths, 10) : null;

      if (isNaN(dataMonths) || dataMonths < 1 || dataMonths > 120) {
        setError("Data retention must be between 1 and 120 months");
        setSaving(false);
        return;
      }

      if (wallMonths !== null && (isNaN(wallMonths) || wallMonths < 1 || wallMonths > 120)) {
        setError("Wall retention must be between 1 and 120 months");
        setSaving(false);
        return;
      }

      await updateRetentionSettingsApi(eventId, {
        dataRetentionMonths: dataMonths,
        wallRetentionMonths: wallMonths,
      });

      // Refresh settings
      const updatedSettings = await getEventRetentionSettings(eventId);
      setSettings(updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to update retention settings");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this event? This action can be used to organize old events.")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await archiveEvent(eventId);
      const updatedSettings = await getEventRetentionSettings(eventId);
      setSettings(updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to archive event");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (!confirm(`Are you sure you want to schedule this event for deletion? It will be permanently deleted after ${gracePeriodDays} days.`)) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const days = parseInt(gracePeriodDays, 10);
      if (isNaN(days) || days < 1 || days > 365) {
        setError("Grace period must be between 1 and 365 days");
        setSaving(false);
        return;
      }

      await scheduleEventForDeletion(eventId, days);
      const updatedSettings = await getEventRetentionSettings(eventId);
      setSettings(updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to schedule deletion");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDeletion = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await cancelScheduledDeletion(eventId);
      const updatedSettings = await getEventRetentionSettings(eventId);
      setSettings(updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to cancel scheduled deletion");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOrganizer) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-1 flex items-center">
        <svg className="w-6 h-6 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Data Retention Settings
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Configure how long event data is retained after the event ends
      </p>

      <div className="space-y-6">
        {/* Current Status */}
        {settings.archivedAt && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Archived:</strong> This event was archived on {new Date(settings.archivedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {settings.scheduledForDeletionAt && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 mb-2">
              <strong>Scheduled for deletion:</strong> This event will be permanently deleted on {new Date(settings.scheduledForDeletionAt).toLocaleDateString()}
            </p>
            <button
              onClick={handleCancelDeletion}
              disabled={saving}
              className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Cancel Deletion
            </button>
          </div>
        )}

        {settings.estimatedArchivalDate && !settings.archivedAt && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Estimated archival date:</strong> {new Date(settings.estimatedArchivalDate).toLocaleDateString()}
            </p>
            {settings.retentionNotificationSent && (
              <p className="text-xs text-gray-600 mt-1">
                Notification sent on {settings.retentionNotificationSentAt ? new Date(settings.retentionNotificationSentAt).toLocaleDateString() : 'N/A'}
              </p>
            )}
          </div>
        )}

        {/* Data Retention Period */}
        <div>
          <label htmlFor="dataRetention" className="block text-sm font-medium text-gray-700 mb-2">
            Event Data Retention Period (months)
          </label>
          <input
            type="number"
            id="dataRetention"
            value={dataRetentionMonths}
            onChange={(e) => setDataRetentionMonths(e.target.value)}
            min="1"
            max="120"
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            How long to keep event data after completion (1-120 months, default: 24)
          </p>
        </div>

        {/* Wall Retention Period */}
        <div>
          <label htmlFor="wallRetention" className="block text-sm font-medium text-gray-700 mb-2">
            Wall Message Retention Period (months, optional)
          </label>
          <input
            type="number"
            id="wallRetention"
            value={wallRetentionMonths}
            onChange={(e) => setWallRetentionMonths(e.target.value)}
            min="1"
            max="120"
            placeholder="Leave empty for no automatic cleanup"
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Automatically delete wall posts older than this period (optional)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpdateRetention}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Update Retention Settings"}
          </button>
        </div>

        {/* Advanced Actions */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Advanced Actions</h4>

          {!settings.archivedAt && (
            <div>
              <button
                onClick={handleArchive}
                disabled={saving}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                Archive Event Now
              </button>
              <p className="mt-1 text-xs text-gray-500">
                Archive this event immediately (soft delete - data is preserved but marked as archived)
              </p>
            </div>
          )}

          {!settings.scheduledForDeletionAt && (
            <div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label htmlFor="gracePeriod" className="block text-xs font-medium text-gray-700 mb-1">
                    Grace Period (days)
                  </label>
                  <input
                    type="number"
                    id="gracePeriod"
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(e.target.value)}
                    min="1"
                    max="365"
                    disabled={saving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 text-sm"
                  />
                </div>
                <button
                  onClick={handleScheduleDeletion}
                  disabled={saving}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  Schedule Permanent Deletion
                </button>
              </div>
              <p className="mt-1 text-xs text-red-600">
                ⚠️ This will permanently delete all event data after the grace period. This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-600 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Settings updated successfully
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RetentionSettings;
