"use client";

import { GetOnePage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { use, useEffect, useState } from "react";

interface BookReaderProps {
    fontSize: number;
    currentPage: number;
    onClick: () => void;
    bookId: number
}

export function BookReader({
    fontSize,
    currentPage,
    onClick,
    bookId,
}: BookReaderProps) {
    const [contents, setContents] = useState<string>("")
    const [msg, setMsg] = useState<string>("Loading...")

    useEffect(() => {

        const handlePageContent = async () => {
            const response = await GetOnePage(bookId, currentPage)

            if (response.status) {
                if (typeof response.message !== "string") {

                    const {pageNumber, content} = response.message
                    console.log(pageNumber, content)
                    setContents(content)
                    setMsg("")
                }
            } else {
                setMsg(`Something went wrong. Please try again later`)
            }
        }
        handlePageContent()

    }, [bookId, currentPage]);


    return (
        <div
            onClick={onClick}
            className={cn(
                "prose dark:prose-invert mx-auto max-w-none",
                "bg-reader_bg text-reader_light dark:bg-reader_bg_dark dark:text-reader_dark",
                "p-8 sm:p-12 rounded-lg shadow-lg",
                "transition-all duration-200 ease-in-out"
            )}
            style={{ fontSize: `${fontSize}px` }}
        >
            {/* <h2 className="text-center mb-8">Chapter 1: The Beginning</h2>
            <p className="leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
                commodo consequat.
            </p> */}
            <p className="leading-relaxed">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
                dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
                proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                <br />
                <br />
                {msg}
                {contents}
            </p>
        </div>
    );
}