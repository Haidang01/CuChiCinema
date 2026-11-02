import type { AvatarAction } from '@cineverse/shared';

export function dancePose(action: AvatarAction, t: number, role = 0) {
  const beat = Math.sin(t * 7),
    alternate = Math.sin(t * 7 + Math.PI);
  const pose = {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    armsX: [-0.6, -0.6],
    armsZ: [-0.4, 0.4],
    elbows: [-0.4, -0.4],
    legs: [beat * 0.2, alternate * 0.2],
    knees: [0.1, 0.1],
  };
  if (action === 'dance_hiphop') {
    pose.x = Math.sin(t * 3.5) * 0.09;
    pose.y = -Math.abs(beat) * 0.07;
    pose.rx = 0.1;
    pose.ry = Math.sin(t * 3.5) * 0.2;
    pose.armsX = [-0.6 + beat * 0.6, -0.6 - beat * 0.6];
    pose.armsZ = [-0.8, 0.8];
    pose.elbows = [-1.1, -1.1];
    pose.knees = [0.35 + Math.abs(beat) * 0.25, 0.35 + Math.abs(alternate) * 0.25];
  } else if (action === 'dance_shuffle') {
    pose.z = Math.sin(t * 10) * 0.05;
    pose.y = Math.abs(Math.sin(t * 10)) * 0.035;
    pose.legs = [Math.sin(t * 10) * 0.65, -Math.sin(t * 10) * 0.65];
    pose.armsX = [-pose.legs[0]! * 0.65, -pose.legs[1]! * 0.65];
    pose.knees = [Math.max(0, Math.sin(t * 10)) * 0.9, Math.max(0, -Math.sin(t * 10)) * 0.9];
  } else if (action === 'dance_salsa' || action === 'duet_salsa') {
    const step = Math.sin(t * 6 + role * Math.PI);
    pose.x = action === 'dance_salsa' ? Math.sin(t * 3) * 0.08 : 0;
    pose.rz = step * 0.08;
    pose.ry = Math.sin(t * 3) * 0.12;
    pose.armsX = [-0.95, -0.65];
    pose.armsZ = [-0.5, 0.6];
    pose.elbows = [-0.85, -0.65];
    pose.legs = [step * 0.3, -step * 0.3];
    pose.knees = [0.15 + Math.max(0, step) * 0.25, 0.15 + Math.max(0, -step) * 0.25];
  } else if (action === 'dance_disco') {
    pose.ry = Math.sin(t * 3.5) * 0.3;
    pose.y = Math.abs(beat) * 0.045;
    pose.armsX = [-0.25, -0.1];
    pose.armsZ = [-0.5, 2.55 + Math.sin(t * 3.5) * 0.2];
    pose.elbows = [-0.7, -0.15];
  } else if (action === 'dance_ballet') {
    pose.ry = t * 0.9;
    pose.y = 0.06 + Math.abs(Math.sin(t * 3)) * 0.04;
    pose.armsZ = [-1.5, 1.5];
    pose.armsX = [-0.35, -0.35];
    pose.elbows = [-0.4, -0.4];
    pose.legs = [0, 0.55 + Math.sin(t * 3) * 0.12];
    pose.knees = [0.03, 0.45];
  } else if (action === 'duet_waltz') {
    pose.y = Math.sin(t * 5) * 0.025;
    pose.armsX = [-1, -1];
    pose.armsZ = role === 0 ? [-0.35, 0.8] : [-0.8, 0.35];
    pose.elbows = [-0.8, -0.8];
    pose.legs = [Math.sin(t * 5 + role * Math.PI) * 0.2, -Math.sin(t * 5 + role * Math.PI) * 0.2];
  }
  return pose;
}
