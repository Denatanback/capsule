import { useAuthStore } from "../stores/authStore";
import { useDMStore } from "../stores/dmStore";
import { useFriendStore } from "../stores/friendStore";
import { useMessageStore } from "../stores/messageStore";
import { useServerStore } from "../stores/serverStore";

type Patch = Record<string, any>;

function patchUserLike(value: any, userId: string, patch: Patch) {
  if (!value || typeof value !== "object") return value;
  if (value.id === userId) return { ...value, ...patch };
  return value;
}

export function syncCurrentUserEverywhere(patch: Patch) {
  const auth = useAuthStore.getState();
  const userId = auth.user?.id;
  if (!userId) return;

  useAuthStore.setState((state: any) => ({
    user: state.user ? { ...state.user, ...patch } : state.user,
  }));

  useMessageStore.setState((state: any) => {
    const nextMessages: Record<string, any[]> = {};
    for (const [channelId, items] of Object.entries(state.messages || {})) {
      nextMessages[channelId] = (items as any[]).map((msg) => (
        msg?.author?.id === userId
          ? { ...msg, author: { ...msg.author, ...patch } }
          : msg
      ));
    }
    return { messages: nextMessages };
  });

  useDMStore.setState((state: any) => ({
    channels: (state.channels || []).map((ch: any) => ({
      ...ch,
      userA: patchUserLike(ch.userA, userId, patch),
      userB: patchUserLike(ch.userB, userId, patch),
    })),
    messages: Object.fromEntries(
      Object.entries(state.messages || {}).map(([dmId, items]) => [
        dmId,
        (items as any[]).map((msg) => (
          msg?.author?.id === userId
            ? { ...msg, author: { ...msg.author, ...patch } }
            : msg
        )),
      ])
    ),
  }));

  useFriendStore.setState((state: any) => ({
    friends: (state.friends || []).map((f: any) => ({ ...f, user: patchUserLike(f.user, userId, patch) })),
    incoming: (state.incoming || []).map((f: any) => ({ ...f, from: patchUserLike(f.from, userId, patch), to: patchUserLike(f.to, userId, patch) })),
    outgoing: (state.outgoing || []).map((f: any) => ({ ...f, from: patchUserLike(f.from, userId, patch), to: patchUserLike(f.to, userId, patch) })),
  }));

  useServerStore.setState((state: any) => ({
    serverDetail: state.serverDetail ? {
      ...state.serverDetail,
      members: (state.serverDetail.members || []).map((m: any) => ({
        ...m,
        user: patchUserLike(m.user, userId, patch),
      })),
    } : state.serverDetail,
  }));
}
