import { useEffect } from "react";
import { useDMStore } from "../stores/dmStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { useNotificationStore } from "../stores/notificationStore";

export default function DMList({ onSelectFriends, onSelectDM }: any) {
  const channels = useDMStore((s) => s.channels);
  const activeDMId = useDMStore((s) => s.activeDMId);
  const selectDM = onSelectDM || useDMStore((s) => s.selectDM);
  const fetchChannels = useDMStore((s) => s.fetchChannels);
  const user = useAuthStore((s) => s.user);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const dmUnreads = useNotificationStore((s) => s.dmUnreads);
  const markDMRead = useNotificationStore((s) => s.markDMRead);

  useEffect(() => { fetchChannels(); }, []);

  const getOther = (ch) => {
    if (!user) return null;
    return ch.userA?.id === user.id ? ch.userB : ch.userA;
  };

  return (
    <div className="w-60 bg-gray-100 dark:bg-gray-900 flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-800">
      <div className="h-12 px-4 flex items-center border-b border-gray-200 dark:border-gray-800">
        <span className="font-bold text-sm">Direct Messages</span>
      </div>

      <div className="p-2">
        <button onClick={onSelectFriends}
          className={"w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-800 " + (!activeDMId ? "bg-gray-200 dark:bg-gray-700 font-medium" : "text-gray-600 dark:text-gray-400")}>
          Friends
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <p className="text-[10px] uppercase text-gray-400 font-semibold px-2 mb-1">Conversations</p>
        {channels.map((ch) => {
          const other = getOther(ch);
          if (!other) return null;
          const online = onlineUsers.includes(other.id);
          return (
            <div key={ch.id} onClick={() => { selectDM(ch.id); markDMRead(ch.id); }}
              className={"flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer " +
                (activeDMId === ch.id ? "bg-gray-300 dark:bg-gray-700" : "hover:bg-gray-200 dark:hover:bg-gray-800")}>
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                  {other.displayName?.charAt(0)?.toUpperCase()}
                </div>
                <div className={"absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-100 dark:border-gray-900 " + (online ? "bg-green-500" : "bg-gray-400")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={"text-sm truncate " + (dmUnreads[ch.id] ? "font-bold" : "")}>{other.displayName}</p>
              </div>
              {dmUnreads[ch.id] > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 shrink-0">
                  {dmUnreads[ch.id]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
