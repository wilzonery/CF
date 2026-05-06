import { useRef, useState, useEffect } from 'react';
import { X, Scissors } from 'lucide-react';
import { BatchItem } from '../hooks/useFFmpeg';
import { Button } from '@/components/ui/button';

interface Props {
  item: BatchItem;
  onApply: (startTime: string, endTime: string) => void;
  onClose: () => void;
}

function secondsToHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function hmsToSeconds(hms: string): number {
  if (!hms) return 0;
  const parts = hms.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function VideoPreviewPanel({ item, onApply, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(() => hmsToSeconds(item.startTime));
  const [endSec, setEndSec] = useState(() => item.endTime ? hmsToSeconds(item.endTime) : 0);

  const isVideo = item.file.type.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov|gif)$/i.test(item.file.name);

  useEffect(() => {
    const url = URL.createObjectURL(item.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file]);

  const seekTo = (sec: number) => {
    if (videoRef.current) videoRef.current.currentTime = sec;
    if (audioRef.current) audioRef.current.currentTime = sec;
  };

  const handleMarkStart = () => setStartSec(Math.floor(currentTime));
  const handleMarkEnd = () => setEndSec(Math.floor(currentTime));

  const handleApply = () => {
    const start = secondsToHMS(startSec);
    const end = endSec > 0 && endSec > startSec ? secondsToHMS(endSec) : '';
    onApply(start, end);
    onClose();
  };

  const startPct = duration > 0 ? (startSec / duration) * 100 : 0;
  const endPct = duration > 0 ? ((endSec > 0 ? endSec : duration) / duration) * 100 : 100;
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimmedDuration = endSec > startSec ? endSec - startSec : duration > 0 ? duration - startSec : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0">
            <Scissors className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="flex-shrink-0">Preview &amp; Trim</span>
            <span className="text-muted-foreground font-normal truncate">{item.file.name}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded flex-shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player */}
        <div className="bg-black flex items-center justify-center min-h-[120px]">
          {isVideo ? (
            <video
              ref={videoRef}
              src={src}
              className="max-h-[320px] w-full object-contain"
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
              controls
              playsInline
            />
          ) : (
            <div className="p-8 w-full">
              <div className="text-center text-muted-foreground text-sm mb-4">Audio File</div>
              <audio
                ref={audioRef}
                src={src}
                className="w-full"
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                controls
              />
            </div>
          )}
        </div>

        {/* Trim controls */}
        <div className="px-5 py-4 space-y-4">
          {/* Timeline scrubber */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0:00</span>
              {duration > 0 && (
                <span className="text-primary text-xs font-medium">
                  {trimmedDuration > 0 && endSec > startSec
                    ? `Clip: ${secondsToHMS(trimmedDuration)}`
                    : `Duration: ${secondsToHMS(duration)}`}
                </span>
              )}
              <span>{duration > 0 ? secondsToHMS(duration) : '--:--:--'}</span>
            </div>

            <div
              className="relative h-7 cursor-pointer select-none"
              onClick={handleTimelineClick}
            >
              {/* Background track */}
              <div className="absolute top-2.5 bottom-2.5 inset-x-0 bg-secondary rounded-full" />
              {/* Trim selection */}
              {duration > 0 && (
                <div
                  className="absolute top-2.5 bottom-2.5 bg-primary/35 rounded-full"
                  style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
                />
              )}
              {/* Start marker */}
              {duration > 0 && (
                <div
                  className="absolute top-0.5 bottom-0.5 w-[3px] bg-primary rounded-full"
                  style={{ left: `calc(${startPct}% - 1.5px)` }}
                />
              )}
              {/* End marker */}
              {duration > 0 && endSec > 0 && (
                <div
                  className="absolute top-0.5 bottom-0.5 w-[3px] bg-primary rounded-full"
                  style={{ left: `calc(${endPct}% - 1.5px)` }}
                />
              )}
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 rounded-full pointer-events-none shadow"
                style={{ left: `${currentPct}%` }}
              />
            </div>

            <p className="text-[10px] text-muted-foreground">Click the bar to seek · Play the file and click "Mark here" to set trim points</p>
          </div>

          {/* Start / End point controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Start point</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-foreground bg-background border border-border rounded px-2 py-1">
                  {secondsToHMS(startSec)}
                </span>
                <button
                  onClick={handleMarkStart}
                  className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
                >
                  Mark here
                </button>
              </div>
              {duration > 0 && (
                <button
                  onClick={() => seekTo(startSec)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Jump to start →
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">End point</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-foreground bg-background border border-border rounded px-2 py-1">
                  {endSec > 0 ? secondsToHMS(endSec) : 'end of file'}
                </span>
                <button
                  onClick={handleMarkEnd}
                  className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
                >
                  Mark here
                </button>
              </div>
              {endSec > 0 && duration > 0 && (
                <button
                  onClick={() => seekTo(endSec)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Jump to end →
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-1 border-t border-border">
            {endSec > 0 && (
              <button
                onClick={() => { setStartSec(0); setEndSec(0); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear trim
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleApply}
              >
                <Scissors className="w-3 h-3 mr-1.5" />
                {endSec > startSec ? 'Apply Trim' : 'Apply (no trim)'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
