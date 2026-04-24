import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AppNotification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const PERMISSION_KEY = "notif-permission-asked";

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (document.visibilityState === "visible") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "smartcore-task" });
  } catch (e) {
    console.warn("Browser notification failed", e);
  }
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications((data || []) as AppNotification[]);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Request browser notification permission once per session
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default" && !sessionStorage.getItem(PERMISSION_KEY)) {
      sessionStorage.setItem(PERMISSION_KEY, "1");
      Notification.requestPermission().catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const changedNotification =
            payload.eventType === "DELETE"
              ? (payload.old as Partial<AppNotification>)
              : (payload.new as Partial<AppNotification>);

          if (changedNotification.user_id !== userId) return;

          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as AppNotification;
            setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
            toast({ title: newNotif.title, description: newNotif.message });
            showBrowserNotification(newNotif.title, newNotif.message);
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as AppNotification;
            setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          }

          if (payload.eventType === "DELETE") {
            const old = payload.old as AppNotification;
            setNotifications((prev) => prev.filter((n) => n.id !== old.id));
          }

          void fetchNotifications();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchNotifications();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("Notifications realtime status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications, toast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
  };

  const clearAll = async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from("notifications").delete().eq("user_id", userId);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll, refetch: fetchNotifications };
}
