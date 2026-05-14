-- Hot-path indexes for ledger lists, dashboard badges, PO/project tabs, attendance log, branch stock scans.
-- See docs/database-performance.md.

CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt" DESC);

CREATE INDEX "stock_movements_stockId_createdAt_idx" ON "stock_movements"("stockId", "createdAt" DESC);

CREATE INDEX "stock_movements_type_createdAt_idx" ON "stock_movements"("type", "createdAt" DESC);

CREATE INDEX "stock_locationId_idx" ON "stock"("locationId");

CREATE INDEX "purchase_orders_createdAt_idx" ON "purchase_orders"("createdAt" DESC);

CREATE INDEX "purchase_orders_status_createdAt_idx" ON "purchase_orders"("status", "createdAt" DESC);

CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt" DESC);

CREATE INDEX "projects_status_createdAt_idx" ON "projects"("status", "createdAt" DESC);

CREATE INDEX "attendance_date_idx" ON "attendance"("date" DESC);

CREATE INDEX "shifts_employeeId_startTime_idx" ON "shifts"("employeeId", "startTime" ASC);

CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
