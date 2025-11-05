import { Menu, X, LayoutDashboard, ListTodo, Building2, BarChart3, LogOut, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

interface HamburgerMenuProps {
  currentView: "dashboard" | "tasks" | "vendors" | "reports" | "users";
  onViewChange: (view: "dashboard" | "tasks" | "vendors" | "reports" | "users") => void;
  userEmail: string;
  onSignOut: () => void;
  isAdmin: boolean;
}

export function HamburgerMenu({ currentView, onViewChange, userEmail, onSignOut, isAdmin }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Menu items for all users
  const commonMenuItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "tasks" as const, label: "Manage Tasks", icon: ListTodo },
  ];

  // Admin-only menu items
  const adminMenuItems = isAdmin ? [
    { id: "vendors" as const, label: "Manage Vendors", icon: Building2 },
    { id: "reports" as const, label: "Reports", icon: BarChart3 },
  ] : [];

  // External links (admin only)
  const externalLinks = isAdmin ? [
    { label: "Quotation Management", icon: FileText, url: "https://coreinvoice-maker.lovable.app/" },
  ] : [];

  // User management (admin only)
  const userManagementItems = isAdmin ? [{ id: "users" as const, label: "Manage Users", icon: Users }] : [];

  const handleViewChange = (view: "dashboard" | "tasks" | "vendors" | "reports" | "users") => {
    onViewChange(view);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Menu</h2>
            <ThemeToggle />
          </div>
          
          <nav className="flex-1 space-y-2">
            {/* Admin-only menu items first */}
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  onClick={() => handleViewChange(item.id)}
                  className="w-full justify-start gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
            
            {/* Common menu items for all users */}
            {commonMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  onClick={() => handleViewChange(item.id)}
                  className="w-full justify-start gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
            
            {/* Admin-only menu items continued */}
            {externalLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.label}
                  variant="ghost"
                  onClick={() => {
                    window.open(link.url, '_blank');
                    setIsOpen(false);
                  }}
                  className="w-full justify-start gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              );
            })}

            {userManagementItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  onClick={() => handleViewChange(item.id)}
                  className="w-full justify-start gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="border-t pt-4 mt-4">
            <div className="text-sm text-muted-foreground mb-3 px-2">
              Welcome, {userEmail}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                onSignOut();
                setIsOpen(false);
              }}
              className="w-full justify-start gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}