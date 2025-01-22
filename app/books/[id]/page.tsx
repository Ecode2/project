"use client";

import { useState, useEffect } from "react";
import { BookCard } from "@/components/book-card";
import { BookCoverResponse } from "@/lib/definitions";
import { GetBookInfo, UpdateBookInfo, DeleteBookInfo } from "@/lib/api";
import { useRouter, useParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Edit, Trash2, BookHeadphonesIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function BookPage() {
  const params = useParams();
  const path = usePathname();

  const [book, setBook] = useState<BookCoverResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  

  useEffect(() => {

    const fetchBook = async () => {
      const data = await GetBookInfo(parseInt(id as string));
      if (data.status && typeof data.message !== "string") {
        setBook(data.message);
        console.log(data.message)
      } else {
        router.push("/404");
      }
    };

    fetchBook();
  }, [id, router]);

  const handleStatusChange = async (newStatus: string) => {
    if (!book) return;
    
    setIsUpdating(true);
    const result = await UpdateBookInfo(book.id, { status: newStatus });
    setIsUpdating(false);

    if (result.status && typeof result.message !== "string") {
      setBook(result.message);
      toast({
        title: "Status Updated",
        description: `Book status changed to ${newStatus}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update book status",
      });
    }
  };

  const handleDelete = async () => {
    if (!book) return;

    const result = await DeleteBookInfo(book.id);
    
    if (result.status) {
      toast({
        title: "Book Deleted",
        description: "Book has been successfully deleted",
      });
      router.push("/library");
    } else {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete book",
      });
    }
  };

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const handleOnePage = () => {
    router.push(`${path}/read`)
  }
  const handleAllPage = () => {
    router.push(`${path}/read-all`)
  }

  // Calculate progress
  let progress = 0;
  const currentOnePage = parseInt(localStorage.getItem(book.title + book.id + "one_page") || "0");
  const currentAllPage = parseInt(localStorage.getItem(book.title + book.id + "all_page") || "0");
  
  if (currentOnePage !== 0 && book.total_page) {
    progress = (currentOnePage / book.total_page) * 100;
  } else if (currentAllPage !== 0 && book.total_page) {
    progress = (currentAllPage / book.total_page) * 100;
  }

  return (
    <div className="min-h-screen w-screen bg-background p-4 md:p-8">
      <div className=" max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Book Card Section */}
          <div className="flex flex-col space-y-4">
            <div className="max-w-sm mx-auto w-full">
              <BookCard
                title={book.title}
                author={book.author || "Unknown"}
                coverUrl={book.book_cover || null}
                progress={progress}
              />
            </div>
            <div className="flex flex-row md:flex-col gap-4 justify-between mt-4">
              <Button className="flex-1" size="lg"
                onClick={handleOnePage}>
                <Clock className="mr-2 h-4 w-4" />
                Read One Page
              </Button>
              <Button variant="outline" className="flex-1" size="lg"
                onClick={handleAllPage}>
                <BookHeadphonesIcon className="mr-2 h-4 w-4" />
                Read all Pages
              </Button>
            </div>
          </div>

          {/* Book Details Section */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
              <p className="text-lg text-muted-foreground">
                by {book.author || "Unknown"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground">
                  {book.description || "No description available"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Production Year
                  </h3>
                  <p>{book.production_year || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Status
                  </h3>
                  <div className="flex items-center gap-2">
                    <Select
                      value={book.status}
                      onValueChange={handleStatusChange}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    {isUpdating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Total Pages
                  </h3>
                  <p>{book.total_page || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Uploaded By
                  </h3>
                  <p>{book.user}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">
                  Last Updated
                </h3>
                <p>{new Date(book.updated_at).toLocaleDateString()}</p>
              </div>

              <div className="pt-4 flex gap-4">
                <Button variant="outline" className="w-full" size="lg">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" size="lg">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Book
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the
                        book and remove it from your library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
