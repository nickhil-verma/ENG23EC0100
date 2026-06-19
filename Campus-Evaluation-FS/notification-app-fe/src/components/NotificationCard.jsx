import { Card, CardContent, Typography, Button, Box, Chip } from "@mui/material";

export function NotificationCard({ notification, onMarkAsRead }) {
  const { ID, Type, Message, Timestamp } = notification;
  const dateStr = Timestamp ? new Date(Timestamp.replace(" ", "T")).toLocaleString() : "";

  const getChipColor = (t) => {
    switch (t?.toLowerCase()) {
      case "placement":
        return "primary";
      case "result":
        return "secondary";
      case "event":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 1.5, borderColor: "#E2E8F0", borderRadius: 1.5, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography variant="subtitle1" fontWeight="bold" component="span">
                {Message}
              </Typography>
              <Chip label={Type} size="small" color={getChipColor(Type)} variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={() => onMarkAsRead(ID)}
            sx={{ textTransform: "none" }}
          >
            Mark Read
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
