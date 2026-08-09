"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FileText, Headphones, Loader2, Trash2, Upload } from "lucide-react";
import {
  BookCoverResponse,
  BookFileInfo,
  FILE_ACCEPT_ATTR,
  extensionOf,
  isAudioExtension,
} from "@/lib/definitions";
import {
  DeleteBookFile,
  ListBookFiles,
  UpdateBookInfo,
  UploadBookFile,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Strip the storage prefix so only the filename shows. */
function baseName(path: string): string {
  return path.split("/").pop() || path;
}

export function BookEditDialog({
  book,
  open,
  onOpenChange,
  onUpdated,
}: {
  book: BookCoverResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (book: BookCoverResponse) => void;
}) {
  const { toast } = useToast();

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [description, setDescription] = useState(book.description ?? "");
  const [year, setYear] = useState(
    book.production_year ? String(book.production_year) : "",
  );
  const [isPublic, setIsPublic] = useState(book.status === "public");

  const [files, setFiles] = useState<BookFileInfo[]>(book.files ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BookFileInfo | null>(null);
  const [error, setError] = useState("");

  // Re-seed the form whenever a different book is opened.
  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author ?? "");
    setDescription(book.description ?? "");
    setYear(book.production_year ? String(book.production_year) : "");
    setIsPublic(book.status === "public");
    setFiles(book.files ?? []);
    setError("");
  }, [book]);

  const refreshFiles = async () => {
    const res = await ListBookFiles(book.id);
    if (res.status && Array.isArray(res.message)) setFiles(res.message);
  };

  useEffect(() => {
    if (open) refreshFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book.id]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) return setError("Title is required.");
    if (year && !/^\d{1,4}$/.test(year)) {
      return setError("Publication year must be a number.");
    }

    setIsSaving(true);
    const result = await UpdateBookInfo(book.id, {
      title: title.trim(),
      author: author.trim() || null,
      description: description.trim() || null,
      production_year: year ? parseInt(year, 10) : null,
      status: isPublic ? "public" : "private",
    });
    setIsSaving(false);

    if (result.status && typeof result.message !== "string") {
      onUpdated(result.message as BookCoverResponse);
      toast({ title: "Saved", description: "Book details updated." });
      onOpenChange(false);
    } else {
      setError(
        typeof result.message === "string" ? result.message : "Failed to save changes",
      );
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so re-picking the same filename still fires onChange.
    e.target.value = "";
    if (!file) return;

    setError("");
    setIsUploading(true);
    const nextOrder = files.length
      ? Math.max(...files.map((f) => f.order ?? 0)) + 1
      : 0;
    const res = await UploadBookFile(book.id, file, nextOrder);
    setIsUploading(false);

    if (!res.status) {
      setError(typeof res.message === "string" ? res.message : "Upload failed");
      return;
    }
    await refreshFiles();
    toast({
      title: "File uploaded",
      description: `${file.name} was added. It may take a moment to finish processing.`,
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setDeletingId(target.id);
    const res = await DeleteBookFile(target.id);
    setDeletingId(null);

    if (res.status) {
      setFiles((prev) => prev.filter((f) => f.id !== target.id));
      toast({ title: "File removed", description: baseName(target.file) });
    } else {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: typeof res.message === "string" ? res.message : "Could not delete file",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Book</DialogTitle>
            <DialogDescription>
              Update the details, or replace the uploaded file if you picked the
              wrong one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDetails} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-author">Author</Label>
              <Input
                id="edit-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-year">Publication Year</Label>
              <Input
                id="edit-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2021"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-public">Make book public</Label>
              <Switch
                id="edit-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>

          <Separator />

          <div className="space-y-3 py-2">
            <div>
              <h3 className="font-medium">Files</h3>
              <p className="text-sm text-muted-foreground">
                Uploaded the wrong file? Delete it and upload the correct one.
              </p>
            </div>

            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No files attached to this book yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {files.map((file) => {
                  const audio = isAudioExtension(
                    file.fmt || extensionOf(file.file),
                  );
                  const Icon = audio ? Headphones : FileText;
                  return (
                    <li
                      key={file.id}
                      className="flex items-center gap-3 rounded-md border p-2"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {file.track_title || baseName(file.file)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            file.fmt?.toUpperCase(),
                            formatBytes(file.size_bytes),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${baseName(file.file)}`}
                        disabled={deletingId === file.id}
                        onClick={() => setPendingDelete(file)}
                      >
                        {deletingId === file.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-2 border-dashed rounded-lg p-4 text-center transition-colors hover:bg-secondary/50">
              <input
                type="file"
                id="edit-file-upload"
                className="hidden"
                accept={FILE_ACCEPT_ATTR}
                onChange={handleUpload}
                disabled={isUploading}
              />
              <label htmlFor="edit-file-upload" className="block cursor-pointer">
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload another file
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, EPUB, DOCX, TXT · MP3, M4A, M4B, AAC, OGG, OPUS, WAV, FLAC
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{baseName(pendingDelete.file)}&rdquo; will be permanently
                  removed from this book. Reading progress that points into it may
                  no longer resolve. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
