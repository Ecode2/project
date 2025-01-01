"use client"
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";
import { useAuth } from "@/hooks/use-auth";
import { BookList } from "@/components/books/book-list";

const Home = () => {
  const {user, isAuthenticated, logout} = useAuth();

  const handleLogout = () => {
    logout()
  }

  console.log(user, isAuthenticated)

  return (
    <div className="container px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Discover Books</h1>
        {isAuthenticated ? 
                <Button variant="ghost" size="sm" onClick={handleLogout} asChild>
                  <a>Logout</a>
                </Button>:
                <Button variant="ghost" size="sm" asChild>
                  <a href="/auth">Sign In</a>
                </Button> 
        }
      </div>
      
      <SearchBar />
      
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {/* Placeholder for book cards */}
        <BookList />
        {/* Add more BookCard components */}
      </div>
    </div>
  );
}

export default Home;