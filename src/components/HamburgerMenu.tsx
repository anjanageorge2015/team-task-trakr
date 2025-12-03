import { LayoutDashboard, ListTodo, Building2, BarChart3, LogOut, Users, FileText, Wallet, Receipt, TrendingUp, DollarSign, Truck, Settings, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";

interface HamburgerMenuProps {
  currentView: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports";
  onViewChange: (view: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports") => void;
  userEmail: string;
  onSignOut: () => void;
  isAdmin: boolean;
}

export function HamburgerMenu({ currentView, onViewChange, userEmail, onSignOut, isAdmin }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Task Management menu items
  const taskManagementItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "tasks" as const, label: "Manage Tasks", icon: ListTodo },
    ...(isAdmin ? [{ id: "reports" as const, label: "Reports", icon: BarChart3 }] : []),
  ];

  // FinOps menu items
  const finopsMenuItems = [
    { id: "expenses" as const, label: "Expense Management", icon: Receipt },
    { id: "payroll" as const, label: "Payroll Management", icon: DollarSign },
    { id: "finops-reports" as const, label: "Financial Reports", icon: TrendingUp },
  ];

  // Administration menu items (admin only)
  const administrationMenuItems = isAdmin ? [
    { id: "vendors" as const, label: "Manage Vendors", icon: Building2 },
    { id: "users" as const, label: "Manage Users", icon: Users },
  ] : [];

  // External links (admin only)
  const externalLinks = isAdmin ? [
    { label: "Quotation Management", icon: FileText, url: "https://coreinvoice-maker.lovable.app/" },
  ] : [];

  const handleViewChange = (view: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports") => {
    onViewChange(view);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <div className="w-4 h-4 flex flex-col justify-center items-center gap-[3px]">
            <span 
              className={`w-4 h-[2px] bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'rotate-45 translate-y-[5px]' : 'rotate-0 translate-y-0'
              }`}
            />
            <span 
              className={`w-4 h-[2px] bg-current transition-all duration-300 ease-in-out ${
                isOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
              }`}
            />
            <span 
              className={`w-4 h-[2px] bg-current transition-all duration-300 ease-in-out ${
                isOpen ? '-rotate-45 -translate-y-[5px]' : 'rotate-0 translate-y-0'
              }`}
            />
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Menu</h2>
            <ThemeToggle />
          </div>
          
          <nav className="flex-1 space-y-2">
            {/* Task Management Section */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 flex items-center gap-2">
                <ClipboardList className="h-3 w-3" />
                Task Management
              </div>
              {taskManagementItems.map((item) => {
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
            </div>

            {/* FinOps Section */}
            <div className="pt-3">
              <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 flex items-center gap-2">
                <Wallet className="h-3 w-3" />
                FinOps
              </div>
              {finopsMenuItems.map((item) => {
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
            </div>

            {/* Supply & Distribution Section */}
            <div className="pt-3">
              <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 flex items-center gap-2">
                <Truck className="h-3 w-3" />
                Supply & Distribution
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  window.open('https://smart-distro-hub.lovable.app/', '_blank');
                  setIsOpen(false);
                }}
                className="w-full justify-start gap-2"
              >
                <Truck className="h-4 w-4" />
                Open Distribution Hub
              </Button>
            </div>

            {/* Administration Section (Admin only) */}
            {administrationMenuItems.length > 0 && (
              <div className="pt-3">
                <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 flex items-center gap-2">
                  <Settings className="h-3 w-3" />
                  Administration
                </div>
                {administrationMenuItems.map((item) => {
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
              </div>
            )}
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