# Stage 1

## System Design for Notification System Design Plan
---
### Actions we support
some of the main action a user can do with notifcation,
  * **Get Notifications**- list of all notifcations (with page/pagination)
- **Mark as Read**: select single/multiple and mark them read
+ **Mark All Read** - click button & make all unread read instantly
   * **Delete Notification** : delete permantly from list.
- **Get Unread Count** - show count (e.g. on bell icon badge)
---
### global headers and base url details
Base URL -> `https://api.example.com/v1`

Common Headers to send:
* Authorzation: Bearer token (`Bearer eyJhbGciOiJIUzI1...`) to check which user is calling API
 - Content-Type: `application/json` (for POST, PATCH, PUT calls)
 + Accept: `application/json` (so server know we want JSON output)
---
## API Endpoints details

#### 1. Get Notifications (Paginated)
* `GET /notifications`
* query params: `page` (default 1), `limit` (default 20), `status` (`read`, `unread`, `all`)
Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_85f3a2b1-9c8d-4e2a",
      "title": "Security Alert",
      "message": "A new login was detected from a new device.",
      "type": "security",
      "status": "unread",
      "action_url": "https://example.com/settings/security",
      "created_at": "2026-06-19T10:15:30Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "limit": 20,
    "total_items": 42,
    "total_pages": 3,
    "has_more": true
  }
}
```
#### 2. Get Unread Notification Count
* `GET /notifications/unread-count`
Response (200 OK):
```json
{
  "success": true,
  "data": { "unread_count": 5 }
}
```
#### 3. Mark Notifications as Read
* `PATCH /notifications/status`
Body:
```json
{
  "notification_ids": ["notif_85f3a2b1-9c8d-4e2a"],
  "status": "read"
}
```
Response:
```json
{
  "success": true,
  "message": "Notifications successfully updated to read."
}
```
#### 4. Mark All Notifications as Read
* `POST /notifications/mark-all-read`
Response:
```json
{
  "success": true,
  "message": "All notifications marked as read."
}
```
#### 5. Delete a Notification
* `DELETE /notifications/:id`
Response:
```json
{
  "success": true,
  "message": "Notification deleted successfully."
}
```

---
## Real-Time Updates options
For showing notifcations in real time we have two way:

##### Way A - WebSockets (Real-time Push)
* user login -> frontnd open ws connection to `wss://ws.example.com/notifications?token=eyJ...`
* auth token in query param or sub-protocol
* new notifcation in bakend -> direct push json to client
WS Payload (Event: `new_notification`):
```json
{
  "event": "new_notification",
  "timestamp": "2026-06-19T10:59:48Z",
  "data": {
    "id": "notif_99z8y7x6-5w4v-3u2t",
    "title": "New Comment",
    "message": "Alex commented on your design file.",
    "type": "social",
    "status": "unread",
    "action_url": "https://example.com/projects/1/comments",
    "created_at": "2026-06-19T10:59:45Z"
  }
}
```

##### Way B - Polling (HTTP API calls)
* Instead of keeping ws open (high server cost), we do simple REST polling.
* user login -> call `GET /notifications` normaly.
* after that frontnd calls api in bakground every `15 seconds` to sync unread count & new list.

---


 
# Stage 2: 
## Datbase Choice and Schema
 
I will go with **SQL** because:
1. **Relations**: Each notification belongs to a student (`student_id`).
2. **Consistancy**: marking multiple read needs strong consistancy so counts match.
3. **Structred data**: Fields are fixed.
4. **Faster querys**: Can index `student_id` & `is_read`.

If payload is highly dynamic or very high write load we can see NoSQL, but SQL is safer.

#### SQL Schema:
```sql
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

# Stage 3: Scaling to 50 Lakh (5,000,000) Students
Earlier we had 50000 students, now it is 50 Lakhs. Query:
```sql
SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAT ASC;
```
Without index-> query will scan crores of rows so DB CPU will hit 100% and server crash.

#### Ways to fasten up the query:

##### 1. Composit Index (Multi column Index)
```sql
CREATE INDEX idx_student_unread_created ON notifications(studentID, isRead, createdAT ASC);
```
* **How it helps**: DB don't scan whole table Directly jump to `studentID = 1042` & get unread No sorting needed in RAM.
* **Cost**: Read cost becomes almost 0  Write cost increases a bit because index must update  Storage increases for index.

##### 2. Redis Caching
* **How it works**: Cache `student:unread_count:1042` -> count (e.g. `5`). On page load-> fetch directly from Redis. Increament on new notif-> decreament when read.
* **Cost**: CPU drops a lot. Redis server cost will be there but it is cheaper than scaling SQL DB.

##### 3. Table Partitioning
* Partition table by `studentID` (e.g. Hash partitioning into 50 parts). DB only search partition file where 1042 exists. Easy DB maintenance.

##### 4. Archiving Old rows
* Nightly cron job moves old read notifications (>60 days) to `archived_notifications` or cold storage (S3). Keeps primary table small & fast. Cost is less as S3 is very cheap. (might be a overkill for genuine reason)
