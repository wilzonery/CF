import { useState, useCallback, useRef } from 'react';
import { getFFmpeg, getCommandOptions, MimeTypes } from '../lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export type EngineStatus = 'idle' | 'loading_engine' | 'ready' | 'error';
export type BatchItemStatus = 'pending' | 'converting' | 'done' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  format: string;
  status: BatchItemStatus;
  progress: number;
  logs: string[];
  downloadUrl?: string;
  outputName?: string;
  originalSize: number;
  outputSize?: number;
  error?: string;
  trimEnabled: boolean;
  startTime: string;
  endTime: string;
}

export function useFFmpeg() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  const initEngine = useCallback(async () => {
    if (engineStatus === 'ready') return;
    setEngineStatus('loading_engine');
    try {
      await getFFmpeg();
      setEngineStatus('ready');
    } catch {
      setEngineStatus('error');
    }
  }, [engineStatus]);

  const addFiles = useCallback((files: File[], defaultFormat: string) => {
    const newItems: BatchItem[] = files.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      format: defaultFormat,
      status: 'pending',
      progress: 0,
      logs: [],
      originalSize: file.size,
      trimEnabled: false,
      startTime: '00:00:00',
      endTime: '',
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateItemFormat = useCallback((id: string, format: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, format } : item));
  }, []);

  const updateItemTrim = useCallback((id: string, trimEnabled: boolean, startTime: string, endTime: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, trimEnabled, startTime, endTime } : item));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status === 'pending' || item.status === 'converting'));
  }, []);

  const clearAll = useCallback(() => {
    setQueue([]);
  }, []);

  const convertAll = useCallback(async (
    options: { resolution: string; quality: string; audioBitrate: string }
  ) => {
    if (isRunning) return;
    abortRef.current = false;
    setIsRunning(true);

    const ffmpeg = await getFFmpeg();

    const processNext = async (remainingIds: string[], currentQueue: BatchItem[]) => {
      if (remainingIds.length === 0 || abortRef.current) {
        setIsRunning(false);
        return;
      }

      const id = remainingIds[0];
      const item = currentQueue.find(i => i.id === id);
      if (!item) {
        await processNext(remainingIds.slice(1), currentQueue);
        return;
      }

      const { format, trimEnabled, startTime, endTime } = item;

      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'converting', progress: 0, logs: [] } : i));

      try {
        const inputExt = item.file.name.split('.').pop() || 'mp4';
        const inputName = `input_${id}.${inputExt}`;
        const outputName = `output_${id}.${format}`;
        const baseName = item.file.name.replace(/\.[^.]+$/, '');
        const downloadName = `${baseName}.${format}`;

        ffmpeg.off('progress', () => {});
        ffmpeg.off('log', () => {});

        ffmpeg.on('progress', ({ progress }) => {
          setQueue(prev => prev.map(i =>
            i.id === id ? { ...i, progress: Math.max(0, Math.min(100, Math.round(progress * 100))) } : i
          ));
        });

        ffmpeg.on('log', ({ message }) => {
          setQueue(prev => prev.map(i =>
            i.id === id ? { ...i, logs: [...i.logs.slice(-30), message] } : i
          ));
        });

        await ffmpeg.writeFile(inputName, await fetchFile(item.file));

        // Build args: trim flags go after -i for frame accuracy
        const trimArgs: string[] = [];
        if (trimEnabled) {
          if (startTime && startTime !== '00:00:00') trimArgs.push('-ss', startTime);
          if (endTime) trimArgs.push('-to', endTime);
        }

        const cmdOptions = getCommandOptions(format, options.resolution, options.quality, options.audioBitrate);
        const args = ['-i', inputName, ...trimArgs, ...cmdOptions, outputName];

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile(outputName);
        const mimeType = MimeTypes[format] || 'application/octet-stream';
        const blob = new Blob([(data as Uint8Array).buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        setQueue(prev => prev.map(i =>
          i.id === id ? { ...i, status: 'done', progress: 100, downloadUrl: url, outputName: downloadName, outputSize: blob.size } : i
        ));
      } catch (err: any) {
        setQueue(prev => prev.map(i =>
          i.id === id ? { ...i, status: 'error', error: err?.message || 'Unknown error' } : i
        ));
      }

      setQueue(prev => {
        setTimeout(() => processNext(remainingIds.slice(1), prev), 0);
        return prev;
      });
    };

    setQueue(prev => {
      const pending = prev.filter(i => i.status === 'pending');
      setTimeout(() => processNext(pending.map(i => i.id), prev), 0);
      return prev;
    });
  }, [isRunning]);

  return {
    engineStatus,
    queue,
    isRunning,
    initEngine,
    addFiles,
    removeFile,
    updateItemFormat,
    updateItemTrim,
    clearCompleted,
    clearAll,
    convertAll,
  };
}
