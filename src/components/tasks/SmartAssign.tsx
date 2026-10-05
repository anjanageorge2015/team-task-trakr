import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  job: { vendor: string; customerName: string; customerAddress: string; callDescription: string };
  onPick: (name: string) => void;
}

export function SmartAssign({ job, onPick }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<{ name: string; reason: string }[] | null>(null);

  const run = async () => {
    if (!job.customerAddress && !job.customerName && !job.vendor) {
      return toast({ title: "Add vendor, customer or address first" });
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("smart-assign", { body: job });
    setLoading(false);
    if (error || data?.error) {
      return toast({ variant: "destructive", title: "Could not get suggestions", description: data?.error || error?.message });
    }
    setList(data.suggestions ?? []);
  };

  return (
    <div className="mt-1 space-y-1">
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
        Suggest engineer
      </Button>
      {list && list.length === 0 && <p className="text-xs text-muted-foreground">No past data to suggest from.</p>}
      {list?.map((s) => (
        <button
          key={s.name}
          type="button"
          onClick={() => { onPick(s.name); setList(null); }}
          className="block w-full text-left rounded-md border px-2 py-1 text-xs hover:bg-accent"
        >
          <span className="font-medium">{s.name}</span>
          <span className="text-muted-foreground"> — {s.reason}</span>
        </button>
      ))}
    </div>
  );
}
