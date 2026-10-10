import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { captureFrame, CameraError, openCamera, stopStream } from '../services/camera';

interface CaptureProps {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  onError: (error: CameraError) => void;
}

/** Mounted only while the dialog is open, so each opening starts with fresh state. */
function CameraBody({ onClose, onCapture, onError }: CaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    openCamera()
      .then((opened) => {
        if (cancelled) {
          stopStream(opened);
          return;
        }
        stream = opened;
        if (videoRef.current) {
          videoRef.current.srcObject = opened;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError(error instanceof CameraError ? error : new CameraError('unknown', String(error)));
        onClose();
      });
    return () => {
      cancelled = true;
      // Always release the camera (turns off the hardware indicator).
      stopStream(stream);
    };
  }, [onClose, onError]);

  const capture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const blob = await captureFrame(videoRef.current);
      onCapture(blob);
      onClose();
    } catch (error) {
      onError(error instanceof CameraError ? error : new CameraError('unknown', String(error)));
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          onLoadedMetadata={() => setReady(true)}
          className="aspect-[4/3] w-full object-cover"
          aria-label="Camera preview"
        />
        {!ready ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Starting camera…
            </span>
          </div>
        ) : null}
        <div aria-hidden className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/50" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void capture()} disabled={!ready} loading={capturing} icon={<Camera className="size-4" aria-hidden />}>
          Capture
        </Button>
      </div>
    </div>
  );
}

/**
 * Live camera capture via getUserMedia. The stream starts only when this
 * dialog opens (an explicit user action) and every track is stopped on close.
 */
export function CameraCapture({ open, ...props }: CaptureProps & { open: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={props.onClose}
      title="Take a photo"
      description="Fill the frame with one leaf, in good light, and hold steady."
      size="lg"
    >
      {open ? <CameraBody {...props} /> : null}
    </Dialog>
  );
}
