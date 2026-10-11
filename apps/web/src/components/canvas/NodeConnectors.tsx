'use client';

import { SIDES, type Side } from './connections';

interface NodeConnectorsProps {
  width: number;
  height: number;
  color: string;
  visible: boolean;
  onStartConnection: (e: React.MouseEvent, side: Side) => void;
  onHoverChange: (hovered: boolean) => void;
}

function dotPosition(side: Side, width: number, height: number) {
  switch (side) {
    case 'top':
      return { left: width / 2, top: 0 };
    case 'right':
      return { left: width, top: height / 2 };
    case 'bottom':
      return { left: width / 2, top: height };
    case 'left':
      return { left: 0, top: height / 2 };
  }
}

/** A dot on each side of a node; drag from any of them to draw a wire. */
export default function NodeConnectors({
  width,
  height,
  color,
  visible,
  onStartConnection,
  onHoverChange,
}: NodeConnectorsProps) {
  return (
    <>
      {SIDES.map(side => (
        <div
          key={side}
          title="Drag to connect"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
          onMouseDown={e => {
            e.stopPropagation();
            onStartConnection(e, side);
          }}
          className="nodeConnector"
          style={{
            position: 'absolute',
            ...dotPosition(side, width, height),
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'var(--panel-bg-strong)',
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 3px var(--app-bg), 0 0 8px ${color}55`,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.12s, transform 0.12s',
            cursor: 'crosshair',
            pointerEvents: 'auto',
            zIndex: 25,
          }}
        />
      ))}
    </>
  );
}
