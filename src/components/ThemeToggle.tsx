import { Moon, Sun, Briefcase, Palette, Waves } from "lucide-react";
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

  const Icon =
    theme === "dark" ? Moon
    : theme === "professional" ? Briefcase
    : theme === "orange" ? Palette
    : theme === "ocean" ? Waves
    : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Icon className="h-4 w-4" />
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
        <DropdownMenuItem onClick={() => setTheme("ocean")}>
          <Waves className="mr-2 h-4 w-4" />
          Ocean Blue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
