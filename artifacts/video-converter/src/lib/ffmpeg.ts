import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg;
  
  if (!loadPromise) {
    loadPromise = (async () => {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      const instance = new FFmpeg();
      await instance.load({
        coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
      });
      ffmpeg = instance;
    })();
  }
  
  await loadPromise;
  return ffmpeg!;
};

export const MimeTypes: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  gif: 'image/gif'
};

export const getCommandOptions = (
  format: string, 
  resolution: string, 
  quality: string, 
  audioBitrate: string
): string[] => {
  const isVideo = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif'].includes(format);
  const options: string[] = [];
  
  if (isVideo && format !== 'gif') {
    if (format === 'mp4') {
      options.push('-c:v', 'libx264', '-crf', quality, '-c:a', 'aac');
    } else if (format === 'webm') {
      options.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus');
    } else {
      options.push('-c:v', 'libx264', '-crf', quality);
    }
    
    if (resolution !== 'original') {
      options.push('-vf', `scale=-2:${resolution}`);
    }
  } else if (format === 'gif') {
    let scale = '-1';
    if (resolution !== 'original') {
      scale = resolution;
    } else {
      scale = '480'; // sensible default for gif
    }
    options.push('-vf', `fps=10,scale=${scale}:-1:flags=lanczos`, '-f', 'gif');
  } else {
    // Audio
    options.push('-vn'); // no video
    if (format === 'mp3') {
      options.push('-ar', '44100', '-ac', '2', '-ab', audioBitrate);
    }
  }
  
  return options;
};
