import React from 'react'
import { useState, useEffect } from "react";
import { BookCard } from "@/components/book-card";
import { ApiResponse, BookListResponse } from "@/lib/definitions";
import { ListPublicbooks } from "@/lib/api";
import { useRouter } from 'next/navigation';

export const BookList = () => {
    const [books, setBooks] = useState<BookListResponse | null>(null);
    const router = useRouter();

    console.log("books", books)

    useEffect(() => {
        const handleBooks = async () => {
            const data: ApiResponse = await ListPublicbooks();
            if (data.status){
            if (typeof data.message !== 'string') {
                setBooks(data.message);
            }
            }
            console.log("life aint easy", data)
        }

        handleBooks();
      }, [])

    const handleBookClick = (id: number) => {
        router.push(`/books/${id}`)
    }

    return (
        <>
            {books && books.results.map((book) => {
                return (
                    <div key={book.id} onClick={() => handleBookClick(book.id)}>
                        <BookCard 
                        title={book.title} 
                        author={book.author? book.author : "Unknown"} 
                        coverUrl={book.book_cover} />
                    </div>
                    )
            })}
        </>
    )
}
