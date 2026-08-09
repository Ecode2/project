"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { GetLibraryStats } from "@/lib/api";
import { LibraryStats } from "@/lib/definitions";
import {
  BookOpen, Bookmark, CheckCircle2, Clock, Headphones, Library, FileText,
} from "lucide-react";

/** ms -> "3h 20m" / "45m" / "—" */
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function StatCard({
  icon: Icon, label, value, hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="space-y-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-medium">{label}</h3>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    // The access token is restored asynchronously on load, so wait for the
    // session before requesting stats (the endpoint requires authentication).
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      const res = await GetLibraryStats();
      if (cancelled) return;
      if (res.status && typeof res.message !== "string") {
        setStats(res.message as LibraryStats);
        setStatsError(null);
      } else {
        setStatsError(
          typeof res.message === "string" ? res.message : "Could not load stats",
        );
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const completionRate =
    stats && stats.books_started > 0
      ? Math.round((stats.books_completed / stats.books_started) * 100)
      : 0;

  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {user ? (
                <span className="text-2xl font-semibold text-primary">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              ) : (
                <BookOpen className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              {user ? (
                <>
                  <h2 className="text-xl font-semibold truncate">{user.username}</h2>
                  <p className="text-muted-foreground truncate">{user.email}</p>
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {statsError && (
        <Card className="p-4">
          <p className="text-sm text-destructive">{statsError}</p>
        </Card>
      )}

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Library}
              label="In Library"
              value={stats.books_in_library}
              hint={`${stats.documents} document${stats.documents === 1 ? "" : "s"}, ${stats.audiobooks} audiobook${stats.audiobooks === 1 ? "" : "s"}`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.books_completed}
            />
            <StatCard
              icon={BookOpen}
              label="In Progress"
              value={stats.books_in_progress}
            />
            <StatCard
              icon={Clock}
              label="Listening Time"
              value={formatDuration(stats.estimated_listening_ms)}
              hint="Estimated from narration length"
            />
            <StatCard
              icon={Bookmark}
              label="Bookmarks"
              value={stats.bookmarks}
            />
            <StatCard
              icon={stats.audiobooks > stats.documents ? Headphones : FileText}
              label="Started"
              value={stats.books_started}
            />
          </div>

          <Card className="p-4">
            <h3 className="font-medium mb-2">Completion Rate</h3>
            <Progress value={completionRate} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {stats.books_started === 0
                ? "You haven't started any books yet."
                : `${completionRate}% of the ${stats.books_started} book${stats.books_started === 1 ? "" : "s"} you've started ${stats.books_completed === 1 ? "is" : "are"} finished.`}
            </p>
          </Card>
        </>
      ) : (
        !statsError && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
