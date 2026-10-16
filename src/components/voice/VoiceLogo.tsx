import React from 'react';

interface VoiceLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

/**
 * Modern AI Voice Conversation Logo for RYXIA Audio
 * Represents soundwaves, voice resonance, and neural audio stream.
 */
export const VoiceLogo: React.FC<VoiceLogoProps> = ({
  className = '',
  size = 'md',
  animated = false,
}) => {
  const sizeClasses = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  }[size];

  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Dynamic 5-bar acoustic voice waveform with rounded caps */}
        <rect
          x="2"
          y="8"
          width="2.5"
          height="8"
          rx="1.25"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDuration: '1.2s' }}
        />
        <rect
          x="6.5"
          y="4.5"
          width="2.5"
          height="15"
          rx="1.25"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDuration: '0.9s', animationDelay: '0.15s' }}
        />
        <rect
          x="11"
          y="2"
          width="2.5"
          height="20"
          rx="1.25"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDuration: '0.7s', animationDelay: '0.3s' }}
        />
        <rect
          x="15.5"
          y="4.5"
          width="2.5"
          height="15"
          rx="1.25"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDuration: '0.9s', animationDelay: '0.15s' }}
        />
        <rect
          x="20"
          y="8"
          width="2.5"
          height="8"
          rx="1.25"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDuration: '1.2s' }}
        />
      </svg>
    </span>
  );
};
