"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { BookGrid } from "@/components/books/book-grid";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6 px-5 pt-safe">
      <header className="pt-5">
        <h1 className="text-[1.75rem] font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Public books shared by the community.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search public books"
          className="h-11 rounded-xl border-0 bg-secondary pl-9"
        />
      </div>

      <BookGrid status="public" query={query} emptyMessage="No public books yet." />
    </div>
  );
}
