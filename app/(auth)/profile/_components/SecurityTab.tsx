"use client";

import Image from "next/image";
import { FormInput } from "@/components/ui/FormField";
import { EmailIcon, AgentIcon } from "@/components/icons";
import { useDiscordConnection } from "../_hooks/useDiscordConnection";
import { useGithubConnection } from "../_hooks/useGithubConnection";
import { useGoogleConnection } from "../_hooks/useGoogleConnection";
import { useMfaEnrollment } from "../_hooks/useMfaEnrollment";
import { useEmailManagement } from "../_hooks/useEmailManagement";

interface AdditionalEmail {
  email: string;
  verified: boolean;
}

interface ConnectedAgent {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
}

interface SecurityTabProps {
  discord: ReturnType<typeof useDiscordConnection>;
  github: ReturnType<typeof useGithubConnection>;
  google: ReturnType<typeof useGoogleConnection>;
  mfa: ReturnType<typeof useMfaEnrollment>;
  email: ReturnType<typeof useEmailManagement>;
  primaryEmail: string | null;
  additionalEmails: AdditionalEmail[];
  hasPasswordProvider: boolean;
  connectedAgents: ConnectedAgent[];
  loadingAgents: boolean;
  onSetPassword: (password: string) => Promise<void>;
  passwordSaving: boolean;
  passwordError: string | null;
  passwordSuccess: boolean;
}

export function SecurityTab({
  discord,
  github,
  google,
  mfa,
  email,
  primaryEmail,
  additionalEmails,
  hasPasswordProvider,
  connectedAgents,
  loadingAgents,
  onSetPassword,
  passwordSaving,
  passwordError,
  passwordSuccess,
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      {/* Email Verification Status Banner */}
      {email.verificationStatus && (
        <div
          className={`p-4 rounded-lg ${
            email.verificationStatus.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {email.verificationStatus.message}
          <button onClick={() => email.setVerificationStatus(null)} className="ml-2 text-sm underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Email Addresses */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-2">Email Addresses</h2>
        <p className="text-neutral-400 text-sm mb-4">
          Manage the email addresses associated with your account. You can use any verified email to sign in.
        </p>

        <div className="space-y-3 mb-6">
          {/* Primary Email */}
          <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <EmailIcon className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-sm">{primaryEmail}</p>
                <p className="text-neutral-400 text-xs">Primary email</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Primary</span>
          </div>

          {/* Additional Emails */}
          {additionalEmails?.map((emailEntry) => (
            <div key={emailEntry.email} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center">
                  <EmailIcon className="text-neutral-400" />
                </div>
                <div>
                  <p className="text-white text-sm">{emailEntry.email}</p>
                  <p className="text-neutral-400 text-xs">{emailEntry.verified ? "Verified" : "Pending verification"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {emailEntry.verified && (
                  <button
                    onClick={() => email.makePrimary(emailEntry.email)}
                    disabled={email.primaryLoading === emailEntry.email}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  >
                    {email.primaryLoading === emailEntry.email ? "..." : "Make Primary"}
                  </button>
                )}
                <button
                  onClick={() => email.removeEmail(emailEntry.email)}
                  disabled={email.removeLoading === emailEntry.email}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {email.removeLoading === emailEntry.email ? "..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Email */}
        <div>
          <label htmlFor="new-email" className="block text-sm font-medium text-neutral-300 mb-2">
            Add another email
          </label>
          <div className="flex gap-3">
            <input
              id="new-email"
              type="email"
              value={email.newEmail}
              onChange={(e) => email.setNewEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
            <button
              onClick={email.addEmail}
              disabled={email.addLoading || !email.newEmail.trim()}
              className="px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {email.addLoading ? "Sending..." : "Add Email"}
            </button>
          </div>
          {email.addError && <p className="text-red-400 text-sm mt-2">{email.addError}</p>}
          {email.addSuccess && <p className="text-emerald-400 text-sm mt-2">{email.addSuccess}</p>}
        </div>
      </div>

      {/* Account Security */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Account Security</h2>
        <div className="space-y-6">
          {/* Google */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-medium">Google Login</p>
              <p className="text-neutral-400 text-sm">{google.hasGoogleProvider ? "Connected" : "Not connected"}</p>
            </div>
            {google.hasGoogleProvider && (
              <button
                onClick={google.disconnect}
                disabled={google.disconnecting}
                className="px-3 py-2 bg-neutral-800/50 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {google.disconnecting ? "Disconnecting..." : "Disconnect Google"}
              </button>
            )}
          </div>
          {google.error && <p className="text-red-400 text-sm">{google.error}</p>}

          {/* Password */}
          <PasswordSection
            hasPasswordProvider={hasPasswordProvider}
            onSetPassword={onSetPassword}
            saving={passwordSaving}
            error={passwordError}
            success={passwordSuccess}
          />

          {/* MFA */}
          <MfaSection mfa={mfa} />
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Connected Accounts</h2>
        <div className="space-y-4">
          {/* Discord */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-medium">Discord</p>
              <p className="text-neutral-400 text-sm">
                {discord.discordInfo ? `Connected as ${discord.discordInfo.username}` : "Not connected"}
              </p>
            </div>
            {discord.discordInfo ? (
              <button onClick={discord.disconnect} disabled={discord.disconnecting} className="px-3 py-2 bg-[#5865F2]/10 text-[#5865F2] text-sm rounded-lg inline-flex items-center gap-2 hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]">
                {discord.disconnecting ? "Disconnecting..." : "Disconnect Discord"}
              </button>
            ) : (
              <button onClick={discord.connect} disabled={discord.connecting} className="px-3 py-2 bg-[#5865F2] text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-[#4752C4] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]">
                {discord.connecting ? "Connecting..." : "Connect Discord"}
              </button>
            )}
          </div>

          {/* GitHub */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-medium">GitHub</p>
              <p className="text-neutral-400 text-sm">
                {github.githubInfo ? `Connected as ${github.githubInfo.login}` : "Not connected"}
              </p>
            </div>
            {github.githubInfo ? (
              <button onClick={github.disconnect} disabled={github.disconnecting} className="px-3 py-2 bg-neutral-800/50 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {github.disconnecting ? "Disconnecting..." : "Disconnect GitHub"}
              </button>
            ) : (
              <button onClick={github.connect} disabled={github.connecting} className="px-3 py-2 bg-neutral-800 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {github.connecting ? "Connecting..." : "Connect GitHub"}
              </button>
            )}
          </div>

          {/* AI Agents */}
          <div className="pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-medium">AI Agents</p>
                <p className="text-neutral-400 text-sm">
                  {loadingAgents ? "Loading..." : connectedAgents.length > 0 ? `${connectedAgents.length} agent${connectedAgents.length > 1 ? "s" : ""} connected` : "No agents connected"}
                </p>
              </div>
              {connectedAgents.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded-lg">
                  <AgentIcon className="text-purple-400 w-3.5 h-3.5" />
                  <span className="text-purple-400 text-xs font-medium">{connectedAgents.length}</span>
                </div>
              )}
            </div>
            {connectedAgents.length > 0 && (
              <div className="space-y-2">
                {connectedAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      {agent.avatarUrl ? (
                        <Image src={agent.avatarUrl} alt={agent.name} width={32} height={32} className="rounded-full" />
                      ) : (
                        <AgentIcon className="text-purple-400 w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{agent.name}</p>
                      {agent.description && <p className="text-neutral-400 text-xs truncate">{agent.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded text-xs text-emerald-400">Active</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Internal sub-components ──────────────────────────────────────────────────

interface PasswordSectionProps {
  hasPasswordProvider: boolean;
  onSetPassword: (password: string) => Promise<void>;
  saving: boolean;
  error: string | null;
  success: boolean;
}

function PasswordSection({ hasPasswordProvider, onSetPassword, saving, error, success }: PasswordSectionProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!password || password.length < 8) { setLocalError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setLocalError("Passwords do not match."); return; }
    await onSetPassword(password);
    if (!error) { setPassword(""); setConfirmPassword(""); }
  };

  return (
    <div>
      <p className="text-white font-medium mb-2">{hasPasswordProvider ? "Update Password" : "Set a Password"}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <FormInput id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
        <FormInput id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          {saving ? "Saving..." : "Save Password"}
        </button>
        {success && <p className="text-emerald-400 text-sm">Password updated.</p>}
      </div>
      {(localError || error) && <p className="text-red-400 text-sm mt-2">{localError || error}</p>}
    </div>
  );
}

import { useState } from "react";

interface MfaSectionProps {
  mfa: ReturnType<typeof useMfaEnrollment>;
}

function MfaSection({ mfa }: MfaSectionProps) {
  return (
    <div>
      <p className="text-white font-medium mb-2">Two-Factor Authentication</p>
      <p className="text-neutral-400 text-sm mb-3">
        {mfa.hasPhoneMfa ? "Enabled with SMS." : "Use SMS to add an extra layer of security."}
      </p>
      <div className="space-y-3">
        <FormInput id="phone-number" type="tel" value={mfa.phoneNumber} onChange={(e) => mfa.setPhoneNumber(e.target.value)} placeholder="+15551234567" disabled={mfa.hasPhoneMfa} />
        <div className="flex flex-wrap gap-3">
          <button onClick={mfa.sendCode} disabled={mfa.loading || mfa.hasPhoneMfa} className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {mfa.loading ? "Sending..." : "Send Code"}
          </button>
          <button onClick={mfa.disable} disabled={mfa.loading || !mfa.hasPhoneMfa} className="px-4 py-2 bg-neutral-800/50 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Disable 2FA
          </button>
        </div>
        {mfa.verificationId && (
          <div className="space-y-3">
            <FormInput id="sms-code" type="text" value={mfa.smsCode} onChange={(e) => mfa.setSmsCode(e.target.value)} placeholder="Enter SMS code" />
            <button onClick={mfa.confirmEnrollment} disabled={mfa.loading} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
              {mfa.loading ? "Verifying..." : "Enable 2FA"}
            </button>
          </div>
        )}
        {mfa.error && <p className="text-red-400 text-sm">{mfa.error}</p>}
        {mfa.success && <p className="text-emerald-400 text-sm">{mfa.success}</p>}
        <div id="mfa-recaptcha-container" />
      </div>
    </div>
  );
}
