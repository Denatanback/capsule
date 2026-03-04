import { useRef, useState } from "react";
import { api } from "../lib/api";

const MAX_SIZE = 25 * 1024 * 1024;

export default function FileUpload({ serverId, channelId, onUploaded }: {
  serverId?: string;
  channelId?: string;
  onUploaded: (file: any) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const handle = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) { alert("File too large (max 25MB)"); return; }

    setUploading(true);
    setProgress(file.name);
    try {
      const res = await api.uploadFile(file, serverId, channelId);
      onUploaded(res.file);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress("");
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" className="hidden" onChange={handle} />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className={"p-2 rounded-lg text-gray-500 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 " + (uploading ? "opacity-50" : "")}
        title="Attach file">
        {uploading ? (
          <span className="text-xs">{progress.slice(0, 10)}...</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>
    </>
  );
}
