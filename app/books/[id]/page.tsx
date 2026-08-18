"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, ChevronLeft, Clock, Edit, Headphones, Play, Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { usePlayer } from "@/components/player/player-provider";
import { BookEditDialog } from "@/components/book-edit-dialog";
import { DeleteBookInfo, GetBookInfo } from "@/lib/api";
import { getProgress } from "@/lib/reader-api";
import type { BookCoverResponse } from "@/lib/definitions";

function duration(ms?: number | null) {
  if (!ms) return null;
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function BookPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useUser();
  const player = usePlayer();

  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const [book, setBook] = useState<BookCoverResponse | null>(null);
  const [percent, setPercent] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await GetBookInfo(id);
      if (!active) return;
      if (data.status && typeof data.message !== "string") {
        setBook(data.message);
        try {
          const p = await getProgress(id);
          if (active) setPercent(p.percent ?? 0);
        } catch { /* not started */ }
      } else {
        router.push("/library");
      }
    })();
    return () => { active = false; };
  }, [id, router]);

  const handleDelete = async () => {
    if (!book) return;
    const result = await DeleteBookInfo(book.id);
    if (result.status) {
      toast({ title: "Book deleted" });
      router.push("/library");
    } else {
      toast({ variant: "destructive", title: "Delete failed" });
    }
  };

  const startPlaying = () => {
    if (!book) return;
    player.open(book.id, true);
    router.push(`/reader/${book.id}`);
  };

  if (!book) {
    return (
      <div className="space-y-6 px-5 pt-10">
        <Skeleton className="mx-auto aspect-[2/3] w-44 rounded-2xl" />
        <Skeleton className="mx-auto h-6 w-2/3" />
        <Skeleton className="mx-auto h-4 w-1/3" />
      </div>
    );
  }

  const isOwner = Boolean(currentUser && book.user === currentUser.username);
  const totalTime = duration(book.duration_estimate_ms);

  return (
    <div className="pt-safe">
      {/* Cover backdrop: blurred art bleeding behind the header, iOS style. */}
      <div className="relative">
        {book.cover_url && (
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-cover bg-center opacity-25 blur-2xl"
            style={{ backgroundImage: `url(${book.cover_url})` }}
          />
        )}
        <div className="flex items-center px-3 py-3">
          <Button variant="ghost" size="icon" aria-label="Back"
            onClick={() => router.back()}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex flex-col items-center px-6 pb-6 text-center">
          <div className="aspect-[2/3] w-40 overflow-hidden rounded-2xl bg-muted shadow-2xl shadow-black/50 ring-1 ring-border/50">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-3 text-sm text-muted-foreground">
                {book.title}
              </div>
            )}
          </div>

          <h1 className="mt-5 text-xl font-semibold leading-tight">{book.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {book.author || "Unknown author"}
          </p>

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {book.book_type === "audiobook"
                ? <><Headphones className="h-3.5 w-3.5" /> Audiobook</>
                : <><Clock className="h-3.5 w-3.5" /> {totalTime ?? "Narrated"}</>}
            </span>
            {book.production_year && <span>· {book.production_year}</span>}
            {book.status === "public" && <span>· Public</span>}
          </div>

          <div className="mt-6 flex w-full max-w-xs gap-3">
            <Button size="lg" onClick={startPlaying}
              className="h-12 flex-1 rounded-full text-base shadow-lg shadow-primary/25">
              <Play className="mr-2 h-5 w-5" />
              {percent > 0 && percent < 100 ? "Resume" : "Listen"}
            </Button>
            {book.book_type !== "audiobook" && (
              <Button size="lg" variant="secondary"
                aria-label="Read"
                onClick={() => {
                  player.open(book.id);
                  router.push(`/reader/${book.id}?mode=read`);
                }}
                className="h-12 rounded-full px-5">
                <BookOpen className="h-5 w-5" />
              </Button>
            )}
          </div>

          {percent > 0 && (
            <div className="mt-3 w-full max-w-xs">
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(percent)}% complete
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6">
        {book.description && (
          <section>
            <h2 className="mb-1.5 text-sm font-semibold">About</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {book.description}
            </p>
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Uploaded by</p>
            <p>{book.user}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Updated</p>
            <p>{new Date(book.updated_at).toLocaleDateString()}</p>
          </div>
        </section>

        {isOwner && (
          <div className="flex gap-3 pb-4">
            <Button variant="secondary" className="flex-1 rounded-xl"
              onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="flex-1 rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this book?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the book, its files and your progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <BookEditDialog book={book} open={isEditing} onOpenChange={setIsEditing}
        onUpdated={setBook} />
    </div>
  );
}
