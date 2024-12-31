import { Button } from "@/components/ui/button";
import { BookCard } from "@/components/book-card";
import { SearchBar } from "@/components/search-bar";

export default function Home() {
  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discover Books</h1>
        <Button variant="ghost" size="sm" asChild>
          <a href="/auth">Sign In</a>
        </Button>
      </div>
      
      <SearchBar />
      
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {/* Placeholder for book cards */}
        <BookCard
          title="The Great Gatsby"
          author="F. Scott Fitzgerald"
          coverUrl="https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400"
          progress={65}
        />
        {/* Add more BookCard components */}
      </div>
    </div>
  );
}