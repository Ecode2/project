"use client";

import { GetAllPage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface BookReaderAllProps {
    fontSize: number;
    currentPage: number;
    onClick: () => void;
    bookId: number;
    title: string
}

export function BookReaderAll({
    fontSize,
    currentPage,
    onClick,
    bookId,
    title,
}: BookReaderAllProps) {
    const [contents, setContents] = useState<string>("")
    const [msg, setMsg] = useState<string>("Loading...")

    useEffect(() => {

        const handlePageContent = async () => {
            let response = null
            const stored_response = localStorage.getItem(title+bookId+"pages")
            if (stored_response) {
                response = JSON.parse(stored_response)
            }else {
                response = await GetAllPage(bookId, currentPage)
                localStorage.setItem(title+bookId+"pages", JSON.stringify(response))
            }

            if (response.status) {
                if (typeof response.message !== "string") {

                    let content = "";
                    if (response.message.hasOwnProperty(currentPage)) {
                        content = response.message[currentPage] + "\n";
                    }

                    setContents(content);
                    setMsg("")
                }
            } else {
                setMsg(`Something went wrong. Please try again later`)
            }
        }
        handlePageContent()

    }, [bookId, currentPage, title]);


    return (
        <div
            onClick={onClick}
            className={cn(
                "prose dark:prose-invert mx-auto max-w-none",
                "bg-reader_bg text-reader_light dark:bg-reader_bg_dark dark:text-reader_dark",
                "p-8 sm:p-12 rounded-lg shadow-lg",
                "transition-all duration-200 ease-in-out"
            )}
            style={{ fontSize: `${fontSize}px` }}>
            
            <p className="leading-relaxed">
                {msg}
                {contents}
            </p>
        </div>
    );
}