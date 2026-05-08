import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  allLabel = "All",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal h-10", className)}
        >
          <span className="flex flex-wrap gap-1 items-center overflow-hidden">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{allLabel}</span>
            ) : value.length <= 2 ? (
              selectedLabels.map((l) => (
                <Badge key={l} variant="secondary" className="text-xs">
                  {l}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary" className="text-xs">{value.length} selected</Badge>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value.length > 0 && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-1">
          {options.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">No options</div>
          )}
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(opt.value)} />
                <span className="flex-1">{opt.label}</span>
                {checked && <Check className="h-4 w-4" />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
