-- Viewer dashboard watchlist (pinned SKUs / projects)
ALTER TABLE "users" ADD COLUMN "dashboardPins" JSONB;
