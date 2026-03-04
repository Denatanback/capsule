import { useState, useEffect } from "react";
import { useFriendStore } from "../stores/friendStore";
import { useDMStore } from "../stores/dmStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useP2PStore } from "../stores/p2pStore";

export default function FriendsView() {
  const friends = useFriendStore((s) => s.friends);
  const incoming = useFriendStore((s) => s.incoming);
  const outgoing = useFriendStore((s) => s.outgoing);
  const loading = useFriendStore((s) => s.loading);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const accept = useFriendStore((s) => s.accept);
  const decline = useFriendStore((s) => s.decline);
  const remove = useFriendStore((s) => s.remove);
  const openDM = useDMStore((s) => s.openDM);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const requestP2P = useP2PStore((s) => s.requestP2P);
  const [username, setUsername] = useState("");
  const [tab, setTab] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => { fetchFriends(); }, []);

  const handleAdd = async () => {
    if (!username.trim()) return;
    setError("");
    try {
      await sendRequest(username.trim());
      setUsername("");
    } catch (e) {
      setError(e.message || "Failed");
    }
  };

  const handleDM = async (userId) => {
    await openDM(userId);
  };

  const isOnline = (uid) => onlineUsers.includes(uid);
  const onlineFriends = friends.filter((f) => isOnline(f.user.id));
  const displayList = tab === "online" ? onlineFriends : tab === "pending" ? [] : friends;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      <div className="h-12 px-4 flex items-center border-b border-gray-200 dark:border-gray-800 gap-4">
        <span className="font-bold text-sm">Friends</span>
        <div className="flex gap-1">
          {["all", "online", "pending", "add"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={"px-3 py-1 text-xs rounded " + (tab === t ? "bg-gray-200 dark:bg-gray-700 font-medium" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800")}>
              {t === "all" ? "All" : t === "online" ? "Online" : t === "pending" ? "Pending" : "Add Friend"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "add" && (
          <div className="max-w-md">
            <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">Add friend by username</p>
            <div className="flex gap-2">
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Enter a username"
                className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                Send Request
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>
        )}

        {tab === "pending" && (
          <div className="space-y-2">
            {incoming.length > 0 && <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Incoming - {incoming.length}</p>}
            {incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {f.user.displayName?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.user.displayName}</p>
                  <p className="text-xs text-gray-400">@{f.user.username}</p>
                </div>
                <button onClick={() => accept(f.id)} className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Accept</button>
                <button onClick={() => decline(f.id)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">Decline</button>
              </div>
            ))}
            {outgoing.length > 0 && <p className="text-xs text-gray-500 uppercase font-semibold mb-2 mt-4">Outgoing - {outgoing.length}</p>}
            {outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="w-9 h-9 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm font-bold">
                  {f.user.displayName?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.user.displayName}</p>
                  <p className="text-xs text-gray-400">Pending...</p>
                </div>
              </div>
            ))}
            {incoming.length === 0 && outgoing.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No pending requests</p>
            )}
          </div>
        )}

        {(tab === "all" || tab === "online") && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">
              {tab === "online" ? "Online" : "All Friends"} - {displayList.length}
            </p>
            {displayList.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                    {f.user.displayName?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className={"absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 " + (isOnline(f.user.id) ? "bg-green-500" : "bg-gray-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.user.displayName}</p>
                  <p className="text-xs text-gray-400">{isOnline(f.user.id) ? "Online" : "Offline"}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button onClick={() => handleDM(f.user.id)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300" title="Message">DM</button>
                  {isOnline(f.user.id) && (
                    <button onClick={() => requestP2P(f.user.id)} className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded hover:bg-green-200" title="P2P encrypted chat">P2P</button>
                  )}
                  <button onClick={() => remove(f.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded" title="Remove">x</button>
                </div>
              </div>
            ))}
            {displayList.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                {tab === "online" ? "No friends online" : "No friends yet. Add someone!"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
