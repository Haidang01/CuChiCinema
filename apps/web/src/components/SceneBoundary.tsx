import { Component, type ReactNode } from 'react';
export class SceneBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? (
          <div className="scene-fallback">
            Thiết bị chưa hiển thị được 3D. Bạn vẫn có thể chỉnh nhân vật và xem phim ở chế độ 2D.
          </div>
        ))
      : this.props.children;
  }
}
