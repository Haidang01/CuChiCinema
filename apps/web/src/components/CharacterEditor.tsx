import { lazy, Suspense } from 'react';
import { RotateCcw, Save, Shuffle, Sparkles } from 'lucide-react';
import type { Appearance, User } from '@cineverse/shared';
import { SceneBoundary } from './SceneBoundary';
const Studio = lazy(() => import('../scene/Studio'));
const skins = { porcelain: '#f2cfb9', sand: '#dca77d', amber: '#b77d52', cocoa: '#764c39' };
const colors = { espresso: '#282130', chestnut: '#774a35', silver: '#bac0d3' };
const outfits = {
  midnight: { color: '#6378a5', name: 'Đêm xanh' },
  rose: { color: '#bc7785', name: 'Hồng khói' },
  sage: { color: '#739f91', name: 'Xanh lá' },
  cream: { color: '#e7d8b9', name: 'Kem ấm' },
};

export default function CharacterEditor({
  user,
  appearance,
  name,
  onChange,
  onName,
  onSave,
  onReset,
  busy,
  dirty,
}: {
  user: User | null;
  appearance: Appearance;
  name: string;
  onChange: (a: Appearance) => void;
  onName: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  busy: boolean;
  dirty: boolean;
}) {
  function pick<K extends keyof Appearance>(key: K, value: Appearance[K]) {
    onChange({ ...appearance, [key]: value });
  }
  function randomize() {
    const sample = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;
    onChange({
      version: 1,
      skin: sample(Object.keys(skins) as Appearance['skin'][]),
      hair: sample(['crop', 'bob', 'bun']),
      hairColor: sample(Object.keys(colors) as Appearance['hairColor'][]),
      outfit: sample(Object.keys(outfits) as Appearance['outfit'][]),
      accessory: sample(['none', 'glasses']),
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">Phòng thay đồ</span>
          <h1>Một phiên bản rất bạn.</h1>
          <p>Chọn diện mạo, mang theo cá tính. Ghế đẹp đang chờ.</p>
        </div>
        <span className="pill">
          <span className="status-dot" />
          {user?.character ? 'Nhân vật của bạn' : 'Nhân vật mới'}
        </span>
      </div>
      <div className="editor-layout">
        <section className="character-stage" aria-label="Xem trước nhân vật">
          <div className="stage-top">
            <span>
              <Sparkles size={15} /> Studio nhân vật
            </span>
            <span>3D preview</span>
          </div>
          <SceneBoundary>
            <Suspense fallback={<div className="scene-fallback">Đang mở phòng thay đồ…</div>}>
              <Studio appearance={appearance} />
            </Suspense>
          </SceneBoundary>
          <div className="stage-bottom">
            <div>
              <span className="stage-name">{name || 'Nhân vật của bạn'}</span>
              <span>Kéo nhân vật để xoay góc nhìn</span>
            </div>
            <button
              className="round-button"
              onClick={randomize}
              aria-label="Tạo ngoại hình ngẫu nhiên"
              title="Ngẫu nhiên"
            >
              <Shuffle size={19} />
            </button>
          </div>
          <div className="ticket-stub">
            <span>CineVerse member</span>
            <span>Vé đến thế giới của bạn</span>
            <div className="barcode" aria-hidden="true" />
          </div>
        </section>
        <section className="editor-panel" aria-label="Chỉnh sửa nhân vật">
          <div className="panel-heading">
            <h2>Diện mạo của bạn</h2>
            <button
              className="icon-button"
              onClick={onReset}
              aria-label="Khôi phục ngoại hình đã lưu"
              title="Khôi phục"
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <label className="name-label">
            Tên nhân vật
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Bạn muốn được gọi là gì?"
              minLength={2}
              maxLength={32}
            />
          </label>
          <fieldset>
            <legend>Màu da</legend>
            <div className="swatches">
              {Object.entries(skins).map(([key, color], i) => (
                <button
                  key={key}
                  className={`swatch ${appearance.skin === key ? 'selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => pick('skin', key as Appearance['skin'])}
                  aria-pressed={appearance.skin === key}
                  aria-label={`Màu da ${i + 1}`}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Kiểu tóc</legend>
            <div className="segmented">
              {(
                [
                  ['crop', 'Tóc ngắn'],
                  ['bob', 'Tóc bob'],
                  ['bun', 'Búi tóc'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={appearance.hair === key ? 'selected' : ''}
                  aria-pressed={appearance.hair === key}
                  onClick={() => pick('hair', key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="swatches small">
              {Object.entries(colors).map(([key, color], i) => (
                <button
                  key={key}
                  className={`swatch ${appearance.hairColor === key ? 'selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => pick('hairColor', key as Appearance['hairColor'])}
                  aria-pressed={appearance.hairColor === key}
                  aria-label={`Màu tóc ${i + 1}`}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              Trang phục <span>Bộ sưu tập đầu tiên</span>
            </legend>
            <div className="outfits">
              {Object.entries(outfits).map(([key, item]) => (
                <button
                  key={key}
                  className={`outfit ${appearance.outfit === key ? 'selected' : ''}`}
                  aria-pressed={appearance.outfit === key}
                  onClick={() => pick('outfit', key as Appearance['outfit'])}
                >
                  <span className="shirt" style={{ background: item.color }} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Phụ kiện</legend>
            <div className="segmented">
              <button
                className={appearance.accessory === 'none' ? 'selected' : ''}
                onClick={() => pick('accessory', 'none')}
                aria-pressed={appearance.accessory === 'none'}
              >
                Tự nhiên
              </button>
              <button
                className={appearance.accessory === 'glasses' ? 'selected' : ''}
                onClick={() => pick('accessory', 'glasses')}
                aria-pressed={appearance.accessory === 'glasses'}
              >
                Kính tròn
              </button>
            </div>
          </fieldset>
          <div className="save-area">
            <button
              className="button primary full"
              disabled={busy || (!!user?.character && !dirty)}
              onClick={onSave}
            >
              <Save size={17} />
              {busy ? 'Đang lưu…' : user?.character ? 'Lưu thay đổi' : 'Lưu nhân vật của tôi'}
            </button>
            <p>
              {dirty
                ? 'Bạn có thay đổi chưa lưu.'
                : user?.character
                  ? 'Diện mạo đã được lưu vào tài khoản.'
                  : 'Đăng nhập để giữ lại nhân vật cho lần sau.'}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
