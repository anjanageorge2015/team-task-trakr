import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface VoiceTaskFields {
  vendorCallId: string | null;
  vendor: string | null;
  callDescription: string | null;
  callDate: string | null;
  customerName: string | null;
  customerAddress: string | null;
  amount: number | null;
  assignedTo: string | null;
  salesPerson: string | null;
  remarks: string | null;
}

interface Props {
  vendors: string[];
  team: string[];
  onResult: (fields: VoiceTaskFields, transcript: string) => void;
}

const SUPABASE_URL = "https://dmwnmyfvpdzlahrawlmk.supabase.co";
const MAX_SECONDS = 180;

export function VoiceTaskRecorder({ vendors, team, onResult }: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number>();

  useEffect(() => () => {
    window.clearInterval(timer.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        send(new Blob(chunks.current, { type: (rec.mimeType || "audio/webm").split(";")[0].replace("video/", "audio/") }));
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast({ variant: "destructive", title: "Microphone needed", description: "Please allow microphone access to record a task." });
    }
  };

  const stop = () => {
    window.clearInterval(timer.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  const send = async (blob: Blob) => {
    if (blob.size < 1000) {
      setState("idle");
      toast({ variant: "destructive", title: "Recording too short", description: "Please speak a little longer." });
      return;
    }
    setState("processing");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fd = new FormData();
      fd.append("audio", new File([blob], `voice.${ext}`, { type: blob.type }));
      fd.append("vendors", JSON.stringify(vendors));
      fd.append("team", JSON.stringify(team));
      fd.append("today", new Date().toLocaleDateString("en-CA"));
      const res = await fetch(`${SUPABASE_URL}/functions/v1/voice-task`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (data?.transcript) setTranscript(data.transcript);
      if (!res.ok) throw new Error(data?.error || "Could not process the recording");
      onResult(data.fields, data.transcript);
      toast({ title: "Form filled from voice", description: "Please review the details and save." });
    } catch (e) {
      toast({ variant: "destructive", title: "Voice task failed", description: e instanceof Error ? e.message : "Please try again." });
    } finally {
      setState("idle");
    }
  };

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <Button type="button" variant="destructive" size="sm" onClick={stop} className="gap-2">
            <Square className="h-4 w-4" /> Stop ({mm})
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={start} disabled={state === "processing"} className="gap-2">
            {state === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {state === "processing" ? "Filling form…" : "Speak task"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {state === "recording"
            ? "Listening… say customer, address, vendor, problem, engineer."
            : "AI-powered: speak in English or Malayalam to fill this form."}
        </span>
      </div>
      {transcript && (
        <p className="text-xs text-muted-foreground"><span className="font-medium">Heard:</span> {transcript}</p>
      )}
    </div>
  );
}
