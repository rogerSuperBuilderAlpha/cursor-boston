"use client";

import { FormInput, FormTextarea, ToggleSwitch } from "@/components/ui/FormField";
import { ProfileSettings } from "../_hooks/useProfileSettings";

interface SettingsTabProps {
  settings: ProfileSettings;
  setSettings: React.Dispatch<React.SetStateAction<ProfileSettings>>;
  saving: boolean;
  error: string | null;
  success: boolean;
  onSave: () => Promise<void>;
  onToggleAllVisibility: (show: boolean) => void;
}

const VISIBILITY_FIELDS: { key: keyof ProfileSettings["visibility"]; label: string }[] = [
  { key: "showBio", label: "Bio" },
  { key: "showLocation", label: "Location" },
  { key: "showCompany", label: "Company" },
  { key: "showJobTitle", label: "Job Title" },
  { key: "showEmail", label: "Email" },
  { key: "showDiscord", label: "Discord Badge" },
  { key: "showGithubBadge", label: "GitHub Badge" },
  { key: "showEventsAttended", label: "Events Attended" },
  { key: "showTalksGiven", label: "Talks Given" },
  { key: "showWebsite", label: "Website" },
  { key: "showLinkedIn", label: "LinkedIn" },
  { key: "showTwitter", label: "X (Twitter)" },
  { key: "showGithub", label: "GitHub" },
  { key: "showSubstack", label: "Substack" },
  { key: "showMemberSince", label: "Member Since" },
];

export function SettingsTab({
  settings,
  setSettings,
  saving,
  error,
  success,
  onSave,
  onToggleAllVisibility,
}: SettingsTabProps) {
  const updateField = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const updateSocialLink = (key: keyof ProfileSettings["socialLinks"], value: string) =>
    setSettings((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));

  const updateVisibility = (key: keyof ProfileSettings["visibility"], value: boolean) =>
    setSettings((prev) => ({ ...prev, visibility: { ...prev.visibility, [key]: value } }));

  return (
    <div className="space-y-6">
      {/* Profile Visibility Toggle */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Public Profile</h2>
          <ToggleSwitch
            size="md"
            label="Public profile"
            checked={settings.visibility.isPublic}
            onChange={(checked) => updateVisibility("isPublic", checked)}
          />
        </div>
        <p className="text-neutral-400 text-sm">
          {settings.visibility.isPublic
            ? "Your profile is visible on the Members page"
            : "Your profile is hidden from the Members page"}
        </p>
      </div>

      {/* Profile Information */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
        <div className="space-y-4">
          <FormTextarea
            id="bio"
            label="Bio"
            value={settings.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <FormInput
              id="location"
              label="Location"
              value={settings.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="Boston, MA"
            />
            <FormInput
              id="company"
              label="Company"
              value={settings.company}
              onChange={(e) => updateField("company", e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <FormInput
            id="jobTitle"
            label="Job Title"
            value={settings.jobTitle}
            onChange={(e) => updateField("jobTitle", e.target.value)}
            placeholder="Software Engineer"
          />
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Social Links</h2>
        <div className="space-y-4">
          {(
            [
              { key: "website", label: "Website", placeholder: "https://yourwebsite.com" },
              { key: "linkedIn", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
              { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/username" },
              { key: "github", label: "GitHub", placeholder: "https://github.com/username" },
              { key: "substack", label: "Substack", placeholder: "https://yourname.substack.com" },
            ] as const
          ).map(({ key, label, placeholder }) => (
            <FormInput
              key={key}
              type="url"
              id={key}
              label={label}
              value={settings.socialLinks[key]}
              onChange={(e) => updateSocialLink(key, e.target.value)}
              placeholder={placeholder}
            />
          ))}
        </div>
      </div>

      {/* Visibility Toggles */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">What to Show on Your Public Profile</h2>
          <div className="flex gap-2">
            <button
              onClick={() => onToggleAllVisibility(true)}
              className="px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded min-h-[44px] flex items-center"
            >
              Show All
            </button>
            <button
              onClick={() => onToggleAllVisibility(false)}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded min-h-[44px] flex items-center"
            >
              Hide All
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {VISIBILITY_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-neutral-300 text-sm">{label}</span>
              <ToggleSwitch
                label={label}
                checked={settings.visibility[key] as boolean}
                onChange={(checked) => updateVisibility(key, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-emerald-400 text-sm">Settings saved successfully!</p>}
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
