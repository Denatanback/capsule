import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useFriendStore } from "../stores/friendStore";
import { usePresenceStore } from "../stores/presenceStore";
import { api } from "../lib/api";
import Avatar from "../components/Avatar";
import { syncCurrentUserEverywhere } from "../lib/syncCurrentUser";

type Tab = "profile" | "settings" | "contacts";

export default function SettingsPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const dark = useThemeStore((s) => s.dark);
  const toggle = useThemeStore((s) => s.toggle);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const toggleSound = useNotificationStore((s) => s.toggleSound);
  const browserNotifsEnabled = useNotificationStore((s) => s.browserNotifsEnabled);
  const requestBrowserPermission = useNotificationStore((s) => s.requestBrowserPermission);
  const [tab, setTab] = useState<Tab>("profile");

  const close = () => nav("/");

  // Escape key to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "contacts", label: "Contacts", icon: "📇" },
  ];

  return (
    <div className="h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* Left sidebar nav */}
      <div className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="p-4 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>User Settings</h2>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={"w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all " +
                (tab === t.id ? "font-semibold" : "hover:opacity-80")}
              style={{
                background: tab === t.id ? "var(--accent-soft)" : "transparent",
                color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
              }}>
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Avatar name={user?.displayName} id={user?.id} size="sm" online={true} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user?.displayName}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>@{user?.username}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {tabs.find((t) => t.id === tab)?.icon} {tabs.find((t) => t.id === tab)?.label}
          </h1>
          <button onClick={close} className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all hover-lift"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }} title="Close (Esc)">✕</button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {tab === "profile" && <ProfileTab user={user} onUpdate={fetchUser} />}
          {tab === "settings" && <SettingsTab dark={dark} toggle={toggle} soundEnabled={soundEnabled} toggleSound={toggleSound} browserNotifsEnabled={browserNotifsEnabled} requestBrowserPermission={requestBrowserPermission} />}
          {tab === "contacts" && <ContactsTab />}
        </div>
      </div>
    </div>
  );
}

// === PROFILE TAB ===
function ProfileTab({ user, onUpdate }: any) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.updateProfile({ displayName, aboutMe });
      syncCurrentUserEverywhere({ displayName, aboutMe });
      await onUpdate();
      setMsg("Profile updated!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  return (
    <div className="max-w-lg space-y-6 fade-in">
      {(!window.isSecureContext || !navigator.mediaDevices) && (
        <div className="rounded-2xl p-4" style={{ background: "var(--warning-soft, rgba(245, 158, 11, 0.12))", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Microphone and clipboard are limited on plain HTTP.</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>On an IP like http://... the browser may block microphone access and clipboard copy. Voice messages and one-click invite copy will work reliably after HTTPS is enabled.</p>
        </div>
      )}
      {/* Preview card */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="h-24 avatar-gradient-1" />
        <div className="px-5 pb-5 -mt-10">
          <Avatar name={user?.displayName} id={user?.id} avatarUrl={user?.avatarUrl} size="lg" online={true} />
          <label className="block mt-2 cursor-pointer">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              Change avatar
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { avatarUrl: newUrl } = await api.uploadAvatar(file);
                syncCurrentUserEverywhere({ avatarUrl: newUrl });
                await useAuthStore.getState().fetchUser();
              } catch (err: any) { alert(err.message); }
            }} />
          </label>
          <h3 className="text-lg font-bold mt-2" style={{ color: "var(--text-primary)" }}>{displayName || user?.displayName}</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>@{user?.username}</p>
          {aboutMe && <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{aboutMe}</p>}
        </div>
      </div>

      {/* Edit form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64}
            className="w-full px-4 py-3 rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-500/30"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>About Me</label>
          <textarea value={aboutMe} onChange={(e) => setAboutMe(e.target.value)} maxLength={500} rows={4}
            placeholder="Tell people about yourself..."
            className="w-full px-4 py-3 rounded-xl outline-none text-sm font-medium resize-none focus:ring-2 focus:ring-indigo-500/30"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <p className="text-right text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{aboutMe.length}/500</p>
        </div>

        {msg && (
          <p className="text-sm font-medium fade-in" style={{ color: msg.includes("updated") ? "var(--success)" : "var(--danger)" }}>{msg}</p>
        )}

        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover-lift disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Account info */}
      <div className="pt-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Account</h3>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Email</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{user?.email}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Username</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>@{user?.username}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Joined</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{new Date(user?.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

// === SETTINGS TAB ===
function SettingsTab({ dark, toggle, soundEnabled, toggleSound, browserNotifsEnabled, requestBrowserPermission }: any) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState(localStorage.getItem("capsule_audio_input") || "");
  const [selectedOutput, setSelectedOutput] = useState(localStorage.getItem("capsule_audio_output") || "");

  useEffect(() => {
    const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.enumerateDevices) {
      setAudioDevices([]);
      return;
    }
    mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput"));
    }).catch(() => {
      setAudioDevices([]);
    });
  }, []);

  const inputs = audioDevices.filter((d) => d.kind === "audioinput");
  const outputs = audioDevices.filter((d) => d.kind === "audiooutput");

  return (
    <div className="max-w-lg space-y-6 fade-in">
      <Section title="Appearance">
        <SettingRow label="Theme" description="Switch between light and dark mode">
          <button onClick={toggle} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover-lift"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            {dark ? "🌙 Dark" : "☀️ Light"}
          </button>
        </SettingRow>
      </Section>

      <Section title="Audio Devices">
        <SettingRow label="Microphone" description="Select input device for voice chat and voice messages">
          <select value={selectedInput} onChange={(e) => { setSelectedInput(e.target.value); localStorage.setItem("capsule_audio_input", e.target.value); }}
            className="px-3 py-2 rounded-xl text-sm font-medium outline-none max-w-[220px]"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">Default</option>
            {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Mic " + d.deviceId.slice(0, 8)}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Speaker" description="Select output device for audio playback">
          <select value={selectedOutput} onChange={(e) => { setSelectedOutput(e.target.value); localStorage.setItem("capsule_audio_output", e.target.value); }}
            className="px-3 py-2 rounded-xl text-sm font-medium outline-none max-w-[220px]"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">Default</option>
            {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker " + d.deviceId.slice(0, 8)}</option>)}
          </select>
        </SettingRow>
      </Section>

      <Section title="Notifications">
        <SettingRow label="Sound" description="Play a sound when new messages arrive">
          <Toggle on={soundEnabled} onToggle={toggleSound} />
        </SettingRow>
        <SettingRow label="Desktop Notifications" description="Show browser notifications for new messages">
          <Toggle on={browserNotifsEnabled} onToggle={requestBrowserPermission} />
        </SettingRow>
      </Section>

      <Section title="Language">
        <SettingRow label="Interface Language" description="Choose your preferred language">
          <select className="px-3 py-2 rounded-xl text-sm font-medium outline-none"
            style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="en">English</option>
            <option value="ru">Русский</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </SettingRow>
      </Section>

      <Section title="Danger Zone">
        <div className="rounded-xl p-4" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Delete Account</p>
          <p className="text-xs mt-1 mb-3" style={{ color: "var(--text-muted)" }}>This action is permanent and cannot be undone.</p>
          <button className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover-lift"
            style={{ background: "var(--danger)" }}
            onClick={() => alert("Not implemented yet — safety first!")}>
            Delete My Account
          </button>
        </div>
      </Section>
    </div>
  );
}

// === CONTACTS TAB ===
function ContactsTab() {
  const friends = useFriendStore((s) => s.friends);
  const incoming = useFriendStore((s) => s.incoming);
  const outgoing = useFriendStore((s) => s.outgoing);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const removeFriend = useFriendStore((s) => s.remove);
  const acceptFriend = useFriendStore((s) => s.accept);
  const declineFriend = useFriendStore((s) => s.decline);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const [blocked, setBlocked] = useState([]);
  const [subtab, setSubtab] = useState("friends");

  useEffect(() => { fetchFriends(); loadBlocked(); }, []);

  const loadBlocked = async () => {
    try { const r = await api.listBlocked(); setBlocked(r.blocked); } catch {}
  };

  const unblock = async (uid: string) => {
    try { await api.unblockUser(uid); loadBlocked(); } catch {}
  };

  const block = async (uid: string) => {
    if (!confirm("Block this user?")) return;
    try { await api.blockUser(uid); removeFriend(uid); loadBlocked(); fetchFriends(); } catch {}
  };

  const subtabs = [
    { id: "friends", label: "Friends", count: friends.length },
    { id: "pending", label: "Pending", count: incoming.length + outgoing.length },
    { id: "blocked", label: "Blocked", count: blocked.length },
  ];

  return (
    <div className="max-w-lg fade-in">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: "var(--bg-tertiary)" }}>
        {subtabs.map((s) => (
          <button key={s.id} onClick={() => setSubtab(s.id)}
            className={"flex-1 py-2 rounded-lg text-xs font-semibold transition-all " +
              (subtab === s.id ? "" : "hover:opacity-80")}
            style={{
              background: subtab === s.id ? "var(--bg-primary)" : "transparent",
              color: subtab === s.id ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: subtab === s.id ? "var(--shadow-sm)" : "none",
            }}>
            {s.label} {s.count > 0 && <span className="ml-1 opacity-60">({s.count})</span>}
          </button>
        ))}
      </div>

      {/* Friends */}
      {subtab === "friends" && (
        <div className="space-y-1">
          {friends.length === 0 && <Empty text="No friends yet. Add some!" />}
          {friends.map((f: any) => (
            <ContactRow key={f.id} user={f.user} online={onlineUsers.includes(f.user.id)}
              actions={
                <>
                  <SmallBtn label="Block" color="var(--danger)" onClick={() => block(f.user.id)} />
                  <SmallBtn label="Remove" color="var(--warning)" onClick={() => removeFriend(f.id)} />
                </>
              } />
          ))}
        </div>
      )}

      {/* Pending */}
      {subtab === "pending" && (
        <div className="space-y-1">
          {incoming.length === 0 && outgoing.length === 0 && <Empty text="No pending requests" />}
          {incoming.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Incoming</p>
              {incoming.map((f: any) => (
                <ContactRow key={f.id} user={f.user}
                  actions={
                    <>
                      <SmallBtn label="Accept" color="var(--success)" onClick={() => acceptFriend(f.id)} />
                      <SmallBtn label="Decline" color="var(--text-muted)" onClick={() => declineFriend(f.id)} />
                    </>
                  } />
              ))}
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: "var(--text-muted)" }}>Outgoing</p>
              {outgoing.map((f: any) => (
                <ContactRow key={f.id} user={f.user}
                  actions={<span className="text-xs italic" style={{ color: "var(--text-muted)" }}>Pending...</span>} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Blocked */}
      {subtab === "blocked" && (
        <div className="space-y-1">
          {blocked.length === 0 && <Empty text="No blocked users" />}
          {blocked.map((u: any) => (
            <ContactRow key={u.id} user={u}
              actions={<SmallBtn label="Unblock" color="var(--accent)" onClick={() => unblock(u.id)} />} />
          ))}
        </div>
      )}
    </div>
  );
}

// === SHARED UI COMPONENTS ===
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{title}</h3>
      <div className="space-y-2 rounded-2xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="w-11 h-6 rounded-full relative transition-all"
      style={{ background: on ? "var(--accent)" : "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
        style={{ left: on ? "calc(100% - 22px)" : "1px" }} />
    </button>
  );
}

function ContactRow({ user, online, actions }: { user: any; online?: boolean; actions: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
      style={{ background: "var(--bg-secondary)" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}>
      <Avatar name={user.displayName} id={user.id} size="sm" online={online ?? null} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.displayName}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">{actions}</div>
    </div>
  );
}

function SmallBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
      style={{ color, border: "1px solid " + color + "40" }}>
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}
