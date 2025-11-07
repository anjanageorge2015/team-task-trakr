import { Moon, Sun, Briefcase, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0 professional:rotate-90 professional:scale-0 orange:rotate-90 orange:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 professional:rotate-90 professional:scale-0 orange:rotate-90 orange:scale-0" />
          <Briefcase className="absolute h-4 w-4 rotate-90 scale-0 transition-all professional:rotate-0 professional:scale-100 dark:rotate-90 dark:scale-0 orange:rotate-90 orange:scale-0" />
          <Palette className="absolute h-4 w-4 rotate-90 scale-0 transition-all orange:rotate-0 orange:scale-100 dark:rotate-90 dark:scale-0 professional:rotate-90 professional:scale-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("professional")}>
          <Briefcase className="mr-2 h-4 w-4" />
          Professional
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("orange")}>
          <Palette className="mr-2 h-4 w-4" />
          Orange
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
