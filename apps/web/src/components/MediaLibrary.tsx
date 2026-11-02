import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Film, Upload, RefreshCw } from 'lucide-react';
import type { MediaAsset } from '@cineverse/shared';
import { api } from '../api';

export default function MediaLibrary({
  onSelect,
  notify,
  selectedId,
  imagesOnly = false,
}: {
  onSelect: (id: string) => void;
  notify: (message: string) => void;
  selectedId: string | null;
  imagesOnly?: boolean;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [limit, setLimit] = useState(4 * 1024 ** 3);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const visibleAssets = assets.filter((asset) =>
    asset.mimeType.startsWith(imagesOnly ? 'image/' : 'video/'),
  );
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
    if (imagesOnly && file.size > Math.min(limit, 10 * 1024 ** 2)) {
      notify('Ảnh vượt giới hạn 10 MB.');
      return;
    }
    if (file.size > limit) {
      notify(`File vượt giới hạn ${(limit / 1024 ** 3).toFixed(1)} GB.`);
      return;
    }
    const imageMime = /\.jpe?g$/i.test(file.name)
      ? 'image/jpeg'
      : /\.png$/i.test(file.name)
        ? 'image/png'
        : /\.webp$/i.test(file.name)
          ? 'image/webp'
          : '';
    const mime = imagesOnly
      ? imageMime
      : file.name.toLowerCase().endsWith('.webm')
        ? 'video/webm'
        : file.name.toLowerCase().endsWith('.mp4')
          ? 'video/mp4'
          : '';
    if (!mime) {
      if (imagesOnly) {
        notify('Chọn ảnh JPG/PNG/WebP. Ảnh HEIC cần xuất sang JPG trước.');
        return;
      }
      notify(
        'Hiện hỗ trợ MP4/WebM. Video iPhone dạng MOV cần chuyển sang MP4 (H.264/AAC) trước khi tải.',
      );
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
      notify('Đã tải lên thư viện. Chọn Thêm vào hàng chờ để cùng xem.');
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
    <section
      className="media-library"
      aria-label={imagesOnly ? 'Thư viện ảnh của bạn' : 'Thư viện phim của bạn'}
    >
      <div className="media-library-heading">
        <h3>
          <Film size={17} /> {imagesOnly ? 'Ảnh của bạn' : 'Thư viện phim của bạn'}
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
      {imagesOnly ? (
        <p className="subtle">JPG/PNG/WebP, tối đa 10 MB. HEIC cần xuất sang JPG.</p>
      ) : (
        <>
          <p className="subtle">
            MP4/WebM, tối đa {(limit / 1024 ** 3).toFixed(1)} GB mỗi file. Chỉ tải nội dung bạn có
            quyền sử dụng.
          </p>
          <p className="subtle">
            Video iPhone dạng MOV cần chuyển sang MP4 (H.264/AAC) trước khi tải.
          </p>
        </>
      )}
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={
          imagesOnly
            ? 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
            : 'video/mp4,video/webm,.mp4,.webm'
        }
        aria-label={imagesOnly ? 'Chọn ảnh tải lên' : 'Chọn file phim tải lên'}
        onChange={upload}
      />
      {progress === null ? (
        <button className="button secondary" onClick={() => input.current?.click()}>
          <Upload size={16} /> {imagesOnly ? 'Tải ảnh lên' : 'Tải phim lên'}
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
      ) : visibleAssets.length ? (
        <ul className="media-list">
          {visibleAssets.map((asset) => (
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
                {asset.id === selectedId ? 'Đang chọn' : 'Thêm vào hàng chờ'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">
          {imagesOnly
            ? 'Chưa có ảnh. Chọn Tải ảnh lên để chia sẻ cùng phòng.'
            : 'Chưa có phim. Tải một file để chuẩn bị buổi chiếu.'}
        </p>
      )}
    </section>
  );
}
