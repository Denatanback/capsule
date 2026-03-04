export default function FilePreview({ file }: { file: any }) {
  const url = "/api/files/" + file.uuid;
  const isImage = file.mime?.startsWith("image/");
  const isVideo = file.mime?.startsWith("video/");
  const isAudio = file.mime?.startsWith("audio/");
  const isPdf = file.mime === "application/pdf";
  const sizeStr = file.size < 1024 ? file.size + " B"
    : file.size < 1024 * 1024 ? (file.size / 1024).toFixed(1) + " KB"
    : (file.size / 1024 / 1024).toFixed(1) + " MB";

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener" className="block mt-1">
        <img src={url} alt={file.filename}
          className="max-w-xs max-h-60 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90" />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video controls className="max-w-xs max-h-60 rounded-lg mt-1 border border-gray-200 dark:border-gray-700">
        <source src={url} type={file.mime} />
      </video>
    );
  }

  if (isAudio) {
    return (
      <audio controls className="mt-1 max-w-xs">
        <source src={url} type={file.mime} />
      </audio>
    );
  }

  // Generic file card
  return (
    <a href={url} target="_blank" rel="noopener"
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 max-w-xs">
      <div className="shrink-0">
        {isPdf ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate text-indigo-500">{file.filename}</p>
        <p className="text-xs text-gray-400">{sizeStr}</p>
      </div>
    </a>
  );
}
