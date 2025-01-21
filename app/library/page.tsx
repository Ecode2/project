"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchBar } from "@/components/search-bar";
import { BookUploadDialog } from "@/components/book-upload-dialog";
import { BookList } from "@/components/books/book-list";

export default function LibraryPage() {
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");

  useEffect(() => {
    
    console.log(filter)
  }, [filter]);

  const handleConvert = (state: "all" | "public" | "private") => {
    setFilter(state);
    console.log(state);
  }

  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Library</h1>
        <BookUploadDialog />
      </div>

      <SearchBar />

      <Tabs defaultValue={filter} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <span onClick={()=> handleConvert("all")}><TabsTrigger value="all">All</TabsTrigger></span>
          <span onClick={()=> handleConvert("public")}><TabsTrigger value="public">Public</TabsTrigger></span>
          <span onClick={()=> handleConvert("private")}><TabsTrigger value="private">Private</TabsTrigger></span>
        </TabsList>
        <TabsContent value={filter} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <BookList status={filter} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}