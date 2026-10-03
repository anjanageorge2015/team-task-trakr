import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Send, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/types/task";

interface Props {
  task: Task | null;
  onClose: () => void;
  onSend: (message: string) => void;
}

export function WhatsAppDraftDialog({ task, onClose, onSend }: Props) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("customer");
  const [language, setLanguage] = useState("english");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) { setMessage(""); setNote(""); }
  }, [task]);

  const generate = async () => {
    if (!task) return;
    setLoading(true);
    const { amount, commissionPercentage, ...safeTask } = task;
    const { data, error } = await supabase.functions.invoke("whatsapp-draft", {
      body: { task: safeTask, recipient, language, note },
    });
    setLoading(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg ??= (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      toast({ variant: "destructive", title: "Could not draft message", description: msg || "Please try again." });
      return;
    }
    setMessage(data.message);
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI WhatsApp Message</DialogTitle>
          <DialogDescription>{task?.scsId} · {task?.customerName}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Send to</Label>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="engineer">Engineer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="malayalam">Malayalam</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Extra note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Engineer will reach by 3 PM" />
        </div>
        <Button onClick={generate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {message ? "Write again" : "Write message"}
        </Button>
        {message && (
          <>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(message); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button className="gap-2" onClick={() => onSend(message)}>
                <Send className="h-4 w-4" /> Send on WhatsApp
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
