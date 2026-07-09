"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BATCH_FILES = 80;
const MAX_BATCH_BYTES = 1024 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_MB = MAX_AUDIO_UPLOAD_BYTES / 1024 / 1024;

type UploadSource = "single" | "folder";

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function relativePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function ChenyanRecordingUploader() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState<UploadSource>("single");
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState("");

  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function chooseFiles(nextFiles: FileList | null, nextSource: UploadSource) {
    setError("");
    setUploaded(0);
    setSource(nextSource);
    setFiles(nextFiles ? Array.from(nextFiles) : []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (files.length === 0) {
      setError("请先选择录音文件。");
      return;
    }
    if (files.length > MAX_BATCH_FILES) {
      setError(`一次最多上传 ${MAX_BATCH_FILES} 条录音。文件更多时，请分几次上传。`);
      return;
    }
    if (totalBytes > MAX_BATCH_BYTES) {
      setError("一次上传的录音总大小不能超过 1GB。文件更多时，请分几次上传。");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_AUDIO_UPLOAD_BYTES);
    if (oversized) {
      setError(`“${oversized.name}”超过 ${MAX_AUDIO_UPLOAD_MB}MB，请单独压缩或分段后再上传。`);
      return;
    }

    setIsUploading(true);
    setUploaded(0);

    try {
      const sessionResponse = await fetch("/api/chenyan/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, notes }),
      });
      const sessionPayload = (await sessionResponse.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!sessionResponse.ok || !sessionPayload.id) {
        throw new Error(sessionPayload.error || "创建通话卡片失败。");
      }

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.[^.]+$/, ""));
        formData.append("relativePath", relativePath(file));

        const recordingResponse = await fetch(
          `/api/chenyan/calls/${sessionPayload.id}/recordings`,
          {
            method: "POST",
            body: formData,
          },
        );
        const recordingPayload = (await recordingResponse.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!recordingResponse.ok) {
          throw new Error(`第 ${index + 1} 条“${file.name}”上传失败：${recordingPayload.error || "未知错误"}`);
        }
        setUploaded(index + 1);
      }

      router.push(`/chenyan/calls/${sessionPayload.id}`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败。");
    } finally {
      setIsUploading(false);
    }
  }

  const directoryInputProps: DirectoryInputProps = {
    name: "folder",
    type: "file",
    accept: "audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac",
    multiple: true,
    webkitdirectory: "",
    directory: "",
    onChange: (event) => chooseFiles(event.currentTarget.files, "folder"),
  };

  return (
    <form className="form-grid upload-flow" onSubmit={handleSubmit}>
      <label>
        本次通话标题
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="可留空，默认使用日期"
        />
      </label>
      <label>
        通话说明
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="记录通话对象、时间或主题"
        />
      </label>
      <label>
        通话笔记
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="本次通话的整体笔记，之后还能继续修改"
        />
      </label>

      <div className="upload-picker-grid">
        <label className="upload-picker">
          <span>上传单条或多条录音</span>
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.webm,.flac"
            multiple
            onChange={(event) => chooseFiles(event.currentTarget.files, "single")}
          />
        </label>
        <label className="upload-picker">
          <span>上传整个录音文件夹</span>
          <input {...directoryInputProps} />
        </label>
      </div>

      <div className="upload-status">
        <strong>{files.length > 0 ? `已选择 ${files.length} 条录音` : "还没有选择录音"}</strong>
        <span>
          {files.length > 0
            ? `${source === "folder" ? "文件夹" : "文件"} · 总大小 ${formatBytes(totalBytes)}`
            : `单条不超过 ${MAX_AUDIO_UPLOAD_MB}MB，一次不超过 ${MAX_BATCH_FILES} 条`}
        </span>
      </div>

      {files.length > 0 ? (
        <div className="selected-file-list">
          {files.slice(0, 8).map((file) => (
            <span key={`${relativePath(file)}-${file.size}`}>
              {relativePath(file)} · {formatBytes(file.size)}
            </span>
          ))}
          {files.length > 8 ? <span>还有 {files.length - 8} 条...</span> : null}
        </div>
      ) : null}

      {isUploading ? (
        <div className="upload-progress" aria-live="polite">
          <div>
            <span style={{ width: `${files.length ? (uploaded / files.length) * 100 : 0}%` }} />
          </div>
          <p>
            正在上传 {uploaded}/{files.length}。上传期间不要刷新页面。
          </p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button" type="submit" disabled={isUploading}>
        {isUploading ? "正在上传..." : "创建通话并上传录音"}
      </button>
    </form>
  );
}
