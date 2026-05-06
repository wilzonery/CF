import { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { VideoPreviewPanel } from '../components/VideoPreviewPanel';
import {
  UploadCloud, FileVideo, Download, Settings, Loader2,
  CheckCircle2, AlertCircle, X, Play, Trash2, ListVideo, FolderDown, Scissors, Eye
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const FORMATS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'aac', 'ogg', 'gif'];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function Converter() {
  const { engineStatus, queue, isRunning, initEngine, addFiles, removeFile, updateItemFormat, updateItemTrim, clearCompleted, clearAll, convertAll } = useFFmpeg();

  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('original');
  const [quality, setQuality] = useState('23');
  const [audioBitrate, setAudioBitrate] = useState('192k');
  const [isDragging, setIsDragging] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initEngine();
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length > 0) addFiles(arr, format);
  }, [addFiles, format]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    e.target.value = '';
  };

  const [zipping, setZipping] = useState(false);

  const downloadAllAsZip = useCallback(async () => {
    const done = queue.filter(i => i.status === 'done' && i.downloadUrl && i.outputName);
    if (done.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      await Promise.all(done.map(async item => {
        const res = await fetch(item.downloadUrl!);
        const blob = await res.blob();
        zip.file(item.outputName!, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'convertflow_files.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }, [queue]);

  const isVideoFormat = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif'].includes(format);
  const pendingCount = queue.filter(i => i.status === 'pending').length;
  const doneCount = queue.filter(i => i.status === 'done').length;
  const hasCompleted = doneCount > 0 || queue.some(i => i.status === 'error');

  const handleConvertAll = () => {
    convertAll({ resolution, quality, audioBitrate });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 font-sans">
      <div className="max-w-4xl w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">ConvertFlow</h1>
          <p className="text-muted-foreground text-sm">Fast, private, local file conversion entirely in your browser.</p>
        </div>

        {/* Engine Loading */}
        {engineStatus === 'loading_engine' && (
          <div className="flex items-center justify-center space-x-2 text-sm text-primary bg-primary/10 p-3 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading FFmpeg engine...</span>
          </div>
        )}
        {engineStatus === 'error' && (
          <div className="flex items-center justify-center space-x-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load FFmpeg. Please refresh the page.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left: Drop + Queue */}
          <div className="md:col-span-2 space-y-5">

            {/* Dropzone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px]
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-card'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="video/*,audio/*"
                multiple
              />
              <div className="space-y-2 flex flex-col items-center text-muted-foreground">
                <UploadCloud className="w-8 h-8 mb-1" />
                <p className="text-sm font-medium">
                  {queue.length > 0 ? 'Drop more files to add to queue' : 'Drag & drop files here'}
                </p>
                <p className="text-xs">or click to browse — multiple files supported</p>
              </div>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ListVideo className="w-4 h-4" />
                    <span>Queue</span>
                    <span className="text-muted-foreground font-normal">({queue.length} file{queue.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex gap-2">
                    {doneCount > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                        onClick={downloadAllAsZip}
                        disabled={zipping}
                      >
                        {zipping ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <FolderDown className="w-3 h-3 mr-1" />
                        )}
                        Download All (.zip)
                      </Button>
                    )}
                    {hasCompleted && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearCompleted}>
                        Clear done
                      </Button>
                    )}
                    {!isRunning && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={clearAll}>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                  {queue.map(item => (
                    <div key={item.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <div className="flex-shrink-0">
                          {item.status === 'pending' && <FileVideo className="w-5 h-5 text-muted-foreground" />}
                          {item.status === 'converting' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                          {item.status === 'done' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                          {item.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" title={item.file.name}>{item.file.name}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap items-center mt-0.5">
                            <span>{formatBytes(item.originalSize)}</span>
                            {item.outputSize && (
                              <>
                                <span>→</span>
                                <span>{formatBytes(item.outputSize)}</span>
                              </>
                            )}
                            {item.status === 'error' && item.error && (
                              <span className="text-destructive truncate">{item.error}</span>
                            )}
                          </div>
                          {/* Per-file format selector */}
                          {item.status === 'pending' && (
                            <>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {FORMATS.map(f => (
                                  <button
                                    key={f}
                                    onClick={() => updateItemFormat(item.id, f)}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors
                                      ${item.format === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}
                                    `}
                                  >
                                    {f.toUpperCase()}
                                  </button>
                                ))}
                              </div>

                              {/* Trim toggle */}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setPreviewItemId(item.id)}
                                  className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                  Preview &amp; Trim
                                </button>
                                {item.trimEnabled && (
                                  <button
                                    onClick={() => updateItemTrim(item.id, false, '00:00:00', '')}
                                    className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                                  >
                                    <Scissors className="w-3 h-3" />
                                    {item.startTime}{item.endTime ? ` → ${item.endTime}` : ' → end'} ✕
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {(item.status === 'done' || item.status === 'converting') && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/20 text-primary">
                                → {item.format.toUpperCase()}
                              </span>
                              {item.trimEnabled && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-secondary text-muted-foreground flex items-center gap-1">
                                  <Scissors className="w-2.5 h-2.5" />
                                  {item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.status === 'done' && item.downloadUrl && item.outputName && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary" asChild>
                              <a href={item.downloadUrl} download={item.outputName}>
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </a>
                            </Button>
                          )}
                          {item.status !== 'converting' && (
                            <button
                              onClick={() => removeFile(item.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar for converting item */}
                      {item.status === 'converting' && (
                        <div className="space-y-1 pl-8">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Converting to {item.format.toUpperCase()}...</span>
                            <span className="text-primary">{item.progress}%</span>
                          </div>
                          <Progress value={item.progress} className="h-1.5 bg-secondary" />
                          {item.logs.length > 0 && (
                            <div className="bg-background rounded text-xs p-2 font-mono h-16 overflow-y-auto border border-border text-muted-foreground mt-1">
                              {item.logs.slice(-8).map((log, i) => (
                                <div key={i}>{log}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Convert All button */}
                {pendingCount > 0 && (
                  <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                      {isRunning
                        ? 'Converting files one by one...'
                        : `${pendingCount} file${pendingCount !== 1 ? 's' : ''} ready to convert`}
                    </p>
                    <Button
                      onClick={handleConvertAll}
                      disabled={isRunning || engineStatus !== 'ready'}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold flex-shrink-0"
                      size="sm"
                    >
                      {isRunning ? (
                        <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Converting...</>
                      ) : (
                        <><Play className="w-3 h-3 mr-2" />Convert {pendingCount > 1 ? `All ${pendingCount}` : '1 File'}</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="font-medium flex items-center gap-2 pb-2 border-b border-border text-sm">
                <Settings className="w-4 h-4" />
                Output Format
              </div>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
                      ${format === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}
                    `}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="font-medium text-sm pb-2 border-b border-border">Settings</div>
              {isVideoFormat ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Resolution</label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">Original</SelectItem>
                        <SelectItem value="720">720p</SelectItem>
                        <SelectItem value="480">480p</SelectItem>
                        <SelectItem value="360">360p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {format !== 'gif' && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Quality (CRF)</label>
                      <Select value={quality} onValueChange={setQuality}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18">High (18)</SelectItem>
                          <SelectItem value="23">Medium (23)</SelectItem>
                          <SelectItem value="28">Low (28)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Audio Bitrate</label>
                  <Select value={audioBitrate} onValueChange={setAudioBitrate}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128k">128 kbps</SelectItem>
                      <SelectItem value="192k">192 kbps</SelectItem>
                      <SelectItem value="320k">320 kbps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {doneCount > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-primary mx-auto" />
                <p className="text-sm font-medium">{doneCount} file{doneCount !== 1 ? 's' : ''} converted</p>
                <p className="text-xs text-muted-foreground">Download each file from the queue above.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* SEO Content Section */}
      <article className="max-w-4xl w-full mt-16 space-y-12 pb-16 px-4 text-sm text-muted-foreground">

        {/* Feature trio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">Free Online Video Converter</h2>
            <p>ConvertFlow is a free browser-based video and audio converter powered by FFmpeg WebAssembly. Convert MP4, WebM, MKV, AVI, MOV, MP3, WAV, AAC, OGG, and GIF files instantly — no uploads, no account, no waiting.</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">100% Private — Files Stay on Your Device</h2>
            <p>All conversion runs locally in your browser. Your video and audio files are never sent to any server, making ConvertFlow the most private online video converter available. Works even offline once the engine is loaded.</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">Batch Convert &amp; Trim in One Click</h2>
            <p>Upload multiple files, choose a different output format for each, trim clips visually with the built-in scrubber, then download everything as a ZIP archive — all without leaving your browser.</p>
          </div>
        </div>

        {/* How to convert */}
        <section className="border-t border-border pt-10 space-y-4">
          <h2 className="text-foreground font-semibold text-base">How to Convert a Video Online for Free</h2>
          <ol className="space-y-2.5 list-decimal list-inside">
            <li><strong className="text-foreground font-medium">Upload your file</strong> — drag and drop one or more video or audio files into the upload area, or click to browse.</li>
            <li><strong className="text-foreground font-medium">Choose an output format</strong> — pick MP4, WebM, MKV, AVI, MOV for video; MP3, WAV, AAC, OGG for audio; or GIF for animations. Each file in a batch can have its own format.</li>
            <li><strong className="text-foreground font-medium">Preview and trim (optional)</strong> — click "Preview &amp; Trim" to open the visual scrubber. Play your video and click "Mark here" to set exact start and end points for the clip you want.</li>
            <li><strong className="text-foreground font-medium">Adjust quality settings (optional)</strong> — choose resolution (Original, 720p, 480p, 360p), video quality (CRF 18/23/28), or audio bitrate (128k, 192k, 320k).</li>
            <li><strong className="text-foreground font-medium">Convert</strong> — click the Convert button. FFmpeg WebAssembly processes your file entirely in your browser with no upload required.</li>
            <li><strong className="text-foreground font-medium">Download</strong> — save each converted file individually, or click "Download All (.zip)" to get every file in one archive.</li>
          </ol>
        </section>

        {/* Popular conversions */}
        <section className="border-t border-border pt-10 space-y-4">
          <h2 className="text-foreground font-semibold text-base">Popular Conversions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {[
              { title: 'MP4 to MP3 — Extract Audio from Video', body: 'Upload your MP4, select MP3 as the output format, set the bitrate to 320k for best quality, and click Convert. The audio track is extracted directly in your browser with no quality loss from re-encoding.' },
              { title: 'Video to GIF — Create Animated GIFs', body: 'Upload any video (MP4, WebM, MOV), trim it to the exact seconds you want using the visual scrubber, choose GIF as output, and convert. Perfect for social media clips, memes, and reaction GIFs.' },
              { title: 'WebM to MP4 — Maximum Compatibility', body: 'WebM files from screen recordings or web downloads convert to MP4 in seconds. MP4 plays on every device — iPhone, Android, Smart TV, Windows, and Mac — making it the most universally compatible format.' },
              { title: 'MOV to MP4 — Convert Apple QuickTime Video', body: 'iPhone and Mac recordings in MOV format can be converted to MP4 for easy sharing across all platforms. ConvertFlow handles MOV files up to any file size entirely in your browser.' },
              { title: 'MP4 to WebM — Optimise for Web', body: 'WebM provides smaller file sizes at the same quality compared to MP4, making it ideal for websites. Convert your MP4 to WebM and reduce bandwidth usage without sacrificing visual quality.' },
              { title: 'Video to WAV — Lossless Audio Extraction', body: 'Extract uncompressed, lossless audio from any video file. WAV is the preferred format for audio editing, voiceover work, podcast production, and professional audio workflows.' },
            ].map(({ title, body }) => (
              <div key={title} className="space-y-1">
                <h3 className="text-foreground font-medium">{title}</h3>
                <p className="text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported formats table */}
        <section className="border-t border-border pt-10 space-y-4">
          <h2 className="text-foreground font-semibold text-base">Supported Video &amp; Audio Formats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { fmt: 'MP4', type: 'Video', desc: 'Most compatible format for web, mobile, and TV playback.' },
              { fmt: 'WebM', type: 'Video', desc: 'Open-source format optimised for web streaming and smaller sizes.' },
              { fmt: 'MKV', type: 'Video', desc: 'Flexible container supporting multiple audio and subtitle tracks.' },
              { fmt: 'AVI', type: 'Video', desc: 'Classic Windows format with broad hardware compatibility.' },
              { fmt: 'MOV', type: 'Video', desc: 'Apple QuickTime format, standard for Mac and iPhone recordings.' },
              { fmt: 'MP3', type: 'Audio', desc: 'Universal compressed audio format for music, podcasts, and voice.' },
              { fmt: 'WAV', type: 'Audio', desc: 'Uncompressed lossless audio for maximum quality and editing.' },
              { fmt: 'AAC', type: 'Audio', desc: 'High-efficiency audio used by Apple devices, iTunes, and streaming.' },
              { fmt: 'OGG', type: 'Audio', desc: 'Open-source audio format with excellent quality-to-size ratio.' },
              { fmt: 'GIF', type: 'Image', desc: 'Looping animated image format ideal for short clips and reactions.' },
            ].map(({ fmt, type, desc }) => (
              <div key={fmt} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-semibold">{fmt}</span>
                  <span className="text-[10px] text-muted-foreground/60">{type}</span>
                </div>
                <p className="text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why ConvertFlow */}
        <section className="border-t border-border pt-10 space-y-4">
          <h2 className="text-foreground font-semibold text-base">Why Use ConvertFlow?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {[
              { title: 'No file size limits', body: 'Because conversion runs in your browser rather than on a server, there are no upload size restrictions. Convert files of any size.' },
              { title: 'No account or sign-up required', body: 'Open the page and start converting immediately. No email, no password, no subscription — completely frictionless.' },
              { title: 'Completely free forever', body: 'ConvertFlow is free with no hidden fees, paywalls, or premium tiers. Every feature — batch conversion, trimming, ZIP download — is free.' },
              { title: 'Works offline after first load', body: 'Once the FFmpeg engine is loaded into your browser, conversions continue to work even if your internet connection drops.' },
              { title: 'Visual trim with scrubber', body: 'Play your video, scrub to exact frames, and click "Mark here" to set start and end trim points. See the selected range highlighted on the timeline before you commit.' },
              { title: 'Batch convert with per-file settings', body: 'Add multiple files to the queue. Each file gets its own format choice and trim settings. Convert all in sequence, then download as a ZIP.' },
            ].map(({ title, body }) => (
              <div key={title} className="space-y-1">
                <h3 className="text-foreground font-medium">{title}</h3>
                <p className="text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border pt-10 space-y-5">
          <h2 className="text-foreground font-semibold text-base">Frequently Asked Questions</h2>
          <div className="space-y-5">
            {[
              { q: 'Is ConvertFlow free to use?', a: 'Yes, completely free. No sign-up, no account, no hidden fees. All features — batch conversion, visual trimming, ZIP downloads — are free.' },
              { q: 'Do my files get uploaded to a server?', a: 'No. ConvertFlow uses FFmpeg WebAssembly, which runs entirely inside your browser. Your files never leave your device and are never sent to any server.' },
              { q: 'How do I convert MP4 to MP3?', a: 'Upload your MP4, select MP3 as the output format in the per-file format row, optionally set the audio bitrate to 320k for best quality, and click Convert. The MP3 downloads directly to your device.' },
              { q: 'How do I trim a video before converting?', a: 'Click "Preview & Trim" on any file in the queue. The video plays in a modal with a timeline. Click "Mark here" to set the start and end points, then click Apply Trim. Only the selected segment is included in the converted output.' },
              { q: 'Can I convert multiple files at once?', a: 'Yes. Add as many files as you like to the queue. Set a different output format and trim range for each file independently, then click Convert All. Download each file separately or use "Download All (.zip)".' },
              { q: 'Can I convert a video to GIF?', a: 'Yes. Upload your video, select GIF as the output format, optionally trim it to the exact seconds you want, and click Convert. The animated GIF is created entirely in your browser.' },
              { q: 'What browsers does ConvertFlow support?', a: 'ConvertFlow works in Chrome, Edge, Firefox, and Safari 15.2+. It requires WebAssembly and SharedArrayBuffer support. Internet Explorer is not supported.' },
            ].map(({ q, a }) => (
              <div key={q} className="space-y-1">
                <h3 className="text-foreground font-medium">{q}</h3>
                <p className="text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-border pt-8 text-center text-xs space-y-1">
          <p className="text-foreground/60">ConvertFlow — Free Online Video Converter &amp; Audio Converter</p>
          <p>Convert MP4, MP3, WebM, GIF, WAV, AAC, MKV, AVI, MOV and more — instantly in your browser, no uploads required.</p>
        </div>
      </article>

      {/* Video Preview Modal */}
      {previewItemId && (() => {
        const item = queue.find(i => i.id === previewItemId);
        if (!item) return null;
        return (
          <VideoPreviewPanel
            item={item}
            onApply={(startTime, endTime) => {
              updateItemTrim(item.id, startTime !== '00:00:00' || endTime !== '', startTime, endTime);
            }}
            onClose={() => setPreviewItemId(null)}
          />
        );
      })()}
    </div>
  );
}
