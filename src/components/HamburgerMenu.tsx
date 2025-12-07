import { LayoutDashboard, ListTodo, Building2, BarChart3, LogOut, Users, FileText, Wallet, Receipt, TrendingUp, DollarSign, Truck, Settings, ClipboardList, ChevronDown, ChevronRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface HamburgerMenuProps {
  currentView: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports" | "salaries";
  onViewChange: (view: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports" | "salaries") => void;
  userEmail: string;
  onSignOut: () => void;
  isAdmin: boolean;
}

type MenuSection = "task-management" | "finops" | "supply" | "quotation" | "administration";

export function HamburgerMenu({ currentView, onViewChange, userEmail, onSignOut, isAdmin }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<MenuSection>("task-management");

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
    { id: "salaries" as const, label: "Manage Payroll", icon: Banknote },
  ] : [];

  const handleViewChange = (view: "dashboard" | "tasks" | "vendors" | "reports" | "users" | "expenses" | "payroll" | "finops-reports" | "salaries") => {
    onViewChange(view);
    setIsOpen(false);
  };

  const toggleSection = (section: MenuSection) => {
    setExpandedSection(expandedSection === section ? "task-management" : section);
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
          
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {/* Task Management Section */}
            <Collapsible open={expandedSection === "task-management"} onOpenChange={() => toggleSection("task-management")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 h-9">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span className="font-semibold">Task Management</span>
                  </div>
                  {expandedSection === "task-management" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1">
                {taskManagementItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={currentView === item.id ? "default" : "ghost"}
                      onClick={() => handleViewChange(item.id)}
                      className="w-full justify-start gap-2 h-9"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>

            {/* FinOps Section */}
            <Collapsible open={expandedSection === "finops"} onOpenChange={() => toggleSection("finops")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 h-9">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-semibold">FinOps</span>
                  </div>
                  {expandedSection === "finops" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1">
                {finopsMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={currentView === item.id ? "default" : "ghost"}
                      onClick={() => handleViewChange(item.id)}
                      className="w-full justify-start gap-2 h-9"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>

            {/* Supply & Distribution Section */}
            <Collapsible open={expandedSection === "supply"} onOpenChange={() => toggleSection("supply")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 h-9">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-semibold">Supply & Distribution</span>
                  </div>
                  {expandedSection === "supply" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.open('https://smart-distro-hub.lovable.app/', '_blank');
                    setIsOpen(false);
                  }}
                  className="w-full justify-start gap-2 h-9"
                >
                  <Truck className="h-4 w-4" />
                  Open Distribution Hub
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Quotation Management Section */}
            <Collapsible open={expandedSection === "quotation"} onOpenChange={() => toggleSection("quotation")}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 h-9">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-semibold">Quotation Management</span>
                  </div>
                  {expandedSection === "quotation" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.open('https://coreinvoice-maker.lovable.app/', '_blank');
                    setIsOpen(false);
                  }}
                  className="w-full justify-start gap-2 h-9"
                >
                  <FileText className="h-4 w-4" />
                  Open Quotation Hub
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Administration Section (Admin only) */}
            {administrationMenuItems.length > 0 && (
              <Collapsible open={expandedSection === "administration"} onOpenChange={() => toggleSection("administration")}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-2 h-9">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span className="font-semibold">Administration</span>
                    </div>
                    {expandedSection === "administration" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1">
                  {administrationMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant={currentView === item.id ? "default" : "ghost"}
                        onClick={() => handleViewChange(item.id)}
                        className="w-full justify-start gap-2 h-9"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
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
