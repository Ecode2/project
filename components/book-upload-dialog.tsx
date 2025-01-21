"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Upload } from "lucide-react";
import { FormSchemaData, formSchema } from "@/lib/definitions";
import { CreateBook } from "@/lib/api";

export function BookUploadDialog() {
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("")
  const router = useRouter();

  const [formData, setFormData] = useState<FormSchemaData>({
    title: "",
    author: "",
    description: "",
    book: null, // Changed to null to handle files
    publication_year: undefined,
    isPublic: isPublic,
  });

  const form = useForm<FormSchemaData>({
    resolver: zodResolver(formSchema),
    defaultValues: formData,
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
      
      console.log(response, "eeff")
      if (!response.status && typeof response.message === "string") {
          return setError(response.message)
        }


      window.location.reload()


    } catch (error) {
      console.error("Failed to upload book:", error);
      if (typeof error === "string") {setError(error)}
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
              {form.formState.errors.title && (
                <p className="text-red-600">
                  {form.formState.errors.title.message}
                </p>
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
              {form.formState.errors.author && (
                <p className="text-red-600">
                  {form.formState.errors.author.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                placeholder="Enter PDF description"
                name="description"
                value={formData.description}
                onChange={handleTextAreaChange}
              />
              {form.formState.errors.description && (
                <p className="text-red-600">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="book">Book File (PDF)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-secondary/50 transition-colors">
                <Input
                  type="file"
                  id="book"
                  className="hidden"
                  name="book"
                  accept=".pdf"
                  onChange={handleInputChange}
                />
                <label htmlFor="book" className="block">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload PDF file
                  </p>
                </label>
                {form.formState.errors.book && (
                  <p className="text-red-600">
                    {String(form.formState.errors.book.message)}
                  </p>
                )}
              </div>
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
              {form.formState.errors.publication_year && (
                <p className="text-red-600">
                  {form.formState.errors.publication_year.message}
                </p>
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
          <p className="text-red-600"> {error} </p>
          <Button type="submit" className="w-full">
            Upload Book
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
