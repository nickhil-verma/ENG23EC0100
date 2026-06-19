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

# Stage 3: 
## Scaling to 50 Lakh (5,000,000) Students
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


# Stage 4 
## the notifications are being fetched on each page load for every student and DB is getting overwhelmed 
how can i improve the performance 

If notifcations are fetched on every page load, it will crash DB. We can improve peformance using these easy ways:

##### 1. Frontend Caching (React Query / SWR / Session Storage)
* Don't call API on every page change. Use React Query / Context to cache notifcations list.
- Or save unread count in `sessionStorge`. When student navigate pages, load count from sessionStorge instead of calling API.
+ Only refresh if user manualy clicks refresh or every 5 mins.

##### 2. Backend Redis Cache (TTL based)
* Cache the `GET /notifications` response in Redis for e.g. - TTL of 2-3 minutes.
- When student load page -> check Redis first. If cache is there return it. This saves DB from hitting directly.
* Cache invlidation: Delete Redis key only when new notifcation is sent to that student or they mark read.

##### 3. DB Read Replicas
* Setup 1 primary DB for writes and 1-2 Read Replicas.
- Route all `GET /notifications` calls to Read Replicas. This keeps main DB free.

##### 4. Lazy Loading / Pagination
* On page load, only fetch count of unread (`GET /unread-count`) which is very fast query.
+ Only load full notification list when student clicks on bell icon. Don't fetch full list on dashboard load.
 

# stage 5 
## it is placement season and HR clicks on notify all 50000 students should get in app notification

and this is the function which is given:
```python
function notify_all(student_ids: array,message: string):
    for student_id in student_ids:
    send_email(student_id,message)
    save_to_db(student_id,message)
    push_to_app(student_id,message)
```

what shortcoming is in this function and log indicate that it failed for 200 student midway, how can i design this reliable and fast? should process of saving mail to DB be there? give correct pseudo code now.

### Shortcomings in above function:
1. **Sync Loop**: It runs one by one. Sending 50k emails & pushes will take hours, API request will timeout and crash.
- **No error handling**: If it fail at student 20000, loop stops. Half students get it, half don't. We don't know who got it.
+ **DB overload**: doing 50k separate insert querys inside loop will overwhelm DB.
* **Network blocking**: doing SMTP email calls inside loop is very bad practice.

### Should we save mail/notification to DB?
Yes, but don't do it inside the sync loop. We must save it to show in the in-app inbox later. We should do **bulk insert** (insert 1000 rows at once) or do it in background worker.

### How to design it reliable & fast?
- **Job Queues (BullMQ / RabbitMQ)**: HR click button -> immediately push jobs to queue and return `200 OK` (takes < 100ms).
* **Chunking**: Split 50k students into batches of 1000.
+ **Background Workers**: Multiple workers run in parallel, pick batches, and send email/push.
- **Retries**: If one email fails, retry only that one, don't stop the whole loop.

### optimised Pseudo Code:

```python
# API Handler (runs instantly)
function notify_all_api(student_ids: array, message: string):
    campaign_id = create_campaign_in_db(message)
    
    # 1. Bulk inserting the  pending notification in DB (batch of 1000)
    bulk_insert_pending_notifs(campaign_id, student_ids, message)
    
    # 2. Pushing batches to Queue (Redis/RabbitMQ)
    student_batches = split_into_batches(student_ids, 1000)
    for batch in student_batches:
        push_to_queue("send_notif_batch", {
            "campaign_id": campaign_id,
            "student_ids": batch,
            "message": message
        })
    return "Notification process started"

# Background Worker (processes in background)
function worker_process_batch(campaign_id, student_ids, message):
    for student_id in student_ids:
        try:
            # call push & email async
            send_email_async(student_id, message)
            push_to_app_async(student_id, message)
            
            # update status in DB
            update_status_success(campaign_id, student_id)
        except Exception as err:
            log_error(student_id, err)
            push_to_retry_queue(campaign_id, student_id, message)
```