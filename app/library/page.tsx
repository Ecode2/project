"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookUploadDialog } from "@/components/book-upload-dialog";
import { BookGrid } from "@/components/books/book-grid";
import { ContinueShelf } from "@/components/reader/continue-shelf";

type Filter = "all" | "public" | "private";

export default function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6 px-5 pt-safe">
      <header className="flex items-center justify-between pt-5">
        <h1 className="text-[1.75rem] font-bold tracking-tight">Library</h1>
        <BookUploadDialog onUploaded={() => setRefreshKey((k) => k + 1)} />
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your books"
          className="h-11 rounded-xl border-0 bg-secondary pl-9"
        />
      </div>

      <ContinueShelf />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-secondary">
          <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
          <TabsTrigger value="private" className="rounded-lg">Private</TabsTrigger>
          <TabsTrigger value="public" className="rounded-lg">Public</TabsTrigger>
        </TabsList>
      </Tabs>

      <BookGrid
        status={filter}
        query={query}
        refreshKey={refreshKey}
        emptyMessage="Your library is empty. Upload a book to get started."
      />
    </div>
  );
}
