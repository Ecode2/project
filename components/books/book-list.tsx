import React from 'react'
import { useState, useEffect } from "react";
import { BookCard } from "@/components/book-card";
import { ApiResponse, BookListResponse } from "@/lib/definitions";
import { ListBooks } from "@/lib/api";
import { useRouter } from 'next/navigation';

interface BookListProps {
    status: "public" | "private" | "all";
}
  
  
export const BookList: React.FC<BookListProps> = ({ status }) => {

    const [books, setBooks] = useState<BookListResponse | null>(null);
    const router = useRouter();


    useEffect(() => {
        const handleBooks = async () => {
            let data: ApiResponse = { status: false, message: '' };
            if (status == "all") {
                data = await ListBooks(null);
            }else if (status == "public") {
                data = await ListBooks("public");
            }else if (status == "private") {
                data = await ListBooks('private');
            }

            if (data.status){
            if (typeof data.message !== 'string') {
                setBooks(data.message);
            }
            }
        }

        handleBooks();
      }, [status])

    const handleBookClick = (id: number) => {
        router.push(`/books/${id}`)
    }

    return (
        <>
            {books && books.results.map((book) => {
                let progress = 0
                const currentOnePage = parseInt(localStorage.getItem(book.title+book.id+"one_page") || '0')
                const currentAllPage = parseInt(localStorage.getItem(book.title+book.id+"all_page") || '0')
                if (currentOnePage != 0) {
                    if (book.total_page) {
                        progress = (currentOnePage / book.total_page) * 100;
                    }
                }else if (currentAllPage != 0) {
                    if (book.total_page) {
                        progress = (currentAllPage / book.total_page) * 100
                    }
                }
                return (
                    <div key={book.id} onClick={() => handleBookClick(book.id)}>
                        <BookCard 
                        title={book.title} 
                        author={book.author? book.author : "Unknown"} 
                        coverUrl={book.book_cover} 
                        progress={progress}/>
                    </div>
                    )
            })}
        </>
    )
}
