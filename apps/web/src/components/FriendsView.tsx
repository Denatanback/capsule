import { useState, useEffect } from "react";
import { useFriendStore } from "../stores/friendStore";
import { useDMStore } from "../stores/dmStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useP2PStore } from "../stores/p2pStore";

export default function FriendsView() {
  const friends = useFriendStore((s) => s.friends);
  const incoming = useFriendStore((s) => s.incoming);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const accept = useFriendStore((s) => s.acceptRequest);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const removeFriend = useFriendStore((s) => s.removeFriend);
  const openDM = useDMStore((s) => s.openDM);
  const selectDM = useDMStore((s) => s.selectDM);
  const online = usePresenceStore((s) => s.onlineUsers);
  const requestP2P = useP2PStore((s) => s.requestP2P);
  const p2pStatus = useP2PStore((s) => s.p2pStatus);

  const [tab, setTab] = useState("online");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => { fetchFriends(); }, []);

  const isOnline = (uid: string) => online.includes(uid);
  const handleAdd = async () => {
    if (!addName.trim()) return;
    setAddError("");
    try { await sendRequest(addName.trim()); setAddName(""); }
    catch (e: any) { setAddError(e.message); }
  };

  const handleDM = async (uid: string) => {
    try { const ch = await openDM(uid); selectDM(ch.id); } catch {}
  };

  const tabs = ["online", "all", "pending", "add"];
  const onlineFriends = friends.filter((f: any) => isOnline(f.user.id));
  const displayList = tab === "online" ? onlineFriends : tab === "pending" ? [] : friends;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "var(--bg-chat)" }}>
      <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
        <span className="font-bold text-sm gradient-text">Crew Finder</span>
        <div className="flex gap-1 mt-2">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={"px-3 py-1 rounded-full text-xs font-semibold transition-colors " + (tab === t ? "text-white" : "")}
              style={tab === t ? { background: "var(--accent)" } : { color: "var(--text-muted)", background: "var(--bg-tertiary)" }}>
              {t === "all" ? "All" : t === "online" ? "Online" : t === "pending" ? "Pending" : "Add Crewmate"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "add" && (
          <div className="max-w-sm mx-auto py-8">
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Add crewmate by username</p>
            <div className="flex gap-2">
              <input value={addName} onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Username..." className="input-capsule flex-1 px-4 py-2.5 text-sm" />
              <button onClick={handleAdd} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--accent)" }}>Send</button>
            </div>
            {addError && <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{addError}</p>}
          </div>
        )}

        {tab === "pending" && incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Incoming — {incoming.length}</p>
            {incoming.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "var(--bg-tertiary)" }}>
                <div className="w-8 h-8 rounded-xl avatar-gradient-2 flex items-center justify-center text-white text-xs font-bold">
                  {r.from?.displayName?.charAt(0)?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.from?.displayName}</span>
                <button onClick={() => accept(r.id)} className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                  style={{ background: "var(--success)" }}>Accept</button>
              </div>
            ))}
          </div>
        )}

        {(tab === "online" || tab === "all") && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              {tab === "online" ? "Online" : "All Crew"} — {displayList.length}
            </p>
            <div className="space-y-1">
              {displayList.map((f: any) => {
                const peerOnline = isOnline(f.user.id);
                const grad = ["avatar-gradient-1","avatar-gradient-2","avatar-gradient-3","avatar-gradient-4"][(f.user.id?.charCodeAt(0) || 0) % 4];
                return (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div className="relative shrink-0">
                      <div className={"w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold " + grad}>
                        {f.user.displayName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className={"absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 " + (peerOnline ? "bg-green-500" : "bg-gray-500")}
                        style={{ borderColor: "var(--bg-chat)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.user.displayName}</p>
                      <p className="text-[10px]" style={{ color: peerOnline ? "var(--success)" : "var(--text-muted)" }}>{peerOnline ? "Online" : "Offline"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleDM(f.user.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Message</button>
                      {peerOnline && p2pStatus === "idle" && (
                        <button onClick={() => requestP2P(f.user.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white"
                          style={{ background: "var(--accent)" }}>Secure</button>
                      )}
                      <button onClick={() => { if (confirm("Remove?")) removeFriend(f.id); }}
                        className="px-1.5 py-1 rounded-lg text-[10px]" style={{ color: "var(--danger)" }}>×</button>
                    </div>
                  </div>
                );
              })}
              {displayList.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                  {tab === "online" ? "No crew online" : "No crew yet — add someone!"}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
