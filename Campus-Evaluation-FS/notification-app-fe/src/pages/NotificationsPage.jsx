import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  CircularProgress,
  Divider,
  Stack,
  Typography,
  Button,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

import { NotificationCard } from "../components/NotificationCard";
import { NotificationFilter } from "../components/NotificationFilter";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationsPage() {
  const [filter, setFilter] = useState("All");

  const {
    notifications,
    totalUnreadCount,
    loading,
    error,
    markAsRead,
    markAllRead,
  } = useNotifications(filter);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Badge badgeContent={totalUnreadCount} color="primary" max={99}>
            <NotificationsIcon sx={{ fontSize: 28 }} />
          </Badge>
          <Typography variant="h5" fontWeight={700}>
            Notifications
          </Typography>
        </Stack>
        {notifications.length > 0 && (
          <Button variant="outlined" size="small" onClick={markAllRead} sx={{ textTransform: "none" }}>
            Mark All Read
          </Button>
        )}
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ marginBottom: 3 }}>
        <NotificationFilter value={filter} onChange={handleFilterChange} />
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error">Failed to load notifications: {error}</Alert>
      )}

      {!loading && !error && notifications.length === 0 && (
        <Alert severity="info">No new unread notifications</Alert>
      )}

      {!loading && !error && notifications.length > 0 && (
        <Stack spacing={1.5}>
          {notifications.map((n) => (
            <NotificationCard
              key={n.ID}
              notification={n}
              onMarkAsRead={markAsRead}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
