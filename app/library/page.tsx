"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchBar } from "@/components/search-bar";
import { BookCard } from "@/components/book-card";
import { BookUploadDialog } from "@/components/book-upload-dialog";

export default function LibraryPage() {
  const [filter, setFilter] = useState("all");

  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Library</h1>
        <BookUploadDialog />
      </div>

      <SearchBar />

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="private">Private</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <BookCard
              title="1984"
              author="George Orwell"
              coverUrl="https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400"
              progress={30}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}