const BASE = "/api";
let isRefreshing = false;

// Import lazily to avoid circular deps
let _reauthWs: (() => void) | null = null;
function getReauthWs() {
  if (!_reauthWs) {
    import("./ws").then((m) => { _reauthWs = m.reauthWs; });
  }
  return _reauthWs;
}
// Trigger lazy load
getReauthWs();

async function req(path, opts) {
  const token = localStorage.getItem("capsule_token");
  const hasBody = opts?.body != null;
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...opts?.headers,
    },
  });

  // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
  if (res.status === 401 && !path.startsWith("/auth/") && !isRefreshing) {
    isRefreshing = true;
    const refreshToken = localStorage.getItem("capsule_refresh");
    if (refreshToken) {
      try {
        const rRes = await fetch(BASE + "/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          localStorage.setItem("capsule_token", rData.token);
          if (rData.refreshToken) localStorage.setItem("capsule_refresh", rData.refreshToken);
          isRefreshing = false;
          // Re-authenticate WS with new token
          const reauth = getReauthWs();
          if (reauth) reauth();
          // Retry original request
          return req(path, opts);
        }
      } catch {}
    }
    isRefreshing = false;
    localStorage.removeItem("capsule_token");
    localStorage.removeItem("capsule_refresh");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (body) => req("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => req("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => req("/auth/me"),
  refresh: (body) => req("/auth/refresh", { method: "POST", body: JSON.stringify(body) }),
  logout: (body) => req("/auth/logout", { method: "POST", body: JSON.stringify(body) }),

  listServers: () => req("/servers"),
  getServer: (id) => req("/servers/" + id),
  createServer: (name) => req("/servers", { method: "POST", body: JSON.stringify({ name }) }),
  updateServer: (id, data) => req("/servers/" + id, { method: "PATCH", body: JSON.stringify(data) }),
  deleteServer: (id) => req("/servers/" + id, { method: "DELETE" }),
  joinServer: (id) => req("/servers/" + id + "/join", { method: "POST" }),
  leaveServer: (id) => req("/servers/" + id + "/leave", { method: "POST" }),
  getMembers: (id) => req("/servers/" + id + "/members"),

  listChannels: (sid) => req("/servers/" + sid + "/channels"),
  createChannel: (sid, data) => req("/servers/" + sid + "/channels", { method: "POST", body: JSON.stringify(data) }),
  updateChannel: (sid, cid, data) => req("/servers/" + sid + "/channels/" + cid, { method: "PATCH", body: JSON.stringify(data) }),
  deleteChannel: (sid, cid) => req("/servers/" + sid + "/channels/" + cid, { method: "DELETE" }),

  // Friends
  listFriends: () => req("/friends"),
  sendFriendRequest: (username) => req("/friends/request", { method: "POST", body: JSON.stringify({ username }) }),
  acceptFriend: (id) => req("/friends/" + id + "/accept", { method: "POST" }),
  declineFriend: (id) => req("/friends/" + id + "/decline", { method: "POST" }),
  removeFriend: (id) => req("/friends/" + id, { method: "DELETE" }),

  // DM
  listDMs: () => req("/dm"),
  openDM: (targetUserId) => req("/dm/open", { method: "POST", body: JSON.stringify({ targetUserId }) }),
  getDMMessages: (dmId, cursor) => req("/dm/" + dmId + "/messages" + (cursor ? "?cursor=" + cursor : "")),

  // Game
  getCity: () => req("/game/city"),
  buildBuilding: (defId, gridX, gridY) => req("/game/build", { method: "POST", body: JSON.stringify({ defId, gridX, gridY }) }),
  upgradeBuilding: (buildingId) => req("/game/upgrade", { method: "POST", body: JSON.stringify({ buildingId }) }),
  collectIncome: () => req("/game/collect", { method: "POST" }),
  setVisibility: (visible) => req("/game/visibility", { method: "POST", body: JSON.stringify({ visible }) }),
  renameCity: (name) => req("/game/rename", { method: "POST", body: JSON.stringify({ name }) }),
  searchPlayers: (q) => req("/game/map/search?q=" + encodeURIComponent(q)),
  explorePlayers: () => req("/game/map/explore"),
  viewCity: (userId) => req("/game/city/" + userId),

  pickStarter: (picks) => req("/game/starter", { method: "POST", body: JSON.stringify({ picks }) }),
  unlockTech: (techId) => req("/game/tech", { method: "POST", body: JSON.stringify({ techId }) }),
  getLeaderboard: (type, scope) => req("/game/leaderboard?type=" + (type || "population") + "&scope=" + (scope || "global")),

  // Search
  search: (q, type, serverId) => req("/search?q=" + encodeURIComponent(q) + "&type=" + (type || "all") + (serverId ? "&serverId=" + serverId : "")),

  // Profile
  updateProfile: (body) => req("/profile", { method: "PATCH", body: JSON.stringify(body) }),
  getProfile: (uid) => req("/profile/" + uid),
  blockUser: (uid) => req("/blocks/" + uid, { method: "POST" }),
  unblockUser: (uid) => req("/blocks/" + uid, { method: "DELETE" }),
  listBlocked: () => req("/blocks"),

  // Notifications
  getUnread: () => req("/notifications/unread"),
  markChannelRead: (chId) => req("/channels/" + chId + "/read", { method: "POST" }),
  markDMRead: (dmId) => req("/dm/" + dmId + "/read", { method: "POST" }),

  // Files
  uploadFile: async (file, serverId, channelId) => {
    const token = localStorage.getItem("capsule_token");
    const fd = new FormData();
    fd.append("file", file);
    if (serverId) fd.append("serverId", serverId);
    if (channelId) fd.append("channelId", channelId);
    const res = await fetch("/api/files/upload", {
      method: "POST",
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data;
  },
  getServerFiles: (sid, type, cursor) => req("/servers/" + sid + "/files" + "?type=" + (type || "") + (cursor ? "&cursor=" + cursor : "")),
  getRecentActivity: () => req("/activity/recent"),
  uploadAvatar: async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const token = localStorage.getItem("capsule_token");
    const r = await fetch(BASE + "/profile/avatar", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {}, body: fd });
    if (!r.ok) throw new Error((await r.json()).error);
    return r.json();
  },
  uploadVoice: async (blob: Blob) => {
    const fd = new FormData(); fd.append("file", blob, "voice.webm");
    const token = localStorage.getItem("capsule_token");
    const r = await fetch(BASE + "/voice-upload", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {}, body: fd });
    if (!r.ok) throw new Error((await r.json()).error);
    return r.json();
  },
  deleteFile: (uuid) => req("/files/" + uuid, { method: "DELETE" }),
  getFileUrl: (uuid) => "/api/files/" + uuid,

  // Invites
  createInvite: (sid, opts) => req("/servers/" + sid + "/invites", { method: "POST", body: JSON.stringify(opts || {}) }),
  listInvites: (sid) => req("/servers/" + sid + "/invites"),
  deleteInvite: (sid, iid) => req("/servers/" + sid + "/invites/" + iid, { method: "DELETE" }),
  lookupInvite: (code) => req("/invites/" + code),
  useInvite: (code) => req("/invites/" + code + "/join", { method: "POST" }),
  joinInvite: (code) => req("/invites/" + code + "/join", { method: "POST" }),

  // Member management
  kickMember: (sid, uid) => req("/servers/" + sid + "/members/" + uid + "/kick", { method: "POST" }),
  banMember: (sid, uid, reason) => req("/servers/" + sid + "/members/" + uid + "/ban", { method: "POST", body: JSON.stringify({ reason }) }),
  unbanMember: (sid, uid) => req("/servers/" + sid + "/bans/" + uid + "/unban", { method: "POST" }),
  listBans: (sid) => req("/servers/" + sid + "/bans"),
  promoteMember: (sid, uid) => req("/servers/" + sid + "/members/" + uid + "/promote", { method: "POST" }),
  demoteMember: (sid, uid) => req("/servers/" + sid + "/members/" + uid + "/demote", { method: "POST" }),
  transferOwnership: (sid, uid) => req("/servers/" + sid + "/members/" + uid + "/transfer", { method: "POST" }),

  // Notes
  getNotes: () => req("/notes"),
  createNote: (content, fileUrl?, fileName?) => req("/notes", { method: "POST", body: JSON.stringify({ content, fileUrl, fileName }) }),
  updateNote: (noteId, content) => req("/notes/" + noteId, { method: "PATCH", body: JSON.stringify({ content }) }),
  deleteNote: (noteId) => req("/notes/" + noteId, { method: "DELETE" }),
  forwardToNotes: (messageId?, dmMessageId?) => req("/notes/forward", { method: "POST", body: JSON.stringify({ messageId, dmMessageId }) }),
};
