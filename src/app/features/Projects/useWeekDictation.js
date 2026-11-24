import { useEffect, useRef, useState } from "react";
import { startNativeDictation } from "../../../lib/speech-native";
import { transcribirEnServidor } from "../../../lib/transcribir";

const stopTracks = (stream) => stream?.getTracks().forEach((track) => track.stop());
const MAX_RECORDING_MS = 4 * 60 * 1000;

export function useWeekDictation(onText) {
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [hasAudio, setHasAudio] = useState(false);
  const current = useRef(null);
  const saved = useRef(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      const session = current.current;
      current.current = null;
      clearTimeout(session?.timer);
      if (session?.native) void session.native.stop();
      if (session?.recorder?.state === "recording") session.recorder.stop();
      stopTracks(session?.stream);
    };
  }, []);

  async function transcribe(blob) {
    if (!active.current || current.current) return;
    const request = {};
    current.current = request;
    setPhase("transcribing");
    setError("");
    const result = await transcribirEnServidor(blob);
    if (!active.current || current.current !== request) return;
    current.current = null;
    setPhase("idle");
    if (result.texto) {
      onText(result.texto);
      saved.current = null;
      setHasAudio(false);
    } else {
      setError(result.error || "No se pudo transcribir el dictado.");
    }
  }

  async function stop() {
    const session = current.current;
    if (!session?.recorder && !session?.native) return;
    clearTimeout(session.timer);
    if (session.native) {
      setPhase("transcribing");
      const words = await session.native.stop();
      if (!active.current || current.current !== session) return;
      current.current = null;
      setPhase("idle");
      if (words.trim()) onText(words);
      else setError("El teléfono no detectó un mensaje. Vuelve a dictar o escribe el plan.");
    } else if (session.recorder.state === "recording") {
      setPhase("transcribing");
      session.recorder.stop();
    }
  }

  async function start() {
    if (current.current) return;
    const session = {};
    current.current = session;
    setPhase("opening");
    setError("");
    try {
      const native = await startNativeDictation();
      if (!active.current || current.current !== session) {
        if (native) await native.stop();
        return;
      }
      if (native) {
        session.native = native;
      } else {
        if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active.current || current.current !== session) {
          stopTracks(stream);
          return;
        }
        session.stream = stream;
        const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((value) => MediaRecorder.isTypeSupported(value));
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        session.recorder = recorder;
        const parts = [];
        recorder.ondataavailable = ({ data }) => { if (data.size) parts.push(data); };
        recorder.onerror = () => {
          clearTimeout(session.timer);
          stopTracks(stream);
          if (current.current !== session || !active.current) return;
          current.current = null;
          setPhase("idle");
          setError("La grabación se interrumpió. Puedes volver a dictar o escribir el plan.");
        };
        recorder.onstop = () => {
          stopTracks(stream);
          clearTimeout(session.timer);
          if (current.current !== session || !active.current) return;
          current.current = null;
          const blob = new Blob(parts, { type: recorder.mimeType });
          if (!blob.size) {
            setPhase("idle");
            setError("No se grabó ningún sonido. Vuelve a intentar.");
            return;
          }
          saved.current = blob;
          setHasAudio(true);
          void transcribe(blob);
        };
        recorder.start(1000);
      }
      session.timer = setTimeout(() => void stop(), MAX_RECORDING_MS);
      setPhase("recording");
    } catch {
      stopTracks(session.stream);
      if (!active.current || current.current !== session) return;
      current.current = null;
      setPhase("idle");
      setError("No se pudo abrir el micrófono. Revisa sus permisos o escribe el plan.");
    }
  }

  return { phase, error, hasAudio, start, stop, retry: () => saved.current && transcribe(saved.current) };
}
