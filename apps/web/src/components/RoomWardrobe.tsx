import { useEffect, useState } from 'react';
import { type Appearance, type Participant } from '@cineverse/shared';
import { api } from '../api';

export default function RoomWardrobe({
  person,
  onRefresh,
  notify,
}: {
  person: Participant;
  onRefresh: () => void;
  notify: (message: string) => void;
}) {
  const [appearance, setAppearance] = useState(person.appearance);
  const [name, setName] = useState(person.name);
  const [owned, setOwned] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ itemId: string }[]>('/character/inventory')
      .then((items) => {
        if (active) {
          setOwned(items.map((item) => item.itemId));
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (active) notify(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function pick<K extends keyof Appearance>(key: K, value: Appearance[K]) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }
  return (
    <form
      className="cinema-settings"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await api('/character', {
            method: 'PUT',
            body: JSON.stringify({ name: name.trim(), appearance }),
          });
          onRefresh();
          notify('Đã lưu diện mạo vào tài khoản.');
        } catch (error) {
          notify((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="subtle">
        Đổi trang phục đang sở hữu, lưu vào tài khoản và cập nhật cho cả phòng.
      </p>
      <label>
        Tên nhân vật
        <input
          required
          minLength={2}
          maxLength={32}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Màu da
        <select
          value={appearance.skin}
          onChange={(event) => pick('skin', event.target.value as Appearance['skin'])}
        >
          <option value="porcelain">Sáng</option>
          <option value="sand">Cát</option>
          <option value="amber">Hổ phách</option>
          <option value="cocoa">Ca cao</option>
        </select>
      </label>
      <label>
        Kiểu tóc
        <select
          value={appearance.hair}
          onChange={(event) => pick('hair', event.target.value as Appearance['hair'])}
        >
          <option value="crop">Tóc ngắn</option>
          <option value="bob">Tóc bob</option>
          <option value="bun">Búi tóc</option>
        </select>
      </label>
      <label>
        Màu tóc
        <select
          value={appearance.hairColor}
          onChange={(event) => pick('hairColor', event.target.value as Appearance['hairColor'])}
        >
          <option value="espresso">Đen nâu</option>
          <option value="chestnut">Nâu hạt dẻ</option>
          <option value="silver">Bạc</option>
        </select>
      </label>
      <label>
        Trang phục
        <select
          value={appearance.outfit}
          onChange={(event) => pick('outfit', event.target.value as Appearance['outfit'])}
        >
          {(
            [
              ['midnight', 'Đêm xanh'],
              ['rose', 'Hồng khói'],
              ['sage', 'Xanh lá'],
              ['cream', 'Kem ấm'],
            ] as const
          ).map(([value, label]) => (
            <option key={value} value={value} disabled={!owned.includes(`outfit-${value}`)}>
              {label}
              {!owned.includes(`outfit-${value}`) ? ' · chưa sở hữu' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Phụ kiện
        <select
          value={appearance.accessory}
          onChange={(event) => pick('accessory', event.target.value as Appearance['accessory'])}
        >
          <option value="none">Không đeo kính</option>
          <option value="glasses" disabled={!owned.includes('accessory-glasses')}>
            Kính tròn
          </option>
        </select>
      </label>
      <button className="button primary" disabled={busy || !loaded}>
        {busy ? 'Đang lưu…' : 'Lưu diện mạo'}
      </button>
    </form>
  );
}
