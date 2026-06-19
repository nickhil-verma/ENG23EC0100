import { useState, useEffect } from "react";
import { fetchNotifications } from "../api/notifications";

const PRIORITY_MAP = {
  placement: 3,
  result: 2,
  event: 1
};

export function useNotifications(filter = "All") {
  const [allNotifications, setAllNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem("read_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      const list = data?.notifications || data?.data || (Array.isArray(data) ? data : []);
      setAllNotifications(list);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem("read_notifications", JSON.stringify(readIds));
  }, [readIds]);

  const markAsRead = (id) => {
    if (!readIds.includes(id)) {
      setReadIds((prev) => [...prev, id]);
    }
  };

  const markAllRead = (notificationsToMark) => {
    const idsToMark = notificationsToMark.map(n => n.ID).filter(id => id && !readIds.includes(id));
    if (idsToMark.length > 0) {
      setReadIds((prev) => [...prev, ...idsToMark]);
    }
  };

  const unreadNotifications = allNotifications.filter(
    (n) => n.ID && !readIds.includes(n.ID)
  );

  const filteredUnread = unreadNotifications.filter((n) => {
    if (!filter || filter === "All") return true;
    return n.Type?.toLowerCase() === filter.toLowerCase();
  });

  const sortedNotifications = [...filteredUnread].sort((a, b) => {
    const priorityA = PRIORITY_MAP[a.Type?.toLowerCase()] || 0;
    const priorityB = PRIORITY_MAP[b.Type?.toLowerCase()] || 0;

    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    const dateA = new Date(a.Timestamp ? a.Timestamp.replace(" ", "T") : 0);
    const dateB = new Date(b.Timestamp ? b.Timestamp.replace(" ", "T") : 0);
    return dateB - dateA;
  });

  const topTenNotifications = sortedNotifications.slice(0, 10);

  return {
    notifications: topTenNotifications,
    totalUnreadCount: unreadNotifications.length,
    loading,
    error,
    markAsRead,
    markAllRead: () => markAllRead(topTenNotifications),
    refetch: loadData
  };
}
