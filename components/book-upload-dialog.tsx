"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload } from "lucide-react";
import {
  FormSchemaData,
  formSchema,
  FILE_ACCEPT_ATTR,
} from "@/lib/definitions";
import { CreateBook } from "@/lib/api";

export function BookUploadDialog() {
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormSchemaData>({
    title: "",
    author: "",
    description: "",
    book: null, // Changed to null to handle files
    publication_year: undefined,
    isPublic: isPublic,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;

    // Handle file input separately
    if (name === "book" && files && files.length > 0) {
      setFormData({ ...formData, book: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCheckChange = (checked: boolean) => {
    setIsPublic(checked);
    setFormData({ ...formData, isPublic: checked });
  };

  const handleBookUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validate here rather than through react-hook-form: this form manages its
    // own state and never calls handleSubmit, so the resolver never ran and no
    // validation message was ever shown.
    const parsed = formSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const data = {
        title: formData.title,
        author: formData.author,
        description: formData.description || undefined,
        book: formData.book, // File object
        publication_year: formData.publication_year || undefined,
        isPublic: formData.isPublic,
      };

      const response = await CreateBook(data);

      if (!response.status) {
        setIsSubmitting(false);
        return setError(
          typeof response.message === "string"
            ? response.message
            : "Failed to upload book",
        );
      }

      window.location.reload();
    } catch (error) {
      console.error("Failed to upload book:", error);
      setIsSubmitting(false);
      setError(
        typeof error === "string" ? error : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Book
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby=""
        className="sm:max-w-[425px] h-screen overflow-y-scroll"
      >
        <form onSubmit={handleBookUpload}>
          <DialogHeader>
            <DialogTitle>Upload New Book</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Book Title</Label>
              <Input
                id="title"
                placeholder="Enter book title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
              />
              {fieldErrors.title && (
                <p className="text-red-600 text-sm">{fieldErrors.title}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                placeholder="Enter author name"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
              />
              {fieldErrors.author && (
                <p className="text-red-600 text-sm">{fieldErrors.author}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                placeholder="Enter a short description"
                name="description"
                value={formData.description}
                onChange={handleTextAreaChange}
              />
              {fieldErrors.description && (
                <p className="text-red-600 text-sm">{fieldErrors.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="book">Book File</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-secondary/50 transition-colors">
                <Input
                  type="file"
                  id="book"
                  className="hidden"
                  name="book"
                  accept={FILE_ACCEPT_ATTR}
                  onChange={handleInputChange}
                />
                <label htmlFor="book" className="block cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {formData.book ? (
                    <p className="text-sm font-medium break-all">
                      {(formData.book as File).name}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Click to upload a document or audiobook
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, EPUB, DOCX, TXT &middot; MP3, M4A, M4B, AAC, OGG, OPUS, WAV, FLAC
                      </p>
                    </>
                  )}
                </label>
              </div>
              {fieldErrors.book && (
                <p className="text-red-600 text-sm">{fieldErrors.book}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="publication_year">Publication Year</Label>
              <Input
                id="publication_year"
                type="number"
                name="publication_year"
                placeholder="Enter Publication Year"
                value={formData.publication_year || ""}
                onChange={handleInputChange}
              />
              {fieldErrors.publication_year && (
                <p className="text-red-600 text-sm">{fieldErrors.publication_year}</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="public">Make book public</Label>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={(checked) => handleCheckChange(checked)}
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              "Upload Book"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
