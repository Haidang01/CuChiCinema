import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Film, Upload, RefreshCw } from 'lucide-react';
import type { MediaAsset } from '@cineverse/shared';
import { api } from '../api';

export default function MediaLibrary({
  onSelect,
  notify,
  selectedId,
}: {
  onSelect: (id: string) => void;
  notify: (message: string) => void;
  selectedId: string | null;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [limit, setLimit] = useState(4 * 1024 ** 3);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const load = async () => {
    setLoading(true);
    try {
      const result = await api<{ assets: MediaAsset[]; maxBytes: number }>('/media');
      if (mounted.current) {
        setAssets(result.assets);
        setLimit(result.maxBytes);
      }
    } catch (error) {
      if (mounted.current) notify((error as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > limit) {
      notify(`File vượt giới hạn ${(limit / 1024 ** 3).toFixed(1)} GB.`);
      return;
    }
    const mime = file.name.toLowerCase().endsWith('.webm')
      ? 'video/webm'
      : file.name.toLowerCase().endsWith('.mp4')
        ? 'video/mp4'
        : '';
    if (!mime) {
      notify('Chọn file MP4 hoặc WebM.');
      return;
    }
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    setProgress(0);
    xhr.open('POST', `/api/media?title=${encodeURIComponent(file.name.slice(0, 120))}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('X-Cineverse-Client', 'web');
    xhr.upload.onprogress = (e) => {
      if (mounted.current && e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (!mounted.current) return;
      setProgress(null);
      request.current = null;
      let result: MediaAsset & { error?: string };
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        notify('Không tải được phim. Kiểm tra kết nối máy chủ.');
        return;
      }
      if (xhr.status !== 201) {
        notify(result.error ?? 'Không tải được phim.');
        return;
      }
      setAssets((previous) => [result, ...previous]);
      notify('Đã tải phim vào thư viện. Chọn phim để bắt đầu.');
    };
    xhr.onerror = () => {
      if (mounted.current) {
        setProgress(null);
        notify('Tải phim bị gián đoạn. Hãy thử lại.');
      }
    };
    xhr.onabort = () => {
      if (mounted.current) {
        setProgress(null);
        notify('Đã hủy tải phim.');
      }
    };
    xhr.send(file);
  }
  return (
    <section className="media-library" aria-label="Thư viện phim của bạn">
      <div className="media-library-heading">
        <h3>
          <Film size={17} /> Thư viện phim của bạn
        </h3>
        <button
          className="icon-button"
          aria-label="Tải lại thư viện phim"
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <p className="subtle">
        MP4/WebM, tối đa {(limit / 1024 ** 3).toFixed(1)} GB mỗi file. Chỉ tải nội dung bạn có quyền
        sử dụng.
      </p>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="video/mp4,video/webm,.mp4,.webm"
        aria-label="Chọn file phim tải lên"
        onChange={upload}
      />
      {progress === null ? (
        <button className="button secondary" onClick={() => input.current?.click()}>
          <Upload size={16} /> Tải phim lên
        </button>
      ) : (
        <div className="upload-progress" role="status">
          <progress max={100} value={progress} />
          <span>{progress === 100 ? 'Đang lưu phim…' : `Đang tải ${progress}%`}</span>
          <button className="text-button" onClick={() => request.current?.abort()}>
            Hủy tải
          </button>
        </div>
      )}
      {loading ? (
        <p className="subtle">Đang tải thư viện…</p>
      ) : assets.length ? (
        <ul className="media-list">
          {assets.map((asset) => (
            <li key={asset.id}>
              <div>
                <strong>{asset.title}</strong>
                <small>{(asset.bytes / 1024 ** 2).toFixed(1)} MB</small>
              </div>
              <button
                className="button secondary"
                disabled={asset.id === selectedId}
                onClick={() => onSelect(asset.id)}
              >
                {asset.id === selectedId ? 'Đang chọn' : 'Chiếu phim'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">Chưa có phim. Tải một file để chuẩn bị buổi chiếu.</p>
      )}
    </section>
  );
}
