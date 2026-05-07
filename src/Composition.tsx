import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0b1215',
      }}
    >
      <h1
        style={{
          fontSize: 80,
          fontWeight: 'bold',
          color: 'white',
          opacity,
        }}
      >
        Hello, Remotion!
      </h1>
    </AbsoluteFill>
  );
};
