import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useServerStore } from "../stores/serverStore";
import FilePreview from "./FilePreview";

export default function FileBrowser({ onClose }: { onClose: () => void }) {
  const sd = useServerStore((s) => s.serverDetail);
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!sd?.id) return;
    setLoading(true);
    try {
      const res = await api.getServerFiles(sd.id, filter);
      setFiles(res.files);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [sd?.id, filter]);

  const handleDelete = async (uuid) => {
    if (!confirm("Delete this file?")) return;
    try { await api.deleteFile(uuid); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-bold">Files — {sd?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="flex gap-1 px-5 py-2 border-b border-gray-200 dark:border-gray-700">
          {["", "images", "docs", "media"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={"px-3 py-1 text-xs rounded " + (filter === f ? "bg-indigo-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400")}>
              {f || "All"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <p className="text-sm text-gray-400 text-center">Loading...</p>}
          {!loading && files.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No files yet</p>}
          {files.map((file) => (
            <div key={file.id} className="flex items-start gap-3 group">
              <div className="flex-1">
                <FilePreview file={file} />
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(file.createdAt).toLocaleDateString()} &middot; {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button onClick={() => handleDelete(file.uuid)}
                className="text-xs text-red-400 opacity-0 group-hover:opacity-100 mt-1">Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
